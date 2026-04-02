'use client'

import { useEffect, useRef } from 'react'
import styles from '@/styles/videos.module.css'

export interface VideoItem {
  id: string
  athlete_id: string
  exercise_name: string
  serie_number: number
  date: string
  status: 'a_traiter' | 'traite'
  video_url: string | null
  thumbnail_url: string | null
  session_name?: string | null
  coach_feedback_url?: string | null
  coach_notes?: string | null
  coach_audio_url?: string | null
  created_at: string
  _athleteName?: string
}

interface VideosGridProps {
  videos: VideoItem[]
  showAthleteName?: boolean
  onSelect: (videoId: string) => void
}

export default function VideosGrid({ videos, showAthleteName, onSelect }: VideosGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  // Lazy-load video thumbnails via IntersectionObserver
  useEffect(() => {
    if (!gridRef.current) return
    const lazyVideos = gridRef.current.querySelectorAll<HTMLVideoElement>('[data-lazy-src]')
    if (!lazyVideos.length) return

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const vid = entry.target as HTMLVideoElement
          obs.unobserve(vid)

          const tempVid = document.createElement('video')
          tempVid.crossOrigin = 'anonymous'
          tempVid.muted = true
          tempVid.playsInline = true
          tempVid.preload = 'auto'

          tempVid.onloadeddata = () => {
            tempVid.currentTime = 0.5
          }
          tempVid.onseeked = () => {
            try {
              const canvas = document.createElement('canvas')
              canvas.width = tempVid.videoWidth || 320
              canvas.height = tempVid.videoHeight || 180
              const ctx = canvas.getContext('2d')
              ctx?.drawImage(tempVid, 0, 0, canvas.width, canvas.height)
              const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
              const img = document.createElement('img')
              img.src = dataUrl
              img.alt = ''
              img.style.cssText = 'width:100%;height:100%;object-fit:cover;'
              vid.replaceWith(img)
            } catch {
              vid.src = vid.dataset.lazySrc || ''
              vid.preload = 'metadata'
            }
            tempVid.src = ''
            tempVid.load()
          }
          tempVid.onerror = () => {
            vid.src = vid.dataset.lazySrc || ''
            vid.preload = 'metadata'
          }
          tempVid.src = vid.dataset.lazySrc || ''
        })
      },
      { rootMargin: '300px' },
    )

    lazyVideos.forEach((v) => obs.observe(v))
    return () => obs.disconnect()
  }, [videos])

  if (!videos.length) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
        <i
          className="fa-solid fa-video"
          style={{ fontSize: 32, marginBottom: 12, opacity: 0.4, display: 'block' }}
        />
        <div style={{ fontSize: 14 }}>Aucune video</div>
      </div>
    )
  }

  return (
    <div className={styles.vidGrid} ref={gridRef}>
      {videos.map((v) => {
        const date = new Date(v.date + 'T00:00:00').toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
        })
        const isPending = v.status === 'a_traiter'

        let thumbContent
        if (v.thumbnail_url) {
          thumbContent = <img src={v.thumbnail_url} alt="" loading="lazy" />
        } else if (v.video_url) {
          thumbContent = (
            <video
              data-lazy-src={v.video_url}
              muted
              playsInline
              preload="none"
              style={{ pointerEvents: 'none' }}
            />
          )
        } else {
          thumbContent = (
            <div className={styles.vidThumbPlaceholder}>
              <i className={`fa-solid fa-play-circle ${styles.vidThumbPlay}`} />
            </div>
          )
        }

        return (
          <div key={v.id} className={styles.vidCard} onClick={() => onSelect(v.id)}>
            <div className={styles.vidThumb}>
              {thumbContent}
              <span
                className={`${styles.vidBadge} ${isPending ? styles.vidBadgePending : styles.vidBadgeDone}`}
              >
                {isPending ? (
                  <>
                    <i className="fa-solid fa-circle" style={{ fontSize: 6, marginRight: 4 }} /> A
                    traiter
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check" style={{ fontSize: 9, marginRight: 4 }} />{' '}
                    Traite
                  </>
                )}
              </span>
            </div>
            <div className={styles.vidInfo}>
              <div className={styles.vidInfoName}>{v.exercise_name}</div>
              <div className={styles.vidInfoMeta}>
                <span>Serie {v.serie_number}</span>
                <span>{date}</span>
              </div>
              {showAthleteName && v._athleteName && (
                <div className={styles.vidInfoAthlete}>{v._athleteName}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
