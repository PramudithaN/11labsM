import { useState, useEffect, useRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Card, Button, Tag, Spin, Divider, notification } from 'antd'
import {
  PlayCircleOutlined, PauseCircleOutlined,
  DownloadOutlined, CheckCircleOutlined,
  LoadingOutlined, CloseCircleOutlined, ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { Job, JobStatus, AudioStatus } from '../types'
import { getJob, getDownloadUrl, getAudioStreamUrl } from '../api/client'

// ── Seeded fake-waveform heights (consistent per language) ──────
function waveHeights(seed: string): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return Array.from({ length: 18 }, (_, i) => {
    h = (Math.imul(31, h + i * 7)) | 0
    return 22 + (Math.abs(h) % 58)
  })
}

function Waveform({ lang, playing }: { lang: string; playing: boolean }) {
  const heights = useMemo(() => waveHeights(lang), [lang])
  return (
    <div className="waveform">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`wf-bar${playing ? ' active' : ''}`}
          style={{
            height: `${h}%`,
            animationDelay: playing ? `${(i * 0.04).toFixed(2)}s` : '0s',
          }}
        />
      ))}
    </div>
  )
}

// ── Status meta ─────────────────────────────────────────────────
const JOB_COLOR: Record<JobStatus, string> = {
  pending: '#94a3b8', translating: '#f59e0b', processing: '#6366f1',
  ready: '#15803d', partial: '#f59e0b', failed: '#ef4444',
}
const AUDIO_CLASS: Record<AudioStatus, string> = {
  pending: 'pending', generating: 'generating', complete: 'complete', failed: 'failed',
}
const AUDIO_ICON: Record<AudioStatus, ReactNode> = {
  pending:    <span style={{ color: '#94a3b8' }}>●</span>,
  generating: <LoadingOutlined style={{ color: '#6366f1' }} spin />,
  complete:   <CheckCircleOutlined style={{ color: '#15803d' }} />,
  failed:     <CloseCircleOutlined style={{ color: '#ef4444' }} />,
}
const AUDIO_LABEL: Record<AudioStatus, string> = {
  pending: 'Pending', generating: 'Generating', complete: 'Complete', failed: 'Failed',
}

const LANG_NAMES: Record<string, string> = {
  cs:'Czech', da:'Danish', de:'German', es:'Spanish', gr:'Greek',
  hu:'Hungarian', hr:'Croatian', ru:'Russian', ro:'Romanian',
  nl:'Dutch', no:'Norwegian', fi:'Finnish', fr:'French',
  sv:'Swedish', pl:'Polish', pt:'Portuguese', it:'Italian',
}
const LANG_FLAGS: Record<string, string> = {
  cs:'🇨🇿', da:'🇩🇰', de:'🇩🇪', es:'🇪🇸', gr:'🇬🇷', hu:'🇭🇺',
  hr:'🇭🇷', ru:'🇷🇺', ro:'🇷🇴', nl:'🇳🇱', no:'🇳🇴', fi:'🇫🇮',
  fr:'🇫🇷', sv:'🇸🇪', pl:'🇵🇱', pt:'🇵🇹', it:'🇮🇹',
}
const DONE: JobStatus[] = ['ready', 'partial', 'failed']

interface Props { jobId: string; onReset?: () => void }

