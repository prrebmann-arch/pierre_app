'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseAudioRecorderOptions {
  bucket?: string
  pathPrefix?: string
}

interface UseAudioRecorderReturn {
  isRecording: boolean
  seconds: number
  audioUrl: string | null
  startRecording: () => Promise<void>
  stopRecording: () => void
  clearAudio: () => void
  uploading: boolean
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderReturn {
  const { bucket = 'coach-audio', pathPrefix = '' } = options

  const [isRecording, setIsRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const supabase = createClient()

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    recorderRef.current = null
    setIsRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      setSeconds(0)

      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm'
      const ext = mimeType === 'audio/mp4' ? 'mp4' : 'webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        cleanup()
        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size < 500) return

        const path = `${pathPrefix}${Date.now()}.${ext}`
        setUploading(true)

        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, blob, { contentType: mimeType, upsert: true })

        if (error) {
          console.error('Audio upload error:', error)
          setUploading(false)
          return
        }

        const { data: signedData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 31536000)

        setAudioUrl(signedData?.signedUrl || null)
        setUploading(false)
      }

      recorder.start()
      setIsRecording(true)

      let secs = 0
      timerRef.current = setInterval(() => {
        secs++
        setSeconds(secs)
      }, 1000)
    } catch {
      console.error('Cannot access microphone')
    }
  }, [bucket, pathPrefix, cleanup, supabase])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop()
    }
  }, [])

  const clearAudio = useCallback(() => {
    setAudioUrl(null)
  }, [])

  return {
    isRecording,
    seconds,
    audioUrl,
    startRecording,
    stopRecording,
    clearAudio,
    uploading,
  }
}
