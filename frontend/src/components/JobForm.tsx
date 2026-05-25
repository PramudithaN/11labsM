import { useState, useEffect } from 'react'
import { Card, Button, Select, Input, Space, Alert } from 'antd'
import { SoundOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { Voice } from '../types'
import { getVoices, createJob } from '../api/client'

const { TextArea } = Input

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
  const [text, setText]      = useState('')
  const [voiceId, setVoiceId]   = useState('21m00Tcm4TlvDq8ikWAM')
  const [selected, setSelected] = useState<string[]>(['fr'])
  const [format, setFormat]     = useState('mp3_44100_128')
  const [voices, setVoices]     = useState<Voice[]>([])
  const [loading, setLoading]   = useState(true)
  const [submitting, setSub]    = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    getVoices()
      .then(v => { setVoices(v); if (v.length) setVoiceId(v[0].voice_id) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = (code: string) =>
    setSelected(p => p.includes(code) ? p.filter(l => l !== code) : [...p, code])

  const toggleAll = () =>
    setSelected(selected.length === LANGUAGES.length ? [] : LANGUAGES.map(l => l.code))

  const handleSubmit = async () => {
    if (!text.trim() || selected.length === 0) return
    setSub(true); setError(null)
    try {
      const res = await createJob({ text, languages: selected, voice_id: voiceId, audio_format: format })
      onJobCreated(res.job_id)
      setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create job')
    } finally {
      setSub(false)
    }
  }

  return (
    <Card
      title={<Space size={8}><SoundOutlined style={{ color: '#6366f1' }} /><span>Generate Audio</span></Space>}
      bordered={false}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}
    >
      <Space direction="vertical" size={18} style={{ width: '100%' }}>

        {/* Source text */}
        <div>
          <label className="field-label">Source Text</label>
          <TextArea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Enter text to synthesize…"
            maxLength={5000}
            rows={4}
            showCount
          />
        </div>

        {/* Voice + Format */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <label className="field-label">Voice</label>
            <Select
              value={voiceId}
              onChange={setVoiceId}
              loading={loading}
              style={{ width: '100%' }}
              options={voices.length
                ? voices.map(v => ({ value: v.voice_id, label: v.name }))
                : [{ value: voiceId, label: voiceId }]
              }
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <label className="field-label">Audio Format</label>
            <Select
              value={format}
              onChange={setFormat}
              style={{ width: '100%' }}
              options={AUDIO_FORMATS.map(f => ({ value: f.value, label: f.label }))}
            />
          </div>
        </div>

        {/* Languages */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <label className="field-label" style={{ marginBottom: 0 }}>Target Languages</label>
            <span style={{
              background: '#0f172a', color: '#fff',
              borderRadius: 99, padding: '1px 9px',
              fontSize: '.7rem', fontWeight: 700,
            }}>{selected.length}</span>
            <Button
              size="small"
              onClick={toggleAll}
              style={{ marginLeft: 'auto', fontSize: '.75rem', height: 24, padding: '0 10px' }}
            >
              {selected.length === LANGUAGES.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <div className="lang-grid">
            {LANGUAGES.map(lang => (
              <div
                key={lang.code}
                className={`lang-chip${selected.includes(lang.code) ? ' selected' : ''}`}
                onClick={() => toggle(lang.code)}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </div>
            ))}
          </div>
        </div>

        {error && <Alert type="error" message={error} showIcon closable onClose={() => setError(null)} />}

        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          size="large"
          block
          loading={submitting}
          disabled={!text.trim() || selected.length === 0}
          onClick={handleSubmit}
          style={{ background: '#0f172a', borderColor: '#0f172a', color: '#fff', height: 44, fontWeight: 600 }}
        >
          {submitting ? 'Creating job…' : 'Generate Audio'}
        </Button>

      </Space>
    </Card>
  )
}
