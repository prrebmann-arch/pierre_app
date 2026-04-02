'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { MAX_VIDEOS_LOAD } from '@/lib/constants'
import VideosGrid, { type VideoItem } from '@/components/videos/VideosGrid'
import VideoDetail from '@/components/videos/VideoDetail'
import styles from '@/styles/videos.module.css'

type Filter = 'all' | 'a_traiter' | 'traite'
type View = 'grid' | 'detail'

export default function VideosPage() {
  const supabase = createClient()
  const { user } = useAuth()

  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('a_traiter')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('grid')
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)

  const loadVideos = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data: athletes } = await supabase
        .from('athletes')
        .select('id, prenom, nom, user_id')
        .eq('coach_id', user.id)

      const athleteIds = (athletes || []).map((a) => a.id)
      if (!athleteIds.length) {
        setVideos([])
        return
      }

      const { data: vids } = await supabase
        .from('execution_videos')
        .select('*')
        .in('athlete_id', athleteIds)
        .order('created_at', { ascending: false })
        .limit(MAX_VIDEOS_LOAD)

      const athleteMap: Record<string, { prenom: string; nom: string }> = {}
      ;(athletes || []).forEach((a) => {
        athleteMap[a.id] = a
      })

      setVideos(
        (vids || []).map((v) => ({
          ...v,
          _athleteName: athleteMap[v.athlete_id]
            ? `${athleteMap[v.athlete_id].prenom} ${athleteMap[v.athlete_id].nom}`
            : '',
        })) as VideoItem[],
      )
    } finally {
      setLoading(false)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadVideos()
  }, [loadVideos])

  const filtered = useMemo(() => {
    let list = videos
    if (filter !== 'all') {
      list = list.filter((v) => v.status === filter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (v) =>
          v.exercise_name?.toLowerCase().includes(q) ||
          v._athleteName?.toLowerCase().includes(q),
      )
    }
    return list
  }, [videos, filter, search])

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
    loadVideos() // refresh in case status changed
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
      <div className="page-header">
        <h1 className="page-title">Videos d&apos;execution</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x" />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
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
            <input
              type="text"
              placeholder="Rechercher un athlete..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'var(--bg2)',
                border: 'var(--card-border)',
                borderRadius: 20,
                padding: '8px 16px',
                fontSize: 13,
                color: 'var(--text)',
                outline: 'none',
                width: 200,
              }}
            />
          </div>

          <VideosGrid videos={filtered} showAthleteName onSelect={handleSelectVideo} />
        </>
      )}
    </div>
  )
}
