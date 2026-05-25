import type { Voice, Job, CreateJobRequest, CreateJobResponse } from '../types'

// In dev the Vite proxy rewrites /api/* → http://localhost:8000/*
// In Docker  nginx proxies /api/       → http://api:8000/
const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, string>
    throw new Error(data['detail'] ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const getVoices = (): Promise<Voice[]> =>
  request('/voices/')

export const createJob = (body: CreateJobRequest): Promise<CreateJobResponse> =>
  request('/jobs/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export const getJob = (jobId: string): Promise<Job> =>
  request(`/jobs/${jobId}`)

export const getDownloadUrl = (jobId: string): string =>
  `${BASE}/jobs/${jobId}/download`

export const getAudioUrl = (jobId: string, language: string): Promise<{ url: string }> =>
  request(`/jobs/${jobId}/files/${language}/url`)
