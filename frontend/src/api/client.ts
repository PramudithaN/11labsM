import type { Voice, Job, CreateJobRequest, CreateJobResponse } from '../types'

// In dev: Vite proxy rewrites /api/* → http://localhost:8000/*
// In production (Vercel): set VITE_API_BASE_URL=https://your-backend.com in Vercel env vars
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

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

export const getAudioStreamUrl = (jobId: string, language: string): string =>
  `${BASE}/jobs/${jobId}/files/${language}/stream`
