'use client'

const METADATA_TIMEOUT_MS = 5000
const SEEK_TIMEOUT_MS = 5000

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ])
}

/**
 * Extract a single JPEG frame from a video Blob, client-side.
 * Used to generate poster thumbnails without server-side ffmpeg.
 */
export async function extractThumbnail(videoBlob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(videoBlob)
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'

  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('Failed to load video metadata for thumbnail'))
      }),
      METADATA_TIMEOUT_MS,
      'Thumbnail metadata timeout',
    )

    const targetTime = Math.min(1, (video.duration || 2) / 2)
    video.currentTime = targetTime

    await withTimeout(
      new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve()
        video.onerror = () => reject(new Error('Failed to seek video for thumbnail'))
      }),
      SEEK_TIMEOUT_MS,
      'Thumbnail seek timeout',
    )

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2d context unavailable')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/jpeg', 0.7)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
