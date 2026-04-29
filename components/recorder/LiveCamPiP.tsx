'use client'

import { useEffect, useRef, useState } from 'react'
import { useRecorder } from '@/contexts/RecorderContext'

/**
 * Renders a hidden <video> bound to the live cam stream and auto-requests
 * Picture-in-Picture so the user sees themselves throughout the recording.
 *
 * PiP is OS-level — its window floats above the browser and is NOT captured
 * by getDisplayMedia, so the live preview doesn't pollute the recording.
 */
export default function LiveCamPiP() {
  const { isRecording, liveCamStream } = useRecorder()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [pipFailed, setPipFailed] = useState(false)

  // Bind stream
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (liveCamStream && v.srcObject !== liveCamStream) {
      v.srcObject = liveCamStream
      v.play().catch(() => {})
    } else if (!liveCamStream && v.srcObject) {
      v.srcObject = null
    }
  }, [liveCamStream])

  // Auto-request PiP when recording starts with a cam stream
  useEffect(() => {
    if (!isRecording || !liveCamStream) return
    const v = videoRef.current
    if (!v) return
    // Wait for metadata before PiP
    let cancelled = false
    const tryPip = async () => {
      try {
        if (v.readyState < 1) {
          await new Promise<void>((resolve) => {
            const onMeta = () => { v.removeEventListener('loadedmetadata', onMeta); resolve() }
            v.addEventListener('loadedmetadata', onMeta)
          })
        }
        if (cancelled) return
        // Some browsers need play() to have happened first
        if (v.paused) await v.play().catch(() => {})
        if (cancelled) return
        if (typeof v.requestPictureInPicture === 'function' && document.pictureInPictureEnabled) {
          await v.requestPictureInPicture()
        } else {
          setPipFailed(true)
        }
      } catch {
        if (!cancelled) setPipFailed(true)
      }
    }
    void tryPip()
    return () => { cancelled = true }
  }, [isRecording, liveCamStream])

  // Exit PiP when recording stops
  useEffect(() => {
    if (isRecording) return
    if (typeof document === 'undefined') return
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {})
    }
  }, [isRecording])

  // PiP fallback: small in-page preview (best effort — will appear in
  // recording if user shares the same tab, but better than nothing if PiP
  // is unsupported).
  if (!isRecording || !liveCamStream) return null

  return (
    <>
      {/* Hidden video that hosts the PiP. Must be in DOM with playing media. */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', bottom: 0, right: 0 }}
      />
      {pipFailed && (
        <div
          style={{
            position: 'fixed',
            bottom: 84,
            right: 24,
            zIndex: 9998,
            width: 140,
            height: 140,
            borderRadius: '50%',
            overflow: 'hidden',
            background: '#000',
            border: '3px solid #ff3b3b',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          }}
        >
          <video
            autoPlay
            muted
            playsInline
            ref={(el) => {
              if (el && liveCamStream && el.srcObject !== liveCamStream) {
                el.srcObject = liveCamStream
                el.play().catch(() => {})
              }
            }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
        </div>
      )}
    </>
  )
}
