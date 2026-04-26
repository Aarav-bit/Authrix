// In dev: uses Vite proxy (localhost:8000)
// In production (Vercel): uses VITE_API_URL env var pointing to HF Space
export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';
