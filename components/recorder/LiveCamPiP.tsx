'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [pipActive, setPipActive] = useState(false)
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

  const requestPip = useCallback(async () => {
    const v = videoRef.current
    if (!v) return
    setPipFailed(false)
    try {
      if (v.readyState < 1) {
        await new Promise<void>((resolve) => {
          const onMeta = () => { v.removeEventListener('loadedmetadata', onMeta); resolve() }
          v.addEventListener('loadedmetadata', onMeta)
        })
      }
      if (v.paused) await v.play().catch(() => {})
      if (typeof v.requestPictureInPicture === 'function' && document.pictureInPictureEnabled) {
        await v.requestPictureInPicture()
        setPipActive(true)
      } else {
        setPipFailed(true)
      }
    } catch {
      setPipFailed(true)
    }
  }, [])

  // Auto-request PiP when recording starts with a cam stream
  useEffect(() => {
    if (!isRecording || !liveCamStream) return
    let cancelled = false
    void (async () => {
      if (cancelled) return
      await requestPip()
    })()
    return () => { cancelled = true }
  }, [isRecording, liveCamStream, requestPip])

  // Listen for PiP enter/leave events to track UI state accurately
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onEnter = () => setPipActive(true)
    const onLeave = () => setPipActive(false)
    v.addEventListener('enterpictureinpicture', onEnter)
    v.addEventListener('leavepictureinpicture', onLeave)
    return () => {
      v.removeEventListener('enterpictureinpicture', onEnter)
      v.removeEventListener('leavepictureinpicture', onLeave)
    }
  }, [liveCamStream])

  // Exit PiP when recording stops
  useEffect(() => {
    if (isRecording) return
    if (typeof document === 'undefined') return
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {})
    }
  }, [isRecording])

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

      {/* Manual re-PiP button shown when PiP is not active */}
      {!pipActive && (
        <button
          onClick={requestPip}
          style={{
            position: 'fixed',
            bottom: 84,
            right: 24,
            zIndex: 9998,
            padding: '8px 14px',
            background: '#1f1f1f',
            color: '#fff',
            border: '1px solid #ff3b3b',
            borderRadius: 999,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
          title="Activer la fenêtre webcam flottante (ne sera pas capturée par l'enregistrement)"
        >
          <i className="fas fa-external-link-alt" />
          {pipFailed ? 'Activer ma webcam (PiP)' : 'Re-afficher webcam'}
        </button>
      )}

      {/* Last-resort fallback: in-page preview shown only if user explicitly
          gives up on PiP (closed it twice). Will appear in recording if
          sharing the same tab. */}
      {pipFailed && (
        <div
          style={{
            position: 'fixed',
            bottom: 140,
            right: 24,
            zIndex: 9997,
            width: 120,
            height: 120,
            borderRadius: '50%',
            overflow: 'hidden',
            background: '#000',
            border: '3px solid #ff3b3b',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          }}
          title="Fallback in-page (visible dans l'enregistrement si tu partages cet onglet)"
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
