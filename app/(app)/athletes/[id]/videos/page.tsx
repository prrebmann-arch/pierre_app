'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPageCache, setPageCache } from '@/lib/utils'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import { MAX_VIDEOS_LOAD } from '@/lib/constants'
import VideosGrid, { type VideoItem } from '@/components/videos/VideosGrid'
import NouveauRetourButton from '@/components/recorder/NouveauRetourButton'
import dynamic from 'next/dynamic'

const VideoDetail = dynamic(() => import('@/components/videos/VideoDetail'), { ssr: false })
import styles from '@/styles/videos.module.css'

type Filter = 'all' | 'a_traiter' | 'traite'
type View = 'grid' | 'detail'

export default function AthleteVideosPage() {
  const params = useParams<{ id: string }>()
  const athleteId = params.id
  const supabase = createClient()

  const cacheKey = `athlete_${athleteId}_videos`
  const [cached] = useState(() => getPageCache<VideoItem[]>(cacheKey))

  const [videos, setVideos] = useState<VideoItem[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  const [filter, setFilter] = useState<Filter>('a_traiter')
  const [view, setView] = useState<View>('grid')
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)

  const loadVideos = useCallback(async () => {
    if (!videos.length) setLoading(true)
    try {
      const { data: vids } = await supabase
        .from('execution_videos')
        .select('id, athlete_id, exercise_name, serie_number, date, status, video_url, thumbnail_url, session_name, session_id, coach_feedback_url, coach_notes, coach_audio_url, created_at')
        .eq('athlete_id', athleteId)
        .order('created_at', { ascending: false })
        .limit(MAX_VIDEOS_LOAD)

      const videoData = (vids || []) as VideoItem[]
      setVideos(videoData)
      setPageCache(cacheKey, videoData)
    } finally {
      setLoading(false)
    }
  }, [athleteId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Push browser history state when entering sub-views
  useEffect(() => {
    if (view !== 'grid') {
      window.history.pushState({ videosView: view }, '')
    }
  }, [view])

  useEffect(() => {
    function handlePopState() {
      if (view !== 'grid') {
        setView('grid')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [view])

  useEffect(() => {
    loadVideos()
  }, [loadVideos])

  useRefetchOnResume(loadVideos, loading)

  const filtered = useMemo(() => {
    if (filter === 'all') return videos
    return videos.filter((v) => v.status === filter)
  }, [videos, filter])

  const pending = videos.filter((v) => v.status === 'a_traiter').length
  const done = videos.filter((v) => v.status === 'traite').length
  const filteredIds = useMemo(() => filtered.map((v) => v.id), [filtered])

  const handleSelectVideo = (id: string) => {
    setSelectedVideoId(id)
    setView('detail')
  }

  const handleBack = () => {
    setView('grid')
    setSelectedVideoId(null)
    loadVideos()
  }

  if (view === 'detail' && selectedVideoId) {
    return (
      <VideoDetail
        videoId={selectedVideoId}
        allVideoIds={filteredIds}
        onBack={handleBack}
        onNavigate={(id) => setSelectedVideoId(id)}
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          Videos d&apos;execution
        </h2>
        <NouveauRetourButton athleteId={athleteId} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <i className="fa-solid fa-spinner fa-spin" />
        </div>
      ) : (
        <>
          <div className={styles.vidFilters}>
            {(['all', 'a_traiter', 'traite'] as Filter[]).map((f) => {
              const label = f === 'all' ? 'Toutes' : f === 'a_traiter' ? 'A traiter' : 'Traites'
              const count = f === 'all' ? videos.length : f === 'a_traiter' ? pending : done
              return (
                <button
                  key={f}
                  className={`${styles.vidFilterBtn} ${f === 'a_traiter' ? styles.vidFilterPending : ''} ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {label} <span className={styles.vidFilterCount}>{count}</span>
                </button>
              )
            })}
          </div>

          <VideosGrid videos={filtered} onSelect={handleSelectVideo} />
        </>
      )}
    </div>
  )
}
