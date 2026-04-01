'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MAX_VIDEOS_LOAD } from '@/lib/constants'
import VideosGrid, { type VideoItem } from '@/components/videos/VideosGrid'
import VideoDetail from '@/components/videos/VideoDetail'
import styles from '@/styles/videos.module.css'

type Filter = 'all' | 'a_traiter' | 'traite'
type View = 'grid' | 'detail'

export default function AthleteVideosPage() {
  const params = useParams<{ id: string }>()
  const athleteId = params.id
  const supabase = createClient()

  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('a_traiter')
  const [view, setView] = useState<View>('grid')
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)

  const loadVideos = useCallback(async () => {
    setLoading(true)
    const { data: vids } = await supabase
      .from('execution_videos')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false })
      .limit(MAX_VIDEOS_LOAD)

    setVideos((vids || []) as VideoItem[])
    setLoading(false)
  }, [athleteId, supabase])

  useEffect(() => {
    loadVideos()
  }, [loadVideos])

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
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        Videos d&apos;execution
      </h2>

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
