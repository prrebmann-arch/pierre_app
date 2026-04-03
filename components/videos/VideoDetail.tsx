'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { notifyAthlete } from '@/lib/push'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import VideoCompare from './VideoCompare'
import styles from '@/styles/videos.module.css'

interface VideoRow {
  id: string
  athlete_id: string
  exercise_name: string
  serie_number: number
  date: string
  status: string
  video_url: string | null
  thumbnail_url: string | null
  session_name?: string | null
  session_id?: string | null
  coach_feedback_url?: string | null
  coach_notes?: string | null
  coach_audio_url?: string | null
}

interface AthleteRow {
  id: string
  prenom: string
  nom: string
  user_id: string | null
}

interface CompVideo {
  id: string
  video_url: string
  thumbnail_url: string | null
  date: string
  serie_number: number
}

interface VideoDetailProps {
  videoId: string
  allVideoIds: string[]
  onBack: () => void
  onNavigate: (videoId: string) => void
}

export default function VideoDetail({ videoId, allVideoIds, onBack, onNavigate }: VideoDetailProps) {
  const supabase = createClient()
  const { user } = useAuth()
  const { toast } = useToast()

  const [video, setVideo] = useState<VideoRow | null>(null)
  const [athlete, setAthlete] = useState<AthleteRow | null>(null)
  const [compVideos, setCompVideos] = useState<CompVideo[]>([])
  const [compIdx, setCompIdx] = useState(-1)
  const [showCompare, setShowCompare] = useState(false)
  const [feedbackUrl, setFeedbackUrl] = useState('')
  const [feedbackNotes, setFeedbackNotes] = useState('')
  const [markTreated, setMarkTreated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const mainVideoRef = useRef<HTMLVideoElement>(null)

  const {
    isRecording,
    seconds,
    audioUrl: newAudioUrl,
    startRecording,
    stopRecording,
    clearAudio,
    uploading: audioUploading,
  } = useAudioRecorder({
    pathPrefix: user ? `${user.id}/${videoId}_` : '',
  })

  const [existingAudioUrl, setExistingAudioUrl] = useState<string | null>(null)
  const effectiveAudioUrl = newAudioUrl || existingAudioUrl

  const loadVideo = useCallback(async () => {
    setLoading(true)
    try {
      const { data: vid } = await supabase
        .from('execution_videos')
        .select('id, athlete_id, exercise_name, serie_number, date, status, video_url, thumbnail_url, session_name, session_id, coach_feedback_url, coach_notes, coach_audio_url, created_at')
        .eq('id', videoId)
        .single()

      if (!vid) {
        toast('Video introuvable', 'error')
        return
      }

      setVideo(vid)
      setFeedbackUrl(vid.coach_feedback_url || '')
      setFeedbackNotes(vid.coach_notes || '')
      setMarkTreated(vid.status === 'traite')
      setExistingAudioUrl(vid.coach_audio_url || null)

      const { data: ath } = await supabase
        .from('athletes')
        .select('id, prenom, nom, user_id')
        .eq('id', vid.athlete_id)
        .single()
      setAthlete(ath || null)

      // Previous videos of same exercise for comparison
      const { data: prevVids } = await supabase
        .from('execution_videos')
        .select('id, video_url, thumbnail_url, date, serie_number')
        .eq('athlete_id', vid.athlete_id)
        .eq('exercise_name', vid.exercise_name)
        .neq('id', vid.id)
        .order('date', { ascending: true })
        .limit(50)

      const sorted = (prevVids || []) as CompVideo[]
      setCompVideos(sorted)

      // Default comparison: same serie + earlier date
      const defaultPrev =
        sorted.findLast((v) => v.serie_number === vid.serie_number && v.date < vid.date) ??
        sorted.findLast((v) => v.date < vid.date) ??
        sorted[sorted.length - 1] ??
        null
      setCompIdx(defaultPrev ? sorted.indexOf(defaultPrev) : -1)
    } finally {
      setLoading(false)
    }
  }, [videoId, toast]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadVideo()
  }, [loadVideo])

  // Detect portrait video
  useEffect(() => {
    const el = mainVideoRef.current
    if (!el) return
    const handler = () => {
      if (el.videoHeight > el.videoWidth) {
        el.closest(`.${styles.vidPlayerWrap}`)?.classList.add(styles.vidPortrait)
      }
    }
    el.addEventListener('loadedmetadata', handler)
    return () => el.removeEventListener('loadedmetadata', handler)
  }, [video])

  const handleSave = async () => {
    if (!video) return
    setSaving(true)
    const audioUrl = newAudioUrl || existingAudioUrl || null
    const updateData: Record<string, unknown> = {
      coach_feedback_url: feedbackUrl || null,
      coach_notes: feedbackNotes || null,
      coach_audio_url: audioUrl,
      status: markTreated ? 'traite' : 'a_traiter',
    }
    if (feedbackUrl || feedbackNotes || audioUrl) {
      updateData.feedback_at = new Date().toISOString()
    }

    const { error } = await supabase.from('execution_videos').update(updateData).eq('id', video.id)
    if (error) {
      toast('Erreur lors de la sauvegarde', 'error')
      setSaving(false)
      return
    }

    // Send notification to athlete (DB + push)
    if (athlete?.user_id && (feedbackUrl || feedbackNotes || audioUrl)) {
      const title = 'Retour sur votre video'
      const body =
        feedbackNotes || `Votre coach a fait un retour sur ${video.exercise_name || 'votre exercice'}`
      await notifyAthlete(athlete.user_id, 'retour', title, body, { video_id: video.id })
    }

    setVideo((prev) => (prev ? { ...prev, ...updateData, status: markTreated ? 'traite' : 'a_traiter' } as VideoRow : null))
    clearAudio()
    toast('Correction enregistree !', 'success')
    setSaving(false)
  }

  const handleRemoveAudio = () => {
    clearAudio()
    setExistingAudioUrl(null)
  }

  const navigateComp = (dir: number) => {
    setCompIdx((prev) => {
      const next = prev + dir
      if (next < 0 || next >= compVideos.length) return prev
      return next
    })
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <i className="fa-solid fa-spinner fa-spin fa-2x" />
      </div>
    )
  }

  if (!video) return null

  const currentListIdx = allVideoIds.indexOf(videoId)
  const prevVideoId = currentListIdx > 0 ? allVideoIds[currentListIdx - 1] : null
  const nextVideoId = currentListIdx < allVideoIds.length - 1 ? allVideoIds[currentListIdx + 1] : null

  const date = new Date(video.date + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const isPending = video.status === 'a_traiter'
  const compVideo = compIdx >= 0 ? compVideos[compIdx] : null

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>
          <i className="fa-solid fa-arrow-left" /> Retour aux videos
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{video.exercise_name}</h2>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            <i className="fa-solid fa-layer-group" /> Serie {video.serie_number}
            &nbsp;&nbsp;<i className="fa-solid fa-calendar" /> {date}
            {athlete && (
              <>
                &nbsp;&nbsp;<i className="fa-solid fa-user" /> {athlete.prenom} {athlete.nom}
              </>
            )}
            {video.session_name && (
              <>
                &nbsp;&nbsp;<i className="fa-solid fa-dumbbell" /> {video.session_name}
              </>
            )}
          </div>
        </div>
        <span
          className={`${styles.vidBadgeLg} ${isPending ? styles.vidBadgePending : styles.vidBadgeDone}`}
        >
          {isPending ? (
            <>
              <i className="fa-solid fa-circle" style={{ fontSize: 6, marginRight: 4 }} /> A traiter
            </>
          ) : (
            <>
              <i className="fa-solid fa-check" style={{ marginRight: 4 }} /> Traite
            </>
          )}
        </span>
      </div>

      <div className={styles.vidDetail}>
        <div>
          <div className={showCompare && compVideo ? styles.vidPlayersSide : styles.vidPlayersSingle}>
            {showCompare && compVideo && (
              <div className={styles.vidPlayerCol}>
                <div className={styles.vidPlayerLabel}>
                  Seance precedente &mdash;{' '}
                  {new Date(compVideo.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
                <div className={styles.vidPlayerWrap} style={{ position: 'relative' }}>
                  <video
                    className={styles.vidPlayer}
                    controls
                    muted
                    playsInline
                    preload="auto"
                    src={compVideo.video_url}
                    poster={compVideo.thumbnail_url || undefined}
                  />
                  <div className={styles.compNav}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => navigateComp(-1)}
                      disabled={compIdx <= 0}
                      title="Video plus ancienne"
                    >
                      <i className="fa-solid fa-chevron-left" />
                    </button>
                    <span className={styles.compCounter}>
                      {compIdx + 1} / {compVideos.length}
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => navigateComp(1)}
                      disabled={compIdx >= compVideos.length - 1}
                      title="Video plus recente"
                    >
                      <i className="fa-solid fa-chevron-right" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className={styles.vidPlayerCol}>
              {showCompare && compVideo && (
                <div className={styles.vidPlayerLabel}>Seance courante</div>
              )}
              <div className={styles.vidPlayerWrap}>
                <video
                  ref={mainVideoRef}
                  className={styles.vidPlayer}
                  controls
                  muted
                  playsInline
                  preload="auto"
                  src={video.video_url || undefined}
                  poster={video.thumbnail_url || undefined}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.vidFeedbackPanel}>
          {compVideos.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>Vue comparative</span>
              <label className="toggle-switch" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={showCompare}
                  onChange={(e) => setShowCompare(e.target.checked)}
                />
                <span className="switch" />
              </label>
            </div>
          )}

          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Votre correction</h3>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
            Ajoutez un lien vers une video de feedback et/ou des notes.
          </p>

          <div className="form-group">
            <label>
              <i className="fa-solid fa-link" style={{ marginRight: 6 }} />
              Lien video (Loom, YouTube, etc.)
            </label>
            <input
              type="url"
              placeholder="https://www.loom.com/share/..."
              value={feedbackUrl}
              onChange={(e) => setFeedbackUrl(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              Notes de correction
              <button
                type="button"
                className={`btn btn-outline btn-sm ${isRecording ? styles.micRecording : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={audioUploading}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                {audioUploading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" /> Envoi...
                  </>
                ) : isRecording ? (
                  <>
                    <i className="fa-solid fa-stop" style={{ color: 'var(--danger)' }} />{' '}
                    {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-microphone" /> Vocal
                  </>
                )}
              </button>
            </label>
            <textarea
              rows={4}
              placeholder="Points a ameliorer, conseils techniques..."
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
            />
            {effectiveAudioUrl && (
              <div className={styles.audioPlayerInline}>
                <audio controls src={effectiveAudioUrl} />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleRemoveAudio}
                  style={{ padding: '4px 8px', color: 'var(--danger)' }}
                  title="Supprimer"
                >
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
            )}
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            <input
              type="checkbox"
              checked={markTreated}
              onChange={(e) => setMarkTreated(e.target.checked)}
            />
            Marquer comme traite
          </label>

          <button
            className="btn btn-red"
            style={{ width: '100%' }}
            onClick={handleSave}
            disabled={saving}
          >
            <i className="fa-solid fa-save" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <button
              className="btn btn-outline btn-sm"
              disabled={!prevVideoId}
              onClick={() => prevVideoId && onNavigate(prevVideoId)}
            >
              <i className="fa-solid fa-chevron-left" /> Precedent
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={!nextVideoId}
              onClick={() => nextVideoId && onNavigate(nextVideoId)}
            >
              Suivant <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      {/* Training comparison section */}
      <VideoCompare video={video} compVideos={compVideos} compIdx={compIdx} />
    </div>
  )
}
