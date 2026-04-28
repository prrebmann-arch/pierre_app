'use client'

import { createContext, useCallback, useContext, useState, ReactNode } from 'react'
import { useScreenRecorder, type RecorderResult } from '@/hooks/useScreenRecorder'
import { extractThumbnail } from '@/hooks/useThumbnailExtractor'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

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
  videoPath: string
  thumbnailPath: string
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

  // intent state
  athleteIdForNext: string | null

  // actions
  startRecording: (opts: { withWebcam: boolean; athleteId: string }) => Promise<void>
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

  const startRecording = useCallback(async (opts: { withWebcam: boolean; athleteId: string }) => {
    setAthleteIdForNext(opts.athleteId)
    await recorder.startRecording({ withWebcam: opts.withWebcam })
  }, [recorder])

  const stopRecording = useCallback(async () => {
    if (!user) { toast('Session expirée', 'error'); return }
    setIsProcessing(true)
    let result: RecorderResult
    try {
      result = await recorder.stopRecording()
    } catch (err) {
      setIsProcessing(false)
      toast('Erreur lors de l\'arrêt de l\'enregistrement', 'error')
      return
    }

    let thumbnailBlob: Blob
    try {
      thumbnailBlob = await extractThumbnail(result.blob)
    } catch (err) {
      console.error('[recorder] thumbnail extraction failed:', err)
      // Use a 1×1 transparent placeholder so DB constraint is satisfied
      thumbnailBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })
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
      videoPath,
      thumbnailPath,
    })
    setIsProcessing(false)
  }, [recorder, user, toast, athleteIdForNext])

  const cancelRecording = useCallback(() => {
    recorder.cancelRecording()
    setIsProcessing(false)
    setPending(null)
    setAthleteIdForNext(null)
  }, [recorder])

  const discardPending = useCallback(() => {
    setPending(null)
    setAthleteIdForNext(null)
  }, [])

  const finalizeRecording = useCallback(async ({ titre, commentaire, athleteId }: FinalizeArgs) => {
    if (!pending || !user) { toast('Aucun enregistrement en attente', 'error'); return }
    const targetAthleteId = athleteId || pending.athleteId
    if (!targetAthleteId) { toast('Athlète manquant', 'error'); return }

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
      videoUpload.then(() => setUploadProgress(p => Math.max(p, 80))).catch(() => {})
      thumbUpload.then(() => setUploadProgress(p => Math.max(p, 50))).catch(() => {})

      const [videoRes, thumbRes] = await Promise.all([videoUpload, thumbUpload])
      if (videoRes.error) throw new Error(`Video upload failed: ${videoRes.error.message}`)
      if (thumbRes.error) throw new Error(`Thumb upload failed: ${thumbRes.error.message}`)

      setUploadProgress(95)

      // Save metadata via API route
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
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`save-retour failed: ${res.status} ${body}`)
      }

      setUploadProgress(100)
      toast('Retour vidéo envoyé !', 'success')
      setPending(null)
      setAthleteIdForNext(null)
    } catch (err) {
      console.error('[recorder] finalize failed:', err)
      toast(err instanceof Error ? err.message : 'Erreur envoi retour', 'error')
    } finally {
      setIsUploading(false)
      setTimeout(() => setUploadProgress(0), 1500)
    }
  }, [pending, user, accessToken, supabase, toast])

  const value: RecorderContextValue = {
    isRecording: recorder.isRecording,
    seconds: recorder.seconds,
    errorMessage: recorder.errorMessage,
    isProcessing,
    pending,
    isUploading,
    uploadProgress,
    athleteIdForNext,
    startRecording,
    stopRecording,
    cancelRecording,
    finalizeRecording,
    discardPending,
  }

  return <RecorderContext.Provider value={value}>{children}</RecorderContext.Provider>
}
