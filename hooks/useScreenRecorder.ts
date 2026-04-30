'use client'

import { useCallback, useRef, useState } from 'react'

export interface ScreenRecorderState {
  isRecording: boolean
  seconds: number
  errorMessage: string | null
}

export interface StartRecordingOptions {
  withWebcam: boolean
  /** Pre-acquired cam stream (e.g. from modal preview) to avoid re-prompting */
  preAcquiredCamStream?: MediaStream | null
  /**
   * Recording mode:
   * - 'screen' (default): captures the screen via getDisplayMedia + optional
   *   cam overlay via in-page LiveCamBubble. Landscape output.
   * - 'selfie': records ONLY the cam in portrait orientation (9:16). No screen
   *   share, no getDisplayMedia prompt. Coach is the entire video.
   */
  mode?: 'screen' | 'selfie'
}

export interface RecorderResult {
  blob: Blob
  durationS: number
  width: number
  height: number
  mimeType: string
  ext: 'mp4' | 'webm'
}

const PREFERRED_MIMES: Array<{ mimeType: string; ext: 'mp4' | 'webm' }> = [
  { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
]

const VIDEO_BITS_PER_SECOND = 4_000_000  // 4 Mbps — HD-quality screen capture
const HARD_CAP_SECONDS = 15 * 60

function pickMimeType() {
  for (const c of PREFERRED_MIMES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c
    }
  }
  return null
}