export default function JobStatus({ jobId, onReset }: Props) {
  const [job, setJob]           = useState<Job | null>(null)
  const [err, setErr]           = useState<string | null>(null)
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef                = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying]   = useState<string | null>(null)
  const quotaNotifiedRef        = useRef(false)
  const [notifApi, notifHolder] = notification.useNotification()

  useEffect(() => {
    const poll = async () => {
      try {
        const d = await getJob(jobId)
        setJob(d)

        // Show a friendly one-time toast if any file hit the quota limit
        if (!quotaNotifiedRef.current) {
          const failedCount = d.audio_files.filter(af =>
            af.error_message?.includes('quota_exceeded')
          ).length
          if (failedCount > 0) {
            quotaNotifiedRef.current = true
            notifApi.warning({
              message: 'ElevenLabs quota exceeded',
              description: `You\'ve run out of ElevenLabs credits — ${failedCount} audio file${failedCount > 1 ? 's' : ''} couldn\'t be generated. Please top up your account and try again.`,
              icon: <ExclamationCircleOutlined style={{ color: '#f59e0b' }} />,
              placement: 'bottomRight',
              duration: 8,
            })
          }
        }

        const allAudioTerminal = d.audio_files.length > 0 &&
          d.audio_files.every(af => af.status === 'complete' || af.status === 'failed')
        if ((DONE.includes(d.status) || allAudioTerminal) && timerRef.current) clearInterval(timerRef.current)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Unknown error')
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
    poll()
    timerRef.current = setInterval(poll, 3000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [jobId])

  const playPreview = async (lang: string) => {
    if (playing === lang) {
      audioRef.current?.pause()
      setPlaying(null)
      return
    }
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    a.pause()
    a.src = getAudioStreamUrl(jobId, lang)
    a.onended = () => setPlaying(null)
    a.onerror = () => setPlaying(null)
    try { await a.play(); setPlaying(lang) } catch { setPlaying(null) }
  }

  if (err) return (
    <>
      {notifHolder}
      <Card bordered={false} style={{ boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <span style={{ color: '#ef4444' }}>⚠ {err}</span>
      </Card>
    </>
  )

  if (!job) return (
    <>
      {notifHolder}
      <Card bordered={false} style={{ boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b' }}>
          <Spin indicator={<LoadingOutlined spin />} /> Loading…
        </div>
      </Card>
    </>
  )

  const isDone          = DONE.includes(job.status)
  const hasAudio        = job.audio_files.some(af => af.status === 'complete')
  const allAudioFailed  = job.audio_files.length > 0 &&
    job.audio_files.every(af => af.status === 'failed')
  const showReset       = isDone || allAudioFailed
  const isSpinning      = job.status === 'translating' || job.status === 'processing'

  return (
    <>
      {notifHolder}
      <Card
        bordered={false}
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}
      >
        {/* ── Header ── */}
        <div className="job-hd">
          <div>
            <div className="job-id-text">
              <span>Job</span>
              <code>{job.id.slice(0, 8)}…</code>
            </div>
            <div className="job-meta">
              {new Date(job.created_at).toLocaleTimeString()}&nbsp;·&nbsp;{job.audio_format}
            </div>
          </div>
          <Tag
            style={{
              background: JOB_COLOR[job.status],
              color: '#fff',
              border: 'none',
              borderRadius: 99,
              padding: '2px 12px',
              fontWeight: 600,
              fontSize: '.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {isSpinning && <Spin indicator={<LoadingOutlined style={{ color: '#fff', fontSize: 11 }} spin />} />}
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </Tag>
        </div>

        {/* ── Download + Reset ── */}
        {(isDone || showReset) && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {hasAudio && (
                <a href={getDownloadUrl(job.id)} download="translated_voices.zip" style={{ flex: 1 }}>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    block
                    style={{ background: '#15803d', borderColor: '#15803d', color: '#fff', fontWeight: 600 }}
                  >
                    Download All (ZIP)
                  </Button>
                </a>
              )}
              <Button
                icon={<ReloadOutlined />}
                onClick={onReset}
                style={{ fontWeight: 600, flex: hasAudio ? 'none' : 1 }}
                title="Start over"
              >
                Reset
              </Button>
            </div>
          </>
        )}

        {/* ── File table ── */}
        {job.audio_files.length > 0 && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <div className="file-table">
              <div className="file-table-head">
                <span>File</span>
                <span>Progress</span>
                <span>Status</span>
                <span />
              </div>
              {job.audio_files.map(af => (
                <div key={af.id} className="file-row">
                  <div className="file-name">
                    <span>{LANG_FLAGS[af.language] ?? '🌐'}</span>
                    <span>{LANG_NAMES[af.language] ?? af.language.toUpperCase()}</span>
                  </div>

                  <div>
                    {af.status === 'complete'
                      ? <Waveform lang={af.language} playing={playing === af.language} />
                      : af.status === 'generating'
                      ? <Waveform lang={af.language} playing />
                      : <span style={{ fontSize: '.75rem', color: '#cbd5e1' }}>—</span>
                    }
                  </div>

                  <div className={`file-status ${AUDIO_CLASS[af.status]}`}>
                    {AUDIO_ICON[af.status]}
                    <span>{AUDIO_LABEL[af.status]}</span>
                  </div>

                  <div>
                    {af.status === 'complete' && (
                      <button
                        className={`play-circle${playing === af.language ? ' playing' : ''}`}
                        onClick={() => playPreview(af.language)}
                      >
                        {playing === af.language
                          ? <PauseCircleOutlined />
                          : <PlayCircleOutlined />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </>
  )
}
