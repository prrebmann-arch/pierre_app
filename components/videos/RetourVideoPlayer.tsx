'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import styles from './RetourVideoPlayer.module.css'

interface Props {
  retourId: string
  archived?: boolean
}

interface SignedUrls {
  videoUrl: string
  thumbnailUrl: string
  expiresAt: string
}

const SPEEDS = [1, 1.5, 2]

export default function RetourVideoPlayer({ retourId, archived }: Props) {
  const auth = useAuth() as { accessToken?: string | null }
  const videoRef = useRef<HTMLVideoElement>(null)
  const [urls, setUrls] = useState<SignedUrls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speed, setSpeed] = useState<number>(1)

  useEffect(() => {
    if (archived) return
    if (!auth.accessToken) return  // wait for auth context to provide token
    let cancelled = false

    async function fetchUrls() {
      try {
        const res = await fetch(`/api/videos/retour-signed-url?id=${encodeURIComponent(retourId)}`, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        })
        if (!res.ok) {
          const body = await res.text()
          if (!cancelled) setError(`Erreur ${res.status}: ${body}`)
          return
        }
        const json = await res.json() as SignedUrls
        if (!cancelled) setUrls(json)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur inconnue')
      }
    }

    fetchUrls()
    return () => { cancelled = true }
  }, [retourId, archived, auth.accessToken])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed
  }, [speed, urls])

  if (archived) {
    return <div className={styles.archived}>
      <i className="fas fa-archive" /> Vidéo archivée (plus de 30 jours)
    </div>
  }

  if (error) {
    return <div className={styles.archived}>{error}</div>
  }

  if (!urls) {
    return <div className={styles.archived}>Chargement…</div>
  }

  return (
    <div className={styles.wrapper}>
      <video
        ref={videoRef}
        className={styles.video}
        src={urls.videoUrl}
        poster={urls.thumbnailUrl}
        controls
        playsInline
        preload="metadata"
      />
      <div className={styles.controls}>
        {SPEEDS.map(s => (
          <button
            key={s}
            className={`${styles.speedBtn} ${speed === s ? styles.speedBtnActive : ''}`}
            onClick={() => setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}
