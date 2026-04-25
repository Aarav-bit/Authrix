import { create } from 'zustand'

export type AppState = 'idle' | 'loading' | 'result' | 'error'
export type Verdict = 'FAKE' | 'REAL' | null

export interface FramePoint { frame: number; fake_pct: number }
export interface AudioResult {
  available: boolean
  result: string
  confidence: number
  fake_probability: number
  model_score: number
  heuristic_score: number
  details: string[]
  features: Record<string, number>
}
export interface AnalysisResult {
  result: 'FAKE' | 'REAL'
  confidence: number
  details: string[]
  frame_timeline: FramePoint[]
  metadata: {
    frames_analyzed: number
    frames_with_faces: number
    video_duration_sec: number
    video_fps: number
    resolution: string
  }
  processing_time_sec: number
  audio: AudioResult
}

interface Store {
  state: AppState
  file: File | null
  result: AnalysisResult | null
  error: string | null
  agentStep: number
  setState: (s: AppState) => void
  setFile: (f: File | null) => void
  setResult: (r: AnalysisResult) => void
  setError: (e: string) => void
  setAgentStep: (n: number) => void
  reset: () => void
}

export const useStore = create<Store>((set) => ({
  state: 'idle',
  file: null,
  result: null,
  error: null,
  agentStep: -1,
  setState: (state) => set({ state }),
  setFile: (file) => set({ file }),
  setResult: (result) => set({ result, state: 'result' }),
  setError: (error) => set({ error, state: 'error' }),
  setAgentStep: (agentStep) => set({ agentStep }),
  reset: () => set({ state: 'idle', file: null, result: null, error: null, agentStep: -1 }),
}))
