import { useState } from 'react'
import { ConfigProvider } from 'antd'
import JobForm from './components/JobForm'
import JobStatus from './components/JobStatus'
import './App.css'

export default function App() {
  const [jobs, setJobs] = useState<string[]>([])
  const [formKey, setFormKey] = useState(0)

  const handleReset = () => {
    setJobs([])
    setFormKey(k => k + 1)
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#6366f1',
          borderRadius: 8,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        components: {
          Card: { paddingLG: 20 },
          Select: { optionHeight: 36 },
        },
      }}
    >
      <div className="app">
        <header className="app-header">
          <div className="header-inner">
            <div className="header-brand">
              <span className="header-icon">◈</span>
              <span className="header-title">11LabsM</span>
            </div>
            <span className="header-sub">Neural Voice Synthesizer &amp; Translator</span>
          </div>
        </header>

        <main className="app-main">
          <aside className="left-col">
            <JobForm
              key={formKey}
              onJobCreated={id => setJobs(prev => [id, ...prev])}
            />
          </aside>
          <section className="right-col">
            {jobs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎙️</div>
                <p>Your generated audio jobs will appear here</p>
                <small>Fill in the form and click Generate Audio to start</small>
              </div>
            ) : (
              jobs.map(id => <JobStatus key={id} jobId={id} onReset={handleReset} />)
            )}
          </section>
        </main>
      </div>
    </ConfigProvider>
  )
}
