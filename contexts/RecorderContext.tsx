'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { useScreenRecorder, type RecorderResult } from '@/hooks/useScreenRecorder'
import { extractThumbnail } from '@/hooks/useThumbnailExtractor'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

function makePlaceholderThumbnail(): Blob {
  // Minimal valid JPEG (16 bytes: SOI + APP0 + EOI), grey 1×1
  // From https://github.com/mathiasbynens/small/blob/master/jpeg.jpg
  const bytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
    0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
    0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
    0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
    0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
    0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd0, 0xff, 0xd9
  ])
  return new Blob([bytes], { type: 'image/jpeg' })
}

export interface PendingRecording {
  retourId: string
  videoBlob: Blob
  thumbnailBlob: Blob
  durationS: number
  width: number
  height: number
  mimeType: string
  ext: 'mp4' | 'webm'
  athleteId: string
  /** When set, the recording is broadcast to N athletes instead of saved
   *  for a single one. `athleteId` is ignored in that case. */
  broadcastIds?: string[]
  videoPath: string
  thumbnailPath: string
  /** Optional execution_videos.id when recorded from a video page. */
  executionVideoId?: string
}

interface FinalizeArgs {
  titre: string
  commentaire?: string
  athleteId?: string  // override (rarely used; default = pending.athleteId)
}

interface RecorderContextValue {
  // base state from useScreenRecorder
  isRecording: boolean
  seconds: number
  errorMessage: string | null

  // post-stop state
  isProcessing: boolean
  pending: PendingRecording | null
  isUploading: boolean
  uploadProgress: number

  // live cam stream + mode during recording (drives in-page live preview UI)
  liveCamStream: MediaStream | null
  liveMode: 'screen' | 'selfie' | null

  // intent state
  athleteIdForNext: string | null

  // PiP coordination
  registerPipVideo: (el: HTMLVideoElement | null) => void
  enterPipWithStream: (stream: MediaStream | null) => Promise<boolean>

  // actions
  startRecording: (opts: {
    withWebcam: boolean
    athleteId: string
    /** When set, the recording is broadcast to N athletes (page /annonces).
     *  athleteId is ignored in that case (pass empty string). */
    broadcastIds?: string[]
    preAcquiredCamStream?: MediaStream | null
    preAcquiredMicStream?: MediaStream | null
    micDeviceId?: string
    camDeviceId?: string
    bubblePosition?: { xPct: number; yPct: number } | null
    /** 'screen' (default) = screen capture + optional cam bubble; 'selfie' = portrait cam only */
    mode?: 'screen' | 'selfie'
    /** Optional execution_videos.id when triggered from a specific exercise
     *  video page. Stored on the resulting bilan_retours row so the
     *  athlete's Guide tab can surface the retour. */
    executionVideoId?: string
  }) => Promise<void>
  stopRecording: () => Promise<void>
  cancelRecording: () => void
  finalizeRecording: (args: FinalizeArgs) => Promise<void>
  discardPending: () => void
}

const RecorderContext = createContext<RecorderContextValue | null>(null)

export function useRecorder(): RecorderContextValue {
  const ctx = useContext(RecorderContext)
  if (!ctx) throw new Error('useRecorder must be used within <RecorderProvider>')
  return ctx
}

