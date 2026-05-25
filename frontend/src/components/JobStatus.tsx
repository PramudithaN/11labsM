import { useState, useEffect, useRef } from 'react'
import type { Job, JobStatus, AudioStatus } from '../types'
import { getJob, getDownloadUrl, getAudioUrl } from '../api/client'

const JOB_META: Record<JobStatus, { label: string; color: string; spin?: boolean }> = {
  pending:     { label: 'Pending',     color: '#94a3b8' },
  translating: { label: 'Translating', color: '#f59e0b', spin: true },
  processing:  { label: 'Processing',  color: '#6366f1', spin: true },
  ready:       { label: 'Ready',       color: '#10b981' },
  partial:     { label: 'Partial',     color: '#f59e0b' },
  failed:      { label: 'Failed',      color: '#ef4444' },
}

const AUDIO_META: Record<AudioStatus, { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: '#94a3b8' },
  generating: { label: 'Generating', color: '#6366f1' },
  complete:   { label: 'Complete',   color: '#10b981' },
  failed:     { label: 'Failed',     color: '#ef4444' },
}

const LANG_NAMES: Record<string, string> = {
  cs: 'Czech',      da: 'Danish',     de: 'German',    es: 'Spanish',
  gr: 'Greek',      hu: 'Hungarian',  hr: 'Croatian',  ru: 'Russian',
  ro: 'Romanian',   nl: 'Dutch',      no: 'Norwegian', fi: 'Finnish',
  fr: 'French',     sv: 'Swedish',    pl: 'Polish',    pt: 'Portuguese',
  it: 'Italian',
}

const LANG_FLAGS: Record<string, string> = {
  cs: '🇨🇿', da: '🇩🇰', de: '🇩🇪', es: '🇪🇸', gr: '🇬🇷', hu: '🇭🇺',
  hr: '🇭🇷', ru: '🇷🇺', ro: '🇷🇴', nl: '🇳🇱', no: '🇳🇴', fi: '🇫🇮',
  fr: '🇫🇷', sv: '🇸🇪', pl: '🇵🇱', pt: '🇵🇹', it: '🇮🇹',
}

const DONE_STATUSES: JobStatus[] = ['ready', 'partial', 'failed']

interface Props { jobId: string }

export default function JobStatus({ jobId }: Props) {
  const [job, setJob]           = useState<Job | null>(null)
  const [fetchErr, setErr]      = useState<string | null>(null)
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef                = useRef<HTMLAudioElement | null>(null)
  const [playingLang, setPlaying] = useState<string | null>(null)
  const [loadingLang, setLoading] = useState<string | null>(null)

  const playPreview = async (language: string) => {
    if (playingLang === language) {
      audioRef.current?.pause()
      setPlaying(null)
      return
    }
    setLoading(language)
    try {
      const { url } = await getAudioUrl(jobId, language)
      if (!audioRef.current) audioRef.current = new Audio()
      const audio = audioRef.current
      audio.pause()
      audio.src = url
      audio.onended = () => setPlaying(null)
      audio.onerror = () => setPlaying(null)
      await audio.play()
      setPlaying(language)
    } catch {
      setPlaying(null)
    } finally {
      setLoading(null)
    }
  }

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await getJob(jobId)
        setJob(data)
        if (DONE_STATUSES.includes(data.status) && timerRef.current) {
          clearInterval(timerRef.current)
        }
      } catch (err) {
        setErr(err instanceof Error ? err.message : 'Unknown error')
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }

    poll()
    timerRef.current = setInterval(poll, 3000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [jobId])

  if (fetchErr)
    return <div className="card error-card">⚠ {fetchErr}</div>

  if (!job)
    return (
      <div className="card loading-card">
        <span className="spinner dark" /> Loading…
      </div>
    )

  const meta   = JOB_META[job.status]
  const isDone = DONE_STATUSES.includes(job.status)
  const hasAudio = job.audio_files.some(af => af.status === 'complete')

  return (
    <div className="card job-card">
      {/* Header */}
      <div className="job-header">
        <div>
          <p className="job-id">
            Job&nbsp;<code>{job.id.slice(0, 8)}…</code>
          </p>
          <p className="job-time">
            {new Date(job.created_at).toLocaleTimeString()}
            &nbsp;·&nbsp;{job.audio_format}
          </p>
        </div>
        <span className="status-badge" style={{ background: meta.color }}>
          {meta.spin && <span className="spinner" />}
          {meta.label}
        </span>
      </div>

      {/* Per-language rows */}
      {job.audio_files.length > 0 && (
        <div className="audio-files">
          {job.audio_files.map(af => {
            const am = AUDIO_META[af.status]
            return (
              <div key={af.id} className="audio-row">
                <span className="lang-name">
                  {LANG_FLAGS[af.language] ?? '🌐'}&nbsp;
                  {LANG_NAMES[af.language] ?? af.language.toUpperCase()}
                </span>
                <span className="audio-status" style={{ color: am.color }}>
                  ● {am.label}
                </span>
                {af.status === 'complete' && (
                  <button
                    type="button"
                    className="btn-preview"
                    disabled={loadingLang === af.language}
                    onClick={() => playPreview(af.language)}
                  >
                    {loadingLang === af.language
                      ? '…'
                      : playingLang === af.language
                      ? '■ Stop'
                      : '▶ Preview'}
                  </button>
                )}
                {af.error_message && (
                  <span className="af-error" title={af.error_message}>
                    ⚠ {af.error_message.slice(0, 50)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Download */}
      {isDone && hasAudio && (
        <a
          className="btn-download"
          href={getDownloadUrl(job.id)}
          download="translated_voices.zip"
        >
          ↓ Download All (ZIP)
        </a>
      )}
    </div>
  )
}
