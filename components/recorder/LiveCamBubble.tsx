'use client'

import { useEffect, useRef, useState } from 'react'
import { useRecorder } from '@/contexts/RecorderContext'

const SIZE = 140
const STORAGE_KEY = 'recorder.liveBubblePos'

interface Position { x: number; y: number }

function getDefaultPosition(): Position {
  if (typeof window === 'undefined') return { x: 24, y: 100 }
  return { x: window.innerWidth - SIZE - 24, y: 100 }
}

function loadPosition(): Position {
  if (typeof window === 'undefined') return getDefaultPosition()
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const p = JSON.parse(saved) as Position
      if (typeof p.x === 'number' && typeof p.y === 'number') return p
    }
  } catch {}
  return getDefaultPosition()
}

/**
 * Floating, draggable, in-page webcam preview shown during recording.
 * No click required — visible automatically when recording with webcam.
 * Stream binding uses a callback ref so srcObject is set synchronously
 * on element mount (avoids the "stays black" race vs a useEffect-based
 * binding that runs after the first paint).
 */
export default function LiveCamBubble() {
  const { isRecording, liveCamStream } = useRecorder()
  const [pos, setPos] = useState<Position>(loadPosition)
  const dragRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({ active: false, offsetX: 0, offsetY: 0 })

  useEffect(() => {
    if (typeof window === 'undefined') return
    function clamp() {
      setPos((p) => ({
        x: Math.max(8, Math.min(window.innerWidth - SIZE - 8, p.x)),
        y: Math.max(8, Math.min(window.innerHeight - SIZE - 8, p.y)),
      }))
    }
    window.addEventListener('resize', clamp)
    clamp()
    return () => window.removeEventListener('resize', clamp)
  }, [])

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { active: true, offsetX: e.clientX - pos.x, offsetY: e.clientY - pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current.active) return
    const x = e.clientX - dragRef.current.offsetX
    const y = e.clientY - dragRef.current.offsetY
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - SIZE - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - SIZE - 8, y)),
    })
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)) } catch {}
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
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
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
          // Synchronous bind on mount — useEffect would run after first
          // paint and the video element sometimes shows a black frame
          // until the stream change is re-evaluated.
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
