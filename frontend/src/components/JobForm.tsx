import { useState, useEffect } from 'react'
import type { Voice } from '../types'
import { getVoices, createJob } from '../api/client'

const LANGUAGES = [
  { code: 'cs', name: 'Czech',      flag: '🇨🇿' },
  { code: 'da', name: 'Danish',     flag: '🇩🇰' },
  { code: 'de', name: 'German',     flag: '🇩🇪' },
  { code: 'es', name: 'Spanish',    flag: '🇪🇸' },
  { code: 'gr', name: 'Greek',      flag: '🇬🇷' },
  { code: 'hu', name: 'Hungarian',  flag: '🇭🇺' },
  { code: 'hr', name: 'Croatian',   flag: '🇭🇷' },
  { code: 'ru', name: 'Russian',    flag: '🇷🇺' },
  { code: 'ro', name: 'Romanian',   flag: '🇷🇴' },
  { code: 'nl', name: 'Dutch',      flag: '🇳🇱' },
  { code: 'no', name: 'Norwegian',  flag: '🇳🇴' },
  { code: 'fi', name: 'Finnish',    flag: '🇫🇮' },
  { code: 'fr', name: 'French',     flag: '🇫🇷' },
  { code: 'sv', name: 'Swedish',    flag: '🇸🇪' },
  { code: 'pl', name: 'Polish',     flag: '🇵🇱' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'it', name: 'Italian',    flag: '🇮🇹' },
]

const AUDIO_FORMATS = [
  { value: 'mp3_44100_128', label: 'MP3 · 44.1 kHz · 128 kbps' },
  { value: 'mp3_44100_192', label: 'MP3 · 44.1 kHz · 192 kbps' },
  { value: 'pcm_22050',     label: 'PCM · 22.05 kHz' },
  { value: 'pcm_44100',     label: 'PCM · 44.1 kHz' },
]

interface Props {
  onJobCreated: (jobId: string) => void
}

export default function JobForm({ onJobCreated }: Props) {
  const [text, setText]               = useState('')
  const [voiceId, setVoiceId]         = useState('21m00Tcm4TlvDq8ikWAM')
  const [selectedLangs, setSelected]  = useState<string[]>(['fr'])
  const [audioFormat, setFormat]      = useState('mp3_44100_128')
  const [voices, setVoices]           = useState<Voice[]>([])
  const [voicesLoading, setVLoading]  = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    getVoices()
      .then(v => {
        setVoices(v)
        if (v.length > 0) setVoiceId(v[0].voice_id)
      })
      .catch(() => { /* voices API may return 401 on free plan; manual ID fallback */ })
      .finally(() => setVLoading(false))
  }, [])

  const toggle = (code: string) =>
    setSelected(prev =>
      prev.includes(code) ? prev.filter(l => l !== code) : [...prev, code]
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || selectedLangs.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await createJob({
        text,
        languages: selectedLangs,
        voice_id: voiceId,
        audio_format: audioFormat,
      })
      onJobCreated(res.job_id)
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>Generate Audio</h2>

      {/* ── Text ──────────────────────────────────────────── */}
      <div className="field">
        <span>Source Text</span>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Enter the text you want to convert to speech…"
          maxLength={5000}
          rows={5}
          required
        />
        <span className="char-count">{text.length} / 5000</span>
      </div>

      {/* ── Voice + Format ────────────────────────────────── */}
      <div className="row">
        <div className="field">
          <span>Voice</span>
          {voices.length > 0 ? (
            <select value={voiceId} onChange={e => setVoiceId(e.target.value)}>
              {voices.map(v => (
                <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={voiceId}
              onChange={e => setVoiceId(e.target.value)}
              placeholder="Voice ID"
              disabled={voicesLoading}
            />
          )}
        </div>

        <div className="field">
          <span>Audio Format</span>
          <select value={audioFormat} onChange={e => setFormat(e.target.value)}>
            {AUDIO_FORMATS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Languages ─────────────────────────────────────── */}
      <fieldset className="field">
        <legend>
          Target Languages&nbsp;
          <span className="badge">{selectedLangs.length} selected</span>
          <button
            type="button"
            className="btn-select-all"
            onClick={() =>
              setSelected(
                selectedLangs.length === LANGUAGES.length
                  ? []
                  : LANGUAGES.map(l => l.code)
              )
            }
          >
            {selectedLangs.length === LANGUAGES.length ? 'Deselect All' : 'Select All'}
          </button>
        </legend>
        <div className="lang-grid">
          {LANGUAGES.map(lang => (
            <label
              key={lang.code}
              className={`lang-chip${selectedLangs.includes(lang.code) ? ' selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectedLangs.includes(lang.code)}
                onChange={() => toggle(lang.code)}
              />
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="error-msg">{error}</p>}

      <button
        type="submit"
        className="btn-primary"
        disabled={submitting || !text.trim() || selectedLangs.length === 0}
      >
        {submitting ? 'Creating job…' : '▶  Generate Audio'}
      </button>
    </form>
  )
}
