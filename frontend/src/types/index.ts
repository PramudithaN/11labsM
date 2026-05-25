export interface Voice {
  voice_id: string
  name: string
  preview_url: string | null
  labels: Record<string, string>
}

export type AudioStatus = 'pending' | 'generating' | 'complete' | 'failed'
export type JobStatus =
  | 'pending'
  | 'translating'
  | 'processing'
  | 'ready'
  | 'partial'
  | 'failed'

export interface AudioFile {
  id: string
  language: string
  voice_id: string
  file_url: string | null
  status: AudioStatus
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  status: JobStatus
  voice_id: string
  audio_format: string
  created_at: string
  updated_at: string
  audio_files: AudioFile[]
}

export interface CreateJobRequest {
  text: string
  languages: string[]
  voice_id: string
  audio_format: string
}

export interface CreateJobResponse {
  job_id: string
  status: JobStatus
  message: string
}
