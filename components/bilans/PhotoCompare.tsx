'use client'

import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
}

const TYPE_LABELS: Record<PhotoType, string> = { front: 'Face', side: 'Profil', back: 'Dos' }
const TYPE_ICONS: Record<PhotoType, string> = { front: 'fa-user', side: 'fa-user-alt', back: 'fa-user-alt-slash' }

function formatPhotoDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PhotoCompare({ isOpen, onClose, initialType, initialDate, photoHistory }: PhotoCompareProps) {
  const [type, setType] = useState<PhotoType>(initialType)
  const [leftIdx, setLeftIdx] = useState(0)
  const [rightIdx, setRightIdx] = useState(0)
  const [fading, setFading] = useState(false)

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
          <button className={styles.pcClose} onClick={onClose}>
            <i className="fas fa-times" />
          </button>
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
            <div className={styles.pcImgWrap}>
              {leftPhoto && (
                <>
                  <img
                    src={leftPhoto.url}
                    alt={`${TYPE_LABELS[type]} - ${leftPhoto.date}`}
                    className={fading ? styles.pcImgFade : ''}
                  />
                  <div className={styles.pcDate}>{formatPhotoDate(leftPhoto.date)}</div>
                </>
              )}
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
            <div className={styles.pcImgWrap}>
              {rightPhoto && (
                <>
                  <img
                    src={rightPhoto.url}
                    alt={`${TYPE_LABELS[type]} - ${rightPhoto.date}`}
                  />
                  <div className={styles.pcDate}>{formatPhotoDate(rightPhoto.date)}</div>
                </>
              )}
            </div>
            <div className={styles.pcBadgeCurrent}>ACTUEL</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
