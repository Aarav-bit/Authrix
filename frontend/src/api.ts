import type { AnalysisResult } from './store'

const BASE = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin

export async function analyzeVideo(file: File): Promise<AnalysisResult> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${BASE}/analyze`, { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).detail || `Server error ${res.status}`)
  }
  return res.json()
}

export async function checkHealth(): Promise<{ status: string; model: string; ready: boolean }> {
  const res = await fetch(`${BASE}/health`)
  if (!res.ok) throw new Error('Server offline')
  return res.json()
}