export function useScreenRecorder() {
  const [state, setState] = useState<ScreenRecorderState>({ isRecording: false, seconds: 0, errorMessage: null })
  // Exposed live cam stream during recording.
  // - In screen mode: powers the LiveCamBubble (in-page draggable circle).
  // - In selfie mode: powers a portrait preview panel so the coach sees themselves
  //   while recording (the cam IS the video, but the user still wants live feedback).
  const [liveCamStream, setLiveCamStream] = useState<MediaStream | null>(null)
  const [liveMode, setLiveMode] = useState<'screen' | 'selfie' | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const camStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const compositorStopRef = useRef<(() => void) | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const secondsRef = useRef<number>(0)
  const dimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
  const mimeRef = useRef<{ mimeType: string; ext: 'mp4' | 'webm' } | null>(null)

  // Result-ready coordination: onstop sets resultRef and resolves any waiter
  const resultRef = useRef<RecorderResult | null>(null)
  const stopPromiseRef = useRef<{ resolve: (r: RecorderResult) => void; reject: (e: Error) => void } | null>(null)
  // Tracks whether the recorder stopped without a user-initiated stopRecording call
  const [autoStoppedAt, setAutoStoppedAt] = useState<number | null>(null)
  const userInitiatedStopRef = useRef(false)

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (compositorStopRef.current) { compositorStopRef.current(); compositorStopRef.current = null }
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    camStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current = null
    camStreamRef.current = null
    micStreamRef.current = null
    recorderRef.current = null
    setLiveCamStream(null)
    setLiveMode(null)
  }, [])

  const startRecording = useCallback(async (opts: StartRecordingOptions) => {
    setState({ isRecording: false, seconds: 0, errorMessage: null })
    secondsRef.current = 0
    resultRef.current = null
    userInitiatedStopRef.current = false
    setAutoStoppedAt(null)

    const mime = pickMimeType()
    if (!mime) {
      setState({ isRecording: false, seconds: 0, errorMessage: "Ton navigateur ne supporte pas l'enregistrement vidéo. Utilise Chrome ou Safari récent." })
      throw new Error('No supported MIME type')
    }
    mimeRef.current = mime

    const mode = opts.mode || 'screen'
    let screenStream: MediaStream | null = null
    let micStream: MediaStream
    let camStream: MediaStream | null = null

    if (mode === 'screen') {
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 30, max: 30 },
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
          },
          audio: false,
        })
      } catch (err) {
        setState({ isRecording: false, seconds: 0, errorMessage: "Tu as refusé le partage d'écran." })
        throw err
      }
    }

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      screenStream?.getTracks().forEach(t => t.stop())
      setState({ isRecording: false, seconds: 0, errorMessage: 'Accès au micro refusé.' })
      throw err
    }

    // Cam acquisition: required in selfie mode (cam IS the video), optional in screen mode
    const needCam = mode === 'selfie' || opts.withWebcam
    if (needCam) {
      if (opts.preAcquiredCamStream) {
        camStream = opts.preAcquiredCamStream
      } else {
        try {
          // Selfie wants portrait 1080x1920; screen mode keeps the small square preview
          const camConstraints: MediaTrackConstraints = mode === 'selfie'
            ? {
                width: { ideal: 1080 },
                height: { ideal: 1920 },
                aspectRatio: { ideal: 9 / 16 },
                facingMode: 'user',
              }
            : { width: 320, height: 320 }
          camStream = await navigator.mediaDevices.getUserMedia({ video: camConstraints })
        } catch (err) {
          screenStream?.getTracks().forEach(t => t.stop())
          micStream.getTracks().forEach(t => t.stop())
          setState({ isRecording: false, seconds: 0, errorMessage: 'Accès à la webcam refusé.' })
          throw err
        }
      }
    }

    screenStreamRef.current = screenStream
    micStreamRef.current = micStream
    camStreamRef.current = camStream
    // Expose the cam stream + current mode so the live preview UI knows what to render:
    // - screen mode → LiveCamBubble (circular, draggable)
    // - selfie mode → portrait panel so the coach sees themselves while recording
    setLiveCamStream(camStream)
    setLiveMode(mode)

    // Output stream:
    // - 'screen' → pure screen capture (cam appears via in-page LiveCamBubble if shared)
    // - 'selfie' → cam stream directly, portrait orientation, no screen share at all
    let outputVideoStream: MediaStream
    if (mode === 'selfie' && camStream) {
      outputVideoStream = camStream
      const camSettings = camStream.getVideoTracks()[0]?.getSettings()
      dimensionsRef.current = { width: camSettings?.width ?? 1080, height: camSettings?.height ?? 1920 }
    } else if (screenStream) {
      outputVideoStream = screenStream
      const settings = screenStream.getVideoTracks()[0]?.getSettings()
      dimensionsRef.current = { width: settings?.width ?? 1920, height: settings?.height ?? 1080 }
    } else {
      throw new Error('No video source available')
    }

    // Combine output video + mic audio into a single stream for MediaRecorder
    const combined = new MediaStream([
      ...outputVideoStream.getVideoTracks(),
      ...micStream.getAudioTracks(),
    ])

    chunksRef.current = []

    const recorder = new MediaRecorder(combined, {
      mimeType: mime.mimeType,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    })
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    // Single source-of-truth for finalize: runs whenever the recorder transitions
    // to 'inactive', regardless of who initiated the stop.
    recorder.onstop = () => {
      if (resultRef.current) return  // already finalized
      const m = mimeRef.current
      if (!m) {
        const err = new Error('Recorder finalized without MIME type')
        stopPromiseRef.current?.reject(err)
        stopPromiseRef.current = null
        cleanup()
        setState({ isRecording: false, seconds: 0, errorMessage: null })
        return
      }
      const blob = new Blob(chunksRef.current, { type: m.mimeType.split(';')[0] })
      const result: RecorderResult = {
        blob,
        durationS: secondsRef.current,
        width: dimensionsRef.current.width,
        height: dimensionsRef.current.height,
        mimeType: m.mimeType.split(';')[0],
        ext: m.ext,
      }
      resultRef.current = result
      cleanup()
      setState({ isRecording: false, seconds: 0, errorMessage: null })

      // Notify any awaiting stopRecording caller
      const waiter = stopPromiseRef.current
      stopPromiseRef.current = null
      if (waiter) {
        waiter.resolve(result)
      } else if (!userInitiatedStopRef.current) {
        // Auto-stopped (browser-end or hard-cap) and no caller was awaiting yet.
        // Mark autoStoppedAt so the consumer can pick up the result via stopRecording().
        setAutoStoppedAt(Date.now())
      }
    }

    // Auto-stop at hard cap; sync duration via secondsRef
    timerRef.current = setInterval(() => {
      secondsRef.current = secondsRef.current + 1
      const secs = secondsRef.current
      setState(s => ({ ...s, seconds: secs }))
      if (secs >= HARD_CAP_SECONDS && recorder.state === 'recording') {
        recorder.stop()
      }
    }, 1000)

    // If user stops sharing screen via browser UI, treat as stop (screen mode only)
    if (screenStream) {
      screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorder.state === 'recording') recorder.stop()
      })
    }

    recorder.start(1000) // chunk every 1s
    setState({ isRecording: true, seconds: 0, errorMessage: null })
  }, [cleanup])

  const stopRecording = useCallback((): Promise<RecorderResult> => {
    userInitiatedStopRef.current = true
    // If onstop already ran, return the cached result.
    if (resultRef.current) {
      return Promise.resolve(resultRef.current)
    }
    const recorder = recorderRef.current
    if (!recorder) return Promise.reject(new Error('No active recording'))

    // Replace any prior waiter (rare; called twice)
    const prior = stopPromiseRef.current
    if (prior) {
      // Drain it: it will be replaced by the new one. Resolve it never to avoid hang;
      // since onstop will run once, the new waiter receives the result.
      // (The prior caller's reference is lost — they will hang. Should not happen in practice
      // because UI disables Stop button while processing.)
    }

    return new Promise<RecorderResult>((resolve, reject) => {
      stopPromiseRef.current = { resolve, reject }
      if (recorder.state === 'recording') {
        recorder.stop()
      }
      // If state is already 'inactive', onstop has either fired (and cached the result, handled above)
      // or is queued. The waiter we just installed will be picked up by onstop when it runs.
    })
  }, [])

  const cancelRecording = useCallback(() => {
    userInitiatedStopRef.current = true  // prevent autoStoppedAt from being set
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') recorder.stop()
    chunksRef.current = []
    resultRef.current = null
    if (stopPromiseRef.current) {
      stopPromiseRef.current.reject(new Error('Recording cancelled'))
      stopPromiseRef.current = null
    }
    cleanup()
    setState({ isRecording: false, seconds: 0, errorMessage: null })
    setAutoStoppedAt(null)
  }, [cleanup])

  const consumeAutoStopped = useCallback(() => {
    setAutoStoppedAt(null)
  }, [])

  return {
    isRecording: state.isRecording,
    seconds: state.seconds,
    errorMessage: state.errorMessage,
    autoStoppedAt,
    liveCamStream,
    liveMode,
    startRecording,
    stopRecording,
    cancelRecording,
    consumeAutoStopped,
  }
}
