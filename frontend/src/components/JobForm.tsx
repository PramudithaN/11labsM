import { useState, useEffect } from 'react'
import { Card, Button, Select, Input, Space, Alert, Divider } from 'antd'
import { SoundOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { Voice, Model } from '../types'
import { getVoices, getModels, createJob } from '../api/client'

const { TextArea } = Input

// Friendly labels for the built-in defaults (shown when the API is unreachable)
const VOICE_NAMES: Record<string, string> = {
  '21m00Tcm4TlvDq8ikWAM': 'Rachel',
  'AZnzlk1XvdvUeBnXmlld': 'Domi',
  'EXAVITQu4vr4xnSDxMaL': 'Bella',
  'ErXwobaYiN019PkySvjV': 'Antoni',
  'MF3mGyEYCl7XYWbV9V6O': 'Elli',
  'TxGEqnHWrfWFTfGW9XjX': 'Josh',
  'VR6AewLTigWG4xSOukaG': 'Arnold',
  'pNInz6obpgDQGcFmaJgB': 'Adam',
  'yoZ06aMxZJJ28mfd3POQ': 'Sam',
}

const MODEL_NAMES: Record<string, string> = {
  'eleven_multilingual_v2':  'Eleven Multilingual v2',
  'eleven_multilingual_v1':  'Eleven Multilingual v1',
  'eleven_monolingual_v1':   'Eleven English v1',
  'eleven_turbo_v2':         'Eleven Turbo v2',
  'eleven_turbo_v2_5':       'Eleven Turbo v2.5',
  'eleven_flash_v2':         'Eleven Flash v2',
  'eleven_flash_v2_5':       'Eleven Flash v2.5',
}

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
  const [modelId, setModelId]   = useState('eleven_multilingual_v2')
  const [selected, setSelected] = useState<string[]>(['fr'])
  const [format, setFormat]     = useState('mp3_44100_128')
  const [voices, setVoices]     = useState<Voice[]>([])
  const [models, setModels]     = useState<Model[]>([])
  const [loading, setLoading]   = useState(true)
  const [submitting, setSub]    = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [apiWarn, setApiWarn]   = useState(false)

  useEffect(() => {
    Promise.all([getVoices(), getModels()])
      .then(([v, m]) => {
        setVoices(v)
        if (v.length) setVoiceId(v[0].voice_id)
        setModels(m)
        if (m.length) setModelId(m[0].model_id)
      })
      .catch(() => { setApiWarn(true) })
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
      const res = await createJob({ text, languages: selected, voice_id: voiceId, model_id: modelId, audio_format: format })
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

        {apiWarn && (
          <Alert
            type="warning"
            showIcon
            closable
            onClose={() => setApiWarn(false)}
            message="Backend unavailable"
            description="Could not load voices and models from the server. Using built-in defaults the form will still work once the backend is reachable."
          />
        )}

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

        {/* Voice + Model + Format */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Row 1: Voice + Audio Format */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="field-label">Voice</label>
              <Select
                value={voiceId}
                onChange={setVoiceId}
                loading={loading}
                style={{ width: '100%' }}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={voices.length
                  ? voices.map(v => ({ value: v.voice_id, label: v.name }))
                  : [{ value: voiceId, label: VOICE_NAMES[voiceId] ?? voiceId }]
                }
              />
            </div>
            <div>
              <label className="field-label">Audio Format</label>
              <Select
                value={format}
                onChange={setFormat}
                style={{ width: '100%' }}
                options={AUDIO_FORMATS.map(f => ({ value: f.value, label: f.label }))}
              />
            </div>
          </div>
          {/* Row 2: Model (full width – names are long) */}
          <div>
            <label className="field-label">Model</label>
            <Select
              value={modelId}
              onChange={setModelId}
              loading={loading}
              style={{ width: '100%' }}
              options={models.length
                ? models.map(m => ({ value: m.model_id, label: m.name }))
                : [{ value: modelId, label: MODEL_NAMES[modelId] ?? modelId }]
              }
            />
          </div>
        </div>

        <Divider style={{ margin: '4px 0' }} />

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
