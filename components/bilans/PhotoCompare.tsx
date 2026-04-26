'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import styles from '@/styles/bilans.module.css'

export interface PhotoEntry {
  date: string
  url: string
}

export type PhotoType = 'front' | 'side' | 'back'

interface PhotoCompareProps {
  isOpen: boolean
  onClose: () => void
  initialType: PhotoType
  initialDate: string
  photoHistory: Record<PhotoType, PhotoEntry[]>
  athleteName?: string
}

const TYPE_LABELS: Record<PhotoType, string> = { front: 'Face', side: 'Profil', back: 'Dos' }
const TYPE_ICONS: Record<PhotoType, string> = { front: 'fa-user', side: 'fa-user-alt', back: 'fa-user-alt-slash' }

const EXPORT_W = 1080
const EXPORT_H = 1350
const HALF_W = EXPORT_W / 2

const LAYOUT_BUCKET = 'content-drafts'
function layoutPath(userId: string) {
  return `${userId}/instagram-layout.png`
}

function formatPhotoDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

/**
 * Compute the source rectangle (in image-natural coords) currently visible
 * in a TransformWrapper container. Mirrors the CSS transform :
 *   transform: translate(posX, posY) scale(scale)
 * with the inner <img> in object-fit:contain mode inside a (cw, ch) box.
 */
function computeSourceRect(
  imgW: number, imgH: number,
  cw: number, ch: number,
  scale: number, posX: number, posY: number,
) {
  const s0 = Math.min(cw / imgW, ch / imgH) // contain scale
  const renderedW = imgW * s0
  const renderedH = imgH * s0
  const baseX = (cw - renderedW) / 2 // image top-left within wrapper (centered)
  const baseY = (ch - renderedH) / 2
  // container coord 0 maps to wrapped local (-posX/scale, -posY/scale)
  // wrapped local (wx, wy) maps to image (wx - baseX) / s0, (wy - baseY) / s0
  const sxRaw = (-posX / scale - baseX) / s0
  const syRaw = (-posY / scale - baseY) / s0
  const sw = cw / (s0 * scale)
  const sh = ch / (s0 * scale)
  return { sx: sxRaw, sy: syRaw, sw, sh }
}

function drawPhotoTo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cell: HTMLElement,
  state: { scale: number; positionX: number; positionY: number },
  dx: number, dy: number, dw: number, dh: number,
) {
  const cw = cell.clientWidth
  const ch = cell.clientHeight
  const { sx, sy, sw, sh } = computeSourceRect(
    img.naturalWidth, img.naturalHeight,
    cw, ch,
    state.scale, state.positionX, state.positionY,
  )
  // Background fill (in case zoom creates negative source rect / image doesn't fill)
  ctx.fillStyle = '#000'
  ctx.fillRect(dx, dy, dw, dh)
  // drawImage with negative / oversized source clamps automatically only on some browsers.
  // Compute clipped rectangles to be safe.
  const sx2 = sx + sw
  const sy2 = sy + sh
  const cSx = Math.max(0, sx)
  const cSy = Math.max(0, sy)
  const cSx2 = Math.min(img.naturalWidth, sx2)
  const cSy2 = Math.min(img.naturalHeight, sy2)
  if (cSx2 <= cSx || cSy2 <= cSy) return
  const cSw = cSx2 - cSx
  const cSh = cSy2 - cSy
  // Compute corresponding destination region
  const dSx = dx + ((cSx - sx) / sw) * dw
  const dSy = dy + ((cSy - sy) / sh) * dh
  const dSw = (cSw / sw) * dw
  const dSh = (cSh / sh) * dh
  ctx.drawImage(img, cSx, cSy, cSw, cSh, dSx, dSy, dSw, dSh)
}

