/**
 * Authrix Extension — Offscreen Document
 *
 * Offscreen documents can use getUserMedia with chromeMediaSource:'tab',
 * which is NOT available in content scripts or service workers in MV3.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'RECORD_OFFSCREEN') {
    startRecording(msg.streamId, msg.durationMs, msg.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

let activeRecorder = null;

async function startRecording(streamId, durationMs, tabId) {
  if (activeRecorder && activeRecorder.state === 'recording') {
    activeRecorder.stop();
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
  });

  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 5_000_000,  // Increased from 2.5Mbps for better quality
  });
  activeRecorder = recorder;

  const chunks = [];
  recorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());

    try {
      const blob = new Blob(chunks, { type: mimeType });
      
      // Convert blob to ArrayBuffer (more reliable than base64 for large files)
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Chunk into 1MB pieces to avoid message size limits
      const CHUNK_SIZE = 1024 * 1024; // 1MB
      const totalChunks = Math.ceil(uint8Array.length / CHUNK_SIZE);
      const chunkedData = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, uint8Array.length);
        const chunk = uint8Array.slice(start, end);
        // Convert to regular array for JSON serialization
        chunkedData.push(Array.from(chunk));
      }

      chrome.runtime.sendMessage({
        type: 'BLOB_READY',
        chunks: chunkedData,
        mimeType,
        tabId,
        totalSize: uint8Array.length,
      });
    } catch (err) {
      chrome.runtime.sendMessage({
        type:  'RECORD_ERROR',
        error: err.message,
        tabId,
      });
    }
  };

  recorder.onerror = e => {
    chrome.runtime.sendMessage({
      type:  'RECORD_ERROR',
      error: e.error?.message || 'MediaRecorder error',
      tabId,
    });
  };

  recorder.start(1000);

  setTimeout(() => {
    if (recorder.state === 'recording') recorder.stop();
  }, durationMs);

  // Progress ticks
  const startTime = Date.now();
  const tick = setInterval(() => {
    if (recorder.state !== 'recording') { clearInterval(tick); return; }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const total   = Math.round(durationMs / 1000);
    chrome.runtime.sendMessage({ type: 'RECORD_PROGRESS', elapsed, total, tabId });
  }, 800);
}

function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
}
