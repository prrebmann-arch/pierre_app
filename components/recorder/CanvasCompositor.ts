export interface CompositingResult {
  canvas: HTMLCanvasElement
  stream: MediaStream
  stop: () => void
}

const BUBBLE_RADIUS = 90       // 180×180 webcam bubble
const BUBBLE_INSET = 16
const BUBBLE_BORDER = 4
const FPS = 30

async function waitForMetadata(video: HTMLVideoElement, timeoutMs = 5000): Promise<void> {
  if (video.readyState >= 1 && video.videoWidth > 0) return
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Video metadata timeout')), timeoutMs)
    const onMeta = () => { clearTimeout(t); video.removeEventListener('loadedmetadata', onMeta); resolve() }
    video.addEventListener('loadedmetadata', onMeta)
  })
}

export async function startCompositing(
  screenStream: MediaStream,
  camStream: MediaStream,
  bubblePosition: { xPct: number; yPct: number } | null = null
): Promise<CompositingResult> {
  const screenVideo = document.createElement('video')
  screenVideo.srcObject = screenStream
  screenVideo.muted = true
  screenVideo.playsInline = true
  await screenVideo.play()
  await waitForMetadata(screenVideo)

  const camVideo = document.createElement('video')
  camVideo.srcObject = camStream
  camVideo.muted = true
  camVideo.playsInline = true
  await camVideo.play()
  await waitForMetadata(camVideo).catch(() => {})  // cam metadata is best-effort

  const canvas = document.createElement('canvas')
  canvas.width = screenVideo.videoWidth
  canvas.height = screenVideo.videoHeight

  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 2d context unavailable')

  const idRef = { current: 0 }
  let stopped = false

  const draw = () => {
    if (stopped) return
    if (screenVideo.readyState >= 2) {
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)

      if (camVideo.readyState >= 2) {
        // Position priority: explicit percent (drag-set) > default bottom-left inset
        let cx: number
        let cy: number
        if (bubblePosition) {
          cx = Math.max(BUBBLE_RADIUS, Math.min(canvas.width - BUBBLE_RADIUS, bubblePosition.xPct * canvas.width))
          cy = Math.max(BUBBLE_RADIUS, Math.min(canvas.height - BUBBLE_RADIUS, bubblePosition.yPct * canvas.height))
        } else {
          cx = BUBBLE_INSET + BUBBLE_RADIUS
          cy = canvas.height - BUBBLE_INSET - BUBBLE_RADIUS
        }

        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, BUBBLE_RADIUS, 0, Math.PI * 2)
        ctx.clip()

        // Draw cam centered & cropped to fill the bubble (cover behavior)
        const camAR = camVideo.videoWidth / camVideo.videoHeight
        let drawW = BUBBLE_RADIUS * 2
        let drawH = BUBBLE_RADIUS * 2
        if (camAR > 1) drawW = drawH * camAR
        else drawH = drawW / camAR
        ctx.drawImage(camVideo, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
        ctx.restore()

        ctx.beginPath()
        ctx.arc(cx, cy, BUBBLE_RADIUS - BUBBLE_BORDER / 2, 0, Math.PI * 2)
        ctx.lineWidth = BUBBLE_BORDER
        ctx.strokeStyle = '#ffffff'
        ctx.stroke()
      }
    }
    idRef.current = requestAnimationFrame(draw)
  }
  idRef.current = requestAnimationFrame(draw)

  const stream = canvas.captureStream(FPS)

  const stop = () => {
    stopped = true
    cancelAnimationFrame(idRef.current)
    screenVideo.srcObject = null
    camVideo.srcObject = null
    screenVideo.remove()
    camVideo.remove()
  }

  return { canvas, stream, stop }
}
