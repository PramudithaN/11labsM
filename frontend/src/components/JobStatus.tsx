import { useState, useEffect, useRef } from 'react'
import type { Job, JobStatus, AudioStatus } from '../types'
import { getJob, getDownloadUrl } from '../api/client'

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
  en: 'English',    fr: 'French',   es: 'Spanish',  de: 'German',
  it: 'Italian',    pt: 'Portuguese', nl: 'Dutch',   pl: 'Polish',
  ru: 'Russian',    ja: 'Japanese', zh: 'Chinese',  ar: 'Arabic',
  ko: 'Korean',     sv: 'Swedish',  da: 'Danish',   fi: 'Finnish',
  tr: 'Turkish',    cs: 'Czech',    ro: 'Romanian', nb: 'Norwegian',
}

const DONE_STATUSES: JobStatus[] = ['ready', 'partial', 'failed']

interface Props { jobId: string }

export default function JobStatus({ jobId }: Props) {
  const [job, setJob]         = useState<Job | null>(null)
  const [fetchErr, setErr]    = useState<string | null>(null)
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null)

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
                  {LANG_NAMES[af.language] ?? af.language.toUpperCase()}
                </span>
                <span className="audio-status" style={{ color: am.color }}>
                  ● {am.label}
                </span>
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
          download={`tts-${job.id.slice(0, 8)}.zip`}
        >
          ↓ Download All (ZIP)
        </a>
      )}
    </div>
  )
}
