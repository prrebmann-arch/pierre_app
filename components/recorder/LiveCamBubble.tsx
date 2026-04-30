'use client'

import { useEffect, useRef, useState } from 'react'
import { useRecorder } from '@/contexts/RecorderContext'

const CIRCLE_SIZE = 140
const PORTRAIT_W = 144
const PORTRAIT_H = 256
const STORAGE_KEY_CIRCLE = 'recorder.liveBubblePos'
const STORAGE_KEY_PORTRAIT = 'recorder.liveSelfiePos'

interface Position { x: number; y: number }

function getDefaultPosition(w: number, h: number): Position {
  if (typeof window === 'undefined') return { x: 24, y: 100 }
  return { x: window.innerWidth - w - 24, y: 100 }
}

function loadPosition(key: string, w: number, h: number): Position {
  if (typeof window === 'undefined') return getDefaultPosition(w, h)
  try {
    const saved = window.localStorage.getItem(key)
    if (saved) {
      const p = JSON.parse(saved) as Position
      if (typeof p.x === 'number' && typeof p.y === 'number') return p
    }
  } catch {}
  return getDefaultPosition(w, h)
}

/**
 * Floating, draggable, in-page webcam preview shown during recording.
 * - In screen mode (`liveMode === 'screen'`): small circle, draggable, classic Loom-style overlay.
 * - In selfie mode (`liveMode === 'selfie'`): portrait 9:16 panel anchored top-right by default,
 *   so the coach sees themselves while the cam is being recorded.
 *
 * Stream binding uses a callback ref so srcObject is set synchronously on element mount
 * (avoids the "stays black" race vs a useEffect-based binding that runs after the first paint).
 */
export default function LiveCamBubble() {
  const { isRecording, liveCamStream, liveMode } = useRecorder()
  const isPortrait = liveMode === 'selfie'
  const w = isPortrait ? PORTRAIT_W : CIRCLE_SIZE
  const h = isPortrait ? PORTRAIT_H : CIRCLE_SIZE
  const storageKey = isPortrait ? STORAGE_KEY_PORTRAIT : STORAGE_KEY_CIRCLE

  const [pos, setPos] = useState<Position>(() => loadPosition(storageKey, w, h))
  const dragRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({ active: false, offsetX: 0, offsetY: 0 })

  // When mode flips, re-load the corresponding stored position
  useEffect(() => {
    setPos(loadPosition(storageKey, w, h))
  }, [storageKey, w, h])

  useEffect(() => {
    if (typeof window === 'undefined') return
    function clamp() {
      setPos((p) => ({
        x: Math.max(8, Math.min(window.innerWidth - w - 8, p.x)),
        y: Math.max(8, Math.min(window.innerHeight - h - 8, p.y)),
      }))
    }
    window.addEventListener('resize', clamp)
    clamp()
    return () => window.removeEventListener('resize', clamp)
  }, [w, h])

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { active: true, offsetX: e.clientX - pos.x, offsetY: e.clientY - pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current.active) return
    const x = e.clientX - dragRef.current.offsetX
    const y = e.clientY - dragRef.current.offsetY
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - w - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - h - 8, y)),
    })
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
    try { window.localStorage.setItem(storageKey, JSON.stringify(pos)) } catch {}
  }

  if (!isRecording || !liveCamStream) return null

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: w,
        height: h,
        borderRadius: isPortrait ? 14 : '50%',
        overflow: 'hidden',
        background: '#000',
        border: '3px solid #ff3b3b',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        zIndex: 9998,
        cursor: dragRef.current.active ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
      title="Glisse pour déplacer"
    >
      <video
        ref={(el) => {
          if (el && liveCamStream && el.srcObject !== liveCamStream) {
            el.srcObject = liveCamStream
            el.play().catch(() => {})
          }
        }}
        autoPlay
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