export default function PhotoCompare({ isOpen, onClose, initialType, initialDate, photoHistory, athleteName }: PhotoCompareProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [type, setType] = useState<PhotoType>(initialType)
  const [leftIdx, setLeftIdx] = useState(0)
  const [rightIdx, setRightIdx] = useState(0)
  const [fading, setFading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [hasLayout, setHasLayout] = useState<boolean | null>(null)

  const leftWrapRef = useRef<ReactZoomPanPinchRef | null>(null)
  const rightWrapRef = useRef<ReactZoomPanPinchRef | null>(null)
  const leftCellRef = useRef<HTMLDivElement | null>(null)
  const rightCellRef = useRef<HTMLDivElement | null>(null)

  // Reset state when opening
  useEffect(() => {
    if (!isOpen) return
    setType(initialType)
    const photos = photoHistory[initialType] || []
    const ri = photos.findIndex(p => p.date === initialDate)
    const rIdx = ri >= 0 ? ri : photos.length - 1
    const lIdx = Math.max(0, rIdx - 1)
    setRightIdx(rIdx)
    setLeftIdx(lIdx)
  }, [isOpen, initialType, initialDate, photoHistory])

  // Check if coach has uploaded a layout
  useEffect(() => {
    if (!isOpen || !user?.id) return
    let cancelled = false
    ;(async () => {
      const { data } = supabase.storage.from(LAYOUT_BUCKET).getPublicUrl(layoutPath(user.id))
      // Test reachability with HEAD
      try {
        const res = await fetch(data.publicUrl, { method: 'HEAD' })
        if (!cancelled) setHasLayout(res.ok)
      } catch {
        if (!cancelled) setHasLayout(false)
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, user?.id, supabase])

  const photos = photoHistory[type] || []

  const navigate = useCallback((dir: number) => {
    setFading(true)
    setTimeout(() => {
      setLeftIdx(prev => {
        const newIdx = prev + dir
        if (newIdx < 0 || newIdx > rightIdx) return prev
        return newIdx
      })
      setFading(false)
      // Reset zoom on photo change
      leftWrapRef.current?.resetTransform()
    }, 150)
  }, [rightIdx])

  const switchType = useCallback((newType: PhotoType) => {
    const newPhotos = photoHistory[newType] || []
    if (!newPhotos.length) return
    const currentDate = photos[rightIdx]?.date
    let ri = newPhotos.findIndex(p => p.date === currentDate)
    if (ri < 0) ri = newPhotos.length - 1
    const li = Math.min(leftIdx, ri > 0 ? ri - 1 : 0)
    setType(newType)
    setRightIdx(ri)
    setLeftIdx(li)
    leftWrapRef.current?.resetTransform()
    rightWrapRef.current?.resetTransform()
  }, [photoHistory, photos, rightIdx, leftIdx])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') navigate(-1)
      if (e.key === 'ArrowRight') navigate(1)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose, navigate])

  const handleExport = async () => {
    if (exporting) return
    const leftPhoto = photos[leftIdx]
    const rightPhoto = photos[rightIdx]
    const leftCell = leftCellRef.current
    const rightCell = rightCellRef.current
    if (!leftPhoto || !rightPhoto || !leftCell || !rightCell) {
      toast('Photos non disponibles', 'error')
      return
    }
    setExporting(true)
    try {
      // Load both photos as image elements (with CORS so we can drawImage them)
      const [leftImg, rightImg] = await Promise.all([
        loadImage(leftPhoto.url),
        loadImage(rightPhoto.url),
      ])

      // Try to load layout
      let layoutImg: HTMLImageElement | null = null
      if (user?.id) {
        const { data } = supabase.storage.from(LAYOUT_BUCKET).getPublicUrl(layoutPath(user.id))
        try {
          // Cache-bust to grab latest upload
          layoutImg = await loadImage(`${data.publicUrl}?t=${Date.now()}`)
        } catch {
          layoutImg = null
        }
      }

      // Build canvas
      const canvas = document.createElement('canvas')
      canvas.width = EXPORT_W
      canvas.height = EXPORT_H
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, EXPORT_W, EXPORT_H)

      const leftState = leftWrapRef.current?.state ?? { scale: 1, positionX: 0, positionY: 0 }
      const rightState = rightWrapRef.current?.state ?? { scale: 1, positionX: 0, positionY: 0 }

      drawPhotoTo(ctx, leftImg, leftCell, leftState, 0, 0, HALF_W, EXPORT_H)
      drawPhotoTo(ctx, rightImg, rightCell, rightState, HALF_W, 0, HALF_W, EXPORT_H)

      if (layoutImg) {
        ctx.drawImage(layoutImg, 0, 0, EXPORT_W, EXPORT_H)
      }

      // Export
      canvas.toBlob((blob) => {
        if (!blob) {
          toast('Échec de l\'export', 'error')
          setExporting(false)
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const safeName = (athleteName || 'athlete').replace(/[^\w-]+/g, '_')
        a.href = url
        a.download = `comparaison_${safeName}_${rightPhoto.date}.jpg`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast('Export Instagram téléchargé !', 'success')
        setExporting(false)
      }, 'image/jpeg', 0.95)
    } catch (e) {
      console.error('[PhotoCompare] export error', e)
      toast(`Erreur export: ${e instanceof Error ? e.message : String(e)}`, 'error')
      setExporting(false)
    }
  }

  if (!isOpen || typeof document === 'undefined') return null
  if (!photos.length) return null

  const leftPhoto = photos[leftIdx]
  const rightPhoto = photos[rightIdx]

  return createPortal(
    <div
      className={styles.pcOverlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.pcViewer}>
        {/* Header */}
        <div className={styles.pcHeader}>
          <div className={styles.pcTabs}>
            {(['front', 'side', 'back'] as PhotoType[]).map(t => {
              const hasPhotos = (photoHistory[t] || []).length > 0
              if (!hasPhotos) return null
              return (
                <button
                  key={t}
                  className={`${styles.pcTab} ${t === type ? styles.pcTabActive : ''}`}
                  onClick={() => switchType(t)}
                >
                  <i className={`fas ${TYPE_ICONS[t]}`} />
                  {TYPE_LABELS[t]}
                </button>
              )
            })}
          </div>
          <div className={styles.pcHeaderRight}>
            <button
              className={styles.pcExportBtn}
              onClick={handleExport}
              disabled={exporting}
              title={hasLayout === false ? 'Aucun layout Instagram configuré dans tes paramètres — l\'export se fera sans overlay' : 'Exporter au format Instagram (1080×1350)'}
            >
              <i className={`fas ${exporting ? 'fa-spinner fa-spin' : 'fa-down-to-bracket'}`} />
              {exporting ? 'Export…' : 'Export Instagram'}
            </button>
            <button className={styles.pcClose} onClick={onClose}>
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.pcBody}>
          {/* Left side (comparison) */}
          <div className={styles.pcSide}>
            <button
              className={`${styles.pcNav} ${styles.pcNavPrev}`}
              onClick={() => navigate(-1)}
              disabled={leftIdx <= 0}
            >
              <i className="fas fa-chevron-left" />
            </button>
            <div className={styles.pcCellWrap}>
              <div ref={leftCellRef} className={`${styles.pcCell} ${fading ? styles.pcImgFade : ''}`}>
                <TransformWrapper
                  ref={leftWrapRef}
                  initialScale={1}
                  minScale={1}
                  maxScale={5}
                  centerOnInit
                  doubleClick={{ disabled: false, mode: 'reset' }}
                  wheel={{ step: 0.1 }}
                >
                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
                    {leftPhoto && (
                      <img
                        src={leftPhoto.url}
                        alt={`${TYPE_LABELS[type]} - ${leftPhoto.date}`}
                        crossOrigin="anonymous"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
                        draggable={false}
                      />
                    )}
                  </TransformComponent>
                </TransformWrapper>
                <button
                  className={styles.pcResetBtn}
                  onClick={() => leftWrapRef.current?.resetTransform()}
                  title="Réinitialiser le zoom"
                >
                  <i className="fas fa-arrows-rotate" />
                </button>
              </div>
              {leftPhoto && <div className={styles.pcDate}>{formatPhotoDate(leftPhoto.date)}</div>}
            </div>
            <button
              className={`${styles.pcNav} ${styles.pcNavNext}`}
              onClick={() => navigate(1)}
              disabled={leftIdx >= rightIdx}
            >
              <i className="fas fa-chevron-right" />
            </button>
          </div>

          <div className={styles.pcDivider} />

          {/* Right side (current) */}
          <div className={styles.pcSide}>
            <div className={styles.pcCellWrap}>
              <div ref={rightCellRef} className={styles.pcCell}>
                <TransformWrapper
                  ref={rightWrapRef}
                  initialScale={1}
                  minScale={1}
                  maxScale={5}
                  centerOnInit
                  doubleClick={{ disabled: false, mode: 'reset' }}
                  wheel={{ step: 0.1 }}
                >
                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
                    {rightPhoto && (
                      <img
                        src={rightPhoto.url}
                        alt={`${TYPE_LABELS[type]} - ${rightPhoto.date}`}
                        crossOrigin="anonymous"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
                        draggable={false}
                      />
                    )}
                  </TransformComponent>
                </TransformWrapper>
                <button
                  className={styles.pcResetBtn}
                  onClick={() => rightWrapRef.current?.resetTransform()}
                  title="Réinitialiser le zoom"
                >
                  <i className="fas fa-arrows-rotate" />
                </button>
                <div className={styles.pcBadgeCurrent}>ACTUEL</div>
              </div>
              {rightPhoto && <div className={styles.pcDate}>{formatPhotoDate(rightPhoto.date)}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
