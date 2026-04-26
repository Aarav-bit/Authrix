export interface FrameScore {
  frame: number;
  fake_pct: number;
}

export interface AudioResult {
  available: boolean;
  result: 'HUMAN_VOICE' | 'AI_VOICE' | 'AV_MISMATCH' | 'NO_AUDIO';
  confidence: number;
  fake_probability: number;
}

export interface MetadataCheck {
  ai_generated: boolean;
  c2pa_detected: boolean;
  tool_detected: string | null;
}

export interface VideoMetadata {
  frames_analyzed: number;
  frames_with_faces: number;
  video_duration_sec: number;
  video_fps: number;
  resolution: string;
}

export interface AnalysisResult {
  result: 'FAKE' | 'REAL';
  confidence: number;
  details: string[];
  frame_timeline: FrameScore[];
  metadata: VideoMetadata;
  audio: AudioResult;
  metadata_check: MetadataCheck;
  processing_time_sec: number;
  cached: boolean;
}

export type AppState = 'hero' | 'upload' | 'processing' | 'result' | 'error';
