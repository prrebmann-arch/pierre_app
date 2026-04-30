'use client'

import { useEffect, useRef } from 'react'
import { useRecorder } from '@/contexts/RecorderContext'

/**
 * Persistent <video> bound to the live cam stream during recording.
 * The element is ALWAYS in DOM (not gated on isRecording) so the modal
 * can trigger PiP on it from a real user gesture before closing.
 *
 * Modal calls `enterPipWithStream(previewStream)` on click → PiP opens.
 * Once recording starts, srcObject swaps to the recorder's live stream.
 * On stop: PiP exits and srcObject detaches.
 */
export default function LiveCamPiP() {
  const { isRecording, liveCamStream, registerPipVideo } = useRecorder()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    registerPipVideo(videoRef.current)
    return () => registerPipVideo(null)
  }, [registerPipVideo])

  // Sync srcObject with the recorder's live stream during recording
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (liveCamStream && v.srcObject !== liveCamStream) {
      v.srcObject = liveCamStream
      v.play().catch(() => {})
    }
  }, [liveCamStream])

  // On stop: exit PiP and detach
  useEffect(() => {
    if (isRecording) return
    if (typeof document === 'undefined') return
    if (document.pictureInPictureElement === videoRef.current) {
      document.exitPictureInPicture().catch(() => {})
    }
    const v = videoRef.current
    if (v && !liveCamStream && v.srcObject) {
      v.srcObject = null
    }
  }, [isRecording, liveCamStream])

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{
        position: 'fixed',
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
        bottom: 0,
        right: 0,
        zIndex: -1,
      }}
    />
  )
}