export function RecorderProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth() as { user: { id: string } | null; accessToken?: string | null }
  const { toast } = useToast()
  const supabase = createClient()
  const recorder = useScreenRecorder()

  const [isProcessing, setIsProcessing] = useState(false)
  const [pending, setPending] = useState<PendingRecording | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [athleteIdForNext, setAthleteIdForNext] = useState<string | null>(null)
  // When non-null, the next stopRecording will produce a broadcast pending
  // (multi-athlete) instead of a single-athlete one.
  const [broadcastIdsForNext, setBroadcastIdsForNext] = useState<string[] | null>(null)
  // Carry the originating execution_videos.id (if recording started from a
  // video detail page) through the async stop / finalize chain so the
  // resulting bilan_retours row can link to it.
  const [executionVideoIdForNext, setExecutionVideoIdForNext] = useState<string | null>(null)
  const cancelledRef = useRef(false)
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Persistent <video> element for PiP — registered by LiveCamPiP and used
  // synchronously from the modal's user-gesture click to avoid losing the
  // transient activation (which getDisplayMedia would consume otherwise).
  const pipVideoRef = useRef<HTMLVideoElement | null>(null)
  const registerPipVideo = useCallback((el: HTMLVideoElement | null) => {
    pipVideoRef.current = el
  }, [])
  const enterPipWithStream = useCallback(async (stream: MediaStream | null): Promise<boolean> => {
    const v = pipVideoRef.current
    if (!v || !stream) return false
    try {
      if (v.srcObject !== stream) {
        v.srcObject = stream
      }
      // Best-effort play — required by some browsers before requestPictureInPicture.
      try { await v.play() } catch {}
      if (typeof v.requestPictureInPicture === 'function' && document.pictureInPictureEnabled) {
        await v.requestPictureInPicture()
        return true
      }
    } catch (err) {
      console.warn('[recorder] enterPipWithStream failed:', err)
    }
    return false
  }, [])

  const startRecording = useCallback(async (opts: {
    withWebcam: boolean
    athleteId: string
    broadcastIds?: string[]
    preAcquiredCamStream?: MediaStream | null
    preAcquiredMicStream?: MediaStream | null
    micDeviceId?: string
    camDeviceId?: string
    bubblePosition?: { xPct: number; yPct: number } | null
    mode?: 'screen' | 'selfie'
    executionVideoId?: string
  }) => {
    cancelledRef.current = false
    setAthleteIdForNext(opts.athleteId)
    setBroadcastIdsForNext(opts.broadcastIds && opts.broadcastIds.length > 0 ? opts.broadcastIds : null)
    setExecutionVideoIdForNext(opts.executionVideoId ?? null)
    await recorder.startRecording({
      withWebcam: opts.withWebcam,
      preAcquiredCamStream: opts.preAcquiredCamStream,
      mode: opts.mode,
    })
  }, [recorder])

  const stopRecording = useCallback(async () => {
    if (!user) { toast('Session expirée', 'error'); return }
    setIsProcessing(true)
    let result: RecorderResult
    try {
      result = await recorder.stopRecording()
    } catch (err) {
      setIsProcessing(false)
      toast("Erreur lors de l'arrêt de l'enregistrement", 'error')
      return
    }

    if (cancelledRef.current) {
      setIsProcessing(false)
      return
    }

    let thumbnailBlob: Blob
    try {
      thumbnailBlob = await extractThumbnail(result.blob)
    } catch (err) {
      console.error('[recorder] thumbnail extraction failed:', err)
      // 1×1 grey JPEG (valid, decodable)
      thumbnailBlob = makePlaceholderThumbnail()
    }

    if (cancelledRef.current) {
      setIsProcessing(false)
      return
    }

    const retourId = crypto.randomUUID()
    const videoPath = `${user.id}/${retourId}.${result.ext}`
    const thumbnailPath = `${user.id}/${retourId}.jpg`

    setPending({
      retourId,
      videoBlob: result.blob,
      thumbnailBlob,
      durationS: result.durationS,
      width: result.width,
      height: result.height,
      mimeType: result.mimeType,
      ext: result.ext,
      athleteId: athleteIdForNext ?? '',
      broadcastIds: broadcastIdsForNext ?? undefined,
      videoPath,
      thumbnailPath,
      executionVideoId: executionVideoIdForNext ?? undefined,
    })
    setIsProcessing(false)
  }, [recorder, user, toast, athleteIdForNext, broadcastIdsForNext, executionVideoIdForNext])

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true
    recorder.cancelRecording()
    setIsProcessing(false)
    setPending(null)
    setAthleteIdForNext(null)
    setExecutionVideoIdForNext(null)
  }, [recorder])

  const discardPending = useCallback(() => {
    setPending(null)
    setAthleteIdForNext(null)
    setExecutionVideoIdForNext(null)
  }, [])

  // Auto-pickup: if recorder stopped without user clicking Stop (browser-end or hard-cap),
  // trigger the same post-stop flow.
  useEffect(() => {
    if (!recorder.autoStoppedAt) return
    if (isProcessing || pending || isUploading) return
    recorder.consumeAutoStopped()
    // Drive the standard post-stop flow; it'll consume the cached result instantly.
    void stopRecording()
  }, [recorder.autoStoppedAt, isProcessing, pending, isUploading, stopRecording, recorder])

  const finalizeRecording = useCallback(async ({ titre, commentaire, athleteId }: FinalizeArgs) => {
    if (!pending || !user) { toast('Aucun enregistrement en attente', 'error'); return }
    const isBroadcast = !!(pending.broadcastIds && pending.broadcastIds.length > 0)
    const targetAthleteId = athleteId || pending.athleteId
    if (!isBroadcast && !targetAthleteId) { toast('Athlète manquant', 'error'); return }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Upload both files in parallel
      const videoUpload = supabase.storage
        .from('coach-video')
        .upload(pending.videoPath, pending.videoBlob, { contentType: pending.mimeType, upsert: false })
      const thumbUpload = supabase.storage
        .from('coach-video')
        .upload(pending.thumbnailPath, pending.thumbnailBlob, { contentType: 'image/jpeg', upsert: false })

      // Coarse progress: bump to 50% when one finishes, 100% when both done
      let completed = 0
      const tickProgress = () => { completed++; setUploadProgress(completed === 1 ? 50 : 90) }
      videoUpload.then(tickProgress).catch(() => {})
      thumbUpload.then(tickProgress).catch(() => {})

      const [videoRes, thumbRes] = await Promise.all([videoUpload, thumbUpload])
      if (videoRes.error) throw new Error(`Video upload failed: ${videoRes.error.message}`)
      if (thumbRes.error) throw new Error(`Thumb upload failed: ${thumbRes.error.message}`)

      setUploadProgress(95)

      // Branch on broadcast vs single
      if (isBroadcast) {
        const res = await fetch('/api/annonces/broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            athlete_ids: pending.broadcastIds,
            type: 'video',
            titre,
            commentaire: commentaire || null,
            video_path: pending.videoPath,
            thumbnail_path: pending.thumbnailPath,
            duration_s: pending.durationS,
            width: pending.width,
            height: pending.height,
            mime_type: pending.mimeType,
          }),
        })
        if (!res.ok) {
          const body = await res.text()
          throw new Error(`broadcast failed: ${res.status} ${body}`)
        }
        const json = await res.json()
        setUploadProgress(100)
        toast(`Retour vidéo envoyé à ${json.inserted} athlète${json.inserted > 1 ? 's' : ''} !`, 'success')
      } else {
        const res = await fetch('/api/videos/save-retour', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            retourId: pending.retourId,
            athleteId: targetAthleteId,
            videoPath: pending.videoPath,
            thumbnailPath: pending.thumbnailPath,
            durationS: pending.durationS,
            width: pending.width,
            height: pending.height,
            mimeType: pending.mimeType,
            titre,
            commentaire: commentaire || null,
            executionVideoId: pending.executionVideoId || null,
          }),
        })
        if (!res.ok) {
          const body = await res.text()
          throw new Error(`save-retour failed: ${res.status} ${body}`)
        }
        setUploadProgress(100)
        toast('Retour vidéo envoyé !', 'success')
      }

      setPending(null)
      setAthleteIdForNext(null)
      setBroadcastIdsForNext(null)
      setExecutionVideoIdForNext(null)
    } catch (err) {
      console.error('[recorder] finalize failed:', err)
      toast(err instanceof Error ? err.message : 'Erreur envoi retour', 'error')
    } finally {
      setIsUploading(false)
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current)
      progressTimeoutRef.current = setTimeout(() => setUploadProgress(0), 1500)
    }
  }, [pending, user, accessToken, supabase, toast])

  const value = useMemo<RecorderContextValue>(() => ({
    isRecording: recorder.isRecording,
    seconds: recorder.seconds,
    errorMessage: recorder.errorMessage,
    isProcessing,
    pending,
    isUploading,
    uploadProgress,
    liveCamStream: recorder.liveCamStream,
    liveMode: recorder.liveMode,
    athleteIdForNext,
    registerPipVideo,
    enterPipWithStream,
    startRecording,
    stopRecording,
    cancelRecording,
    finalizeRecording,
    discardPending,
  }), [
    recorder.isRecording,
    recorder.seconds,
    recorder.errorMessage,
    recorder.liveCamStream,
    recorder.liveMode,
    isProcessing,
    pending,
    isUploading,
    uploadProgress,
    athleteIdForNext,
    registerPipVideo,
    enterPipWithStream,
    startRecording,
    stopRecording,
    cancelRecording,
    finalizeRecording,
    discardPending,
  ])

  return <RecorderContext.Provider value={value}>{children}</RecorderContext.Provider>
}
