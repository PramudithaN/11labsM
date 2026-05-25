import { useState } from 'react'
import JobForm from './components/JobForm'
import JobStatus from './components/JobStatus'
import './App.css'

export default function App() {
  const [jobs, setJobs] = useState<string[]>([])

  const handleJobCreated = (jobId: string) =>
    setJobs(prev => [jobId, ...prev])

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <h1>🔊 11LabsM</h1>
          <p>Translate &amp; synthesise speech in 17 languages via ElevenLabs</p>
        </div>
      </header>

      <main className="main">
        <aside className="left-panel">
          <JobForm onJobCreated={handleJobCreated} />
        </aside>

        <section className="right-panel">
          {jobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎙️</div>
              <p>Your generated audio jobs will appear here</p>
              <small>Fill in the form and click Generate Audio to start</small>
            </div>
          ) : (
            jobs.map(id => <JobStatus key={id} jobId={id} />)
          )}
        </section>
      </main>
    </div>
  )
}
