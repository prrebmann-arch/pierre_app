# Native Screen Recorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native browser screen recorder inside COACH so the coach can record video feedback (screen + mic + optional webcam bubble) and send it to athletes, replacing Loom.

**Architecture:** React Context provider mounted at `app/(app)/layout.tsx` to keep MediaRecorder alive during navigation. Canvas-based compositing for optional webcam overlay. Direct upload from browser to Supabase Storage `coach-video` bucket using existing authenticated client (RLS enforces `<coach_id>/...` path ownership). Three Next.js API routes: save retour metadata, fetch signed playback URLs, daily Vercel cron for 30-day archival.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (auth + Postgres + Storage on Pro plan), MediaRecorder API, getDisplayMedia/getUserMedia, HTML5 Canvas, Vercel Cron.

**Spec reference:** `docs/superpowers/specs/2026-04-28-native-screen-recorder-design.md`

**Codebase has no automated test infrastructure (no jest/vitest in `package.json`).** Verification is done via manual smoke tests against `npm run dev` and checking browser console + Supabase dashboard. Each task that produces user-visible behavior includes an explicit manual verification step.

---

## Pre-flight (manual, user-side, before Task 1)

These are **not coding tasks** — they are user actions to perform once on Supabase / Vercel before the implementation starts. Pierre must do these and confirm.

- [ ] **PF-1: Upgrade Supabase project to Pro plan**
  - Go to Supabase Dashboard → Project Settings → Billing → Upgrade to Pro
  - Confirm $25/mo
  - Wait until "Pro" badge appears next to project name

- [ ] **PF-2: Create the `coach-video` bucket**
  - Supabase Dashboard → Storage → New bucket
  - Name: `coach-video`
  - Public: **OFF** (private bucket)
  - File size limit: leave default (50MB → bump to 200MB to accommodate 15-min videos at 1.2 Mbps)
  - Allowed MIME types: `video/mp4, video/webm, image/jpeg`
  - Click Create

- [ ] **PF-3: Confirm `CRON_SECRET` env var exists in Vercel**
  - Already used by `/api/stripe/cron`. If not set: Vercel Dashboard → Project → Settings → Environment Variables → add `CRON_SECRET` (random 32-byte hex). Save in 1Password.

---

## Task 1: SQL Migration — bilan_retours columns + storage RLS

**Files:**
- Create: `sql/bilan_retours_video_columns.sql`
- Create: `sql/coach_video_bucket_rls.sql`

- [ ] **Step 1: Write the columns migration**

Create `sql/bilan_retours_video_columns.sql` with:

```sql
-- ============================================================
-- Native screen recorder — additive columns on bilan_retours
-- Date: 2026-04-28
-- Spec: docs/superpowers/specs/2026-04-28-native-screen-recorder-design.md
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE bilan_retours
  ADD COLUMN IF NOT EXISTS video_path text,
  ADD COLUMN IF NOT EXISTS thumbnail_path text,
  ADD COLUMN IF NOT EXISTS duration_s int,
  ADD COLUMN IF NOT EXISTS width int,
  ADD COLUMN IF NOT EXISTS height int,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Index for cron archival query
CREATE INDEX IF NOT EXISTS idx_bilan_retours_archive_candidates
  ON bilan_retours (created_at)
  WHERE archived_at IS NULL AND video_path IS NOT NULL;

-- Comment for self-documentation
COMMENT ON COLUMN bilan_retours.video_path IS 'Path in coach-video bucket: <coach_id>/<retour_id>.mp4';
COMMENT ON COLUMN bilan_retours.thumbnail_path IS 'Path in coach-video bucket: <coach_id>/<retour_id>.jpg';
COMMENT ON COLUMN bilan_retours.archived_at IS 'Set by /api/videos/archive-old-retours cron after 30 days';
```

- [ ] **Step 2: Write the storage RLS migration**

Create `sql/coach_video_bucket_rls.sql` with:

```sql
-- ============================================================
-- RLS policies for storage.objects on coach-video bucket
-- Date: 2026-04-28
-- Run AFTER creating the bucket via Supabase Dashboard
-- ============================================================

-- Coach can INSERT files only under their own user_id folder
DROP POLICY IF EXISTS "coach_write_own_videos" ON storage.objects;
CREATE POLICY "coach_write_own_videos" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'coach-video'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Coach can DELETE their own files (used by archival route via service role too)
DROP POLICY IF EXISTS "coach_delete_own_videos" ON storage.objects;
CREATE POLICY "coach_delete_own_videos" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'coach-video'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Coach can SELECT their own files (used by signed URL generation when called as coach)
DROP POLICY IF EXISTS "coach_read_own_videos" ON storage.objects;
CREATE POLICY "coach_read_own_videos" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'coach-video'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- NOTE: athlete reads pass through service-role signed URLs from the API route
-- (athletes do not have direct storage access to coach-video).
```

- [ ] **Step 3: Apply migrations in Supabase SQL Editor**

Manual:
1. Open Supabase Dashboard → SQL Editor → New query
2. Paste content of `bilan_retours_video_columns.sql`, run, expect "Success. No rows returned"
3. New query, paste `coach_video_bucket_rls.sql`, run, expect "Success"

**Verification:**
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'bilan_retours' AND column_name IN ('video_path', 'thumbnail_path', 'duration_s', 'width', 'height', 'mime_type', 'archived_at');
-- Expected: 7 rows
```

```sql
SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%video%';
-- Expected: coach_write_own_videos, coach_delete_own_videos, coach_read_own_videos
```

- [ ] **Step 4: Commit**

```bash
git add sql/bilan_retours_video_columns.sql sql/coach_video_bucket_rls.sql
git commit -m "feat(sql): bilan_retours video columns + coach-video RLS"
```

---

## Task 2: `useScreenRecorder` hook (low-level recording primitive)

**Files:**
- Create: `hooks/useScreenRecorder.ts`

- [ ] **Step 1: Create the hook with full implementation**

Create `hooks/useScreenRecorder.ts` with:

```ts
'use client'

import { useCallback, useRef, useState } from 'react'

export interface ScreenRecorderState {
  isRecording: boolean
  seconds: number
  errorMessage: string | null
}

export interface StartRecordingOptions {
  withWebcam: boolean
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

const VIDEO_BITS_PER_SECOND = 1_200_000  // 1.2 Mbps — see spec §3.1
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

  const recorderRef = useRef<MediaRecorder | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const camStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const compositingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const dimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
  const mimeRef = useRef<{ mimeType: string; ext: 'mp4' | 'webm' } | null>(null)
  const resolveStopRef = useRef<((res: RecorderResult) => void) | null>(null)
  const rejectStopRef = useRef<((err: Error) => void) | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    camStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current = null
    camStreamRef.current = null
    micStreamRef.current = null
    compositingCanvasRef.current = null
    recorderRef.current = null
  }, [])

  const startRecording = useCallback(async (opts: StartRecordingOptions) => {
    setState({ isRecording: false, seconds: 0, errorMessage: null })

    const mime = pickMimeType()
    if (!mime) {
      setState({ isRecording: false, seconds: 0, errorMessage: 'Ton navigateur ne supporte pas l\'enregistrement vidéo. Utilise Chrome ou Safari récent.' })
      throw new Error('No supported MIME type')
    }
    mimeRef.current = mime

    let screenStream: MediaStream
    let micStream: MediaStream
    let camStream: MediaStream | null = null

    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false })
    } catch (err) {
      setState({ isRecording: false, seconds: 0, errorMessage: 'Tu as refusé le partage d\'écran.' })
      throw err
    }

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      screenStream.getTracks().forEach(t => t.stop())
      setState({ isRecording: false, seconds: 0, errorMessage: 'Accès au micro refusé.' })
      throw err
    }

    if (opts.withWebcam) {
      try {
        camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320 } })
      } catch (err) {
        screenStream.getTracks().forEach(t => t.stop())
        micStream.getTracks().forEach(t => t.stop())
        setState({ isRecording: false, seconds: 0, errorMessage: 'Accès à la webcam refusé.' })
        throw err
      }
    }

    screenStreamRef.current = screenStream
    micStreamRef.current = micStream
    camStreamRef.current = camStream

    // Build the output stream
    let outputVideoStream: MediaStream
    if (camStream) {
      const composited = await import('./../components/recorder/CanvasCompositor').then(m => m.startCompositing(screenStream, camStream!))
      compositingCanvasRef.current = composited.canvas
      animFrameRef.current = composited.animFrameId
      outputVideoStream = composited.stream
      dimensionsRef.current = { width: composited.canvas.width, height: composited.canvas.height }
    } else {
      outputVideoStream = screenStream
      const settings = screenStream.getVideoTracks()[0]?.getSettings()
      dimensionsRef.current = { width: settings?.width ?? 1920, height: settings?.height ?? 1080 }
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

    recorder.onstop = () => {
      const durationS = state.seconds // captured in state, but we recompute below
    }

    // We don't rely on recorder.onstop to resolve; instead, stopRecording wires its own resolver.
    // This sidesteps stale state from the closure.

    // Auto-stop at hard cap
    let secs = 0
    timerRef.current = setInterval(() => {
      secs++
      setState(s => ({ ...s, seconds: secs }))
      if (secs >= HARD_CAP_SECONDS && recorder.state === 'recording') {
        recorder.stop()
      }
    }, 1000)

    // If user stops sharing screen via browser UI, treat as stop
    screenStream.getVideoTracks()[0].addEventListener('ended', () => {
      if (recorder.state === 'recording') recorder.stop()
    })

    recorder.start(1000) // chunk every 1s
    setState({ isRecording: true, seconds: 0, errorMessage: null })
  }, [state.seconds])

  const stopRecording = useCallback((): Promise<RecorderResult> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current
      if (!recorder) { reject(new Error('No active recording')); return }

      resolveStopRef.current = resolve
      rejectStopRef.current = reject

      const finalize = () => {
        const mime = mimeRef.current!
        const blob = new Blob(chunksRef.current, { type: mime.mimeType.split(';')[0] })
        const result: RecorderResult = {
          blob,
          durationS: state.seconds,
          width: dimensionsRef.current.width,
          height: dimensionsRef.current.height,
          mimeType: mime.mimeType.split(';')[0],
          ext: mime.ext,
        }
        cleanup()
        setState({ isRecording: false, seconds: 0, errorMessage: null })
        resolve(result)
      }

      if (recorder.state === 'inactive') {
        finalize()
      } else {
        recorder.addEventListener('stop', finalize, { once: true })
        recorder.stop()
      }
    })
  }, [cleanup, state.seconds])

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') recorder.stop()
    chunksRef.current = []
    cleanup()
    setState({ isRecording: false, seconds: 0, errorMessage: null })
  }, [cleanup])

  return {
    isRecording: state.isRecording,
    seconds: state.seconds,
    errorMessage: state.errorMessage,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
npx tsc --noEmit 2>&1 | grep -E "useScreenRecorder|error" | head -20
```

Expected: no errors specific to `useScreenRecorder.ts`. (`CanvasCompositor` import will error — that's fine, fixed in next task.)

- [ ] **Step 3: Commit**

```bash
git add hooks/useScreenRecorder.ts
git commit -m "feat(recorder): useScreenRecorder hook (mp4 priority + auto cap 15min)"
```

---

## Task 3: `CanvasCompositor` — webcam bubble overlay

**Files:**
- Create: `components/recorder/CanvasCompositor.ts`

- [ ] **Step 1: Create the compositor module**

Create `components/recorder/CanvasCompositor.ts` with:

```ts
export interface CompositingResult {
  canvas: HTMLCanvasElement
  stream: MediaStream
  animFrameId: number
}

const BUBBLE_RADIUS = 90       // 180×180 webcam bubble
const BUBBLE_INSET = 16
const BUBBLE_BORDER = 4
const FPS = 30

export async function startCompositing(
  screenStream: MediaStream,
  camStream: MediaStream
): Promise<CompositingResult> {
  const screenVideo = document.createElement('video')
  screenVideo.srcObject = screenStream
  screenVideo.muted = true
  screenVideo.playsInline = true
  await screenVideo.play()

  const camVideo = document.createElement('video')
  camVideo.srcObject = camStream
  camVideo.muted = true
  camVideo.playsInline = true
  await camVideo.play()

  const canvas = document.createElement('canvas')
  // Wait for screen video metadata before sizing canvas
  if (screenVideo.videoWidth === 0) {
    await new Promise<void>(r => {
      screenVideo.onloadedmetadata = () => r()
    })
  }
  canvas.width = screenVideo.videoWidth
  canvas.height = screenVideo.videoHeight

  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 2d context unavailable')

  let animFrameId = 0
  const draw = () => {
    if (screenVideo.readyState >= 2) {
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)

      if (camVideo.readyState >= 2) {
        const cx = BUBBLE_INSET + BUBBLE_RADIUS
        const cy = canvas.height - BUBBLE_INSET - BUBBLE_RADIUS

        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, BUBBLE_RADIUS, 0, Math.PI * 2)
        ctx.clip()

        // Draw cam centered & cropped to fill the bubble (cover behavior)
        const camAR = camVideo.videoWidth / camVideo.videoHeight
        let drawW = BUBBLE_RADIUS * 2
        let drawH = BUBBLE_RADIUS * 2
        if (camAR > 1) drawW = drawH * camAR
        else drawH = drawW / camAR
        ctx.drawImage(camVideo, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
        ctx.restore()

        ctx.beginPath()
        ctx.arc(cx, cy, BUBBLE_RADIUS, 0, Math.PI * 2)
        ctx.lineWidth = BUBBLE_BORDER
        ctx.strokeStyle = '#ffffff'
        ctx.stroke()
      }
    }
    animFrameId = requestAnimationFrame(draw)
  }
  draw()

  const stream = canvas.captureStream(FPS)

  return { canvas, stream, animFrameId }
}
```

- [ ] **Step 2: Verify TS compiles cleanly now**

```bash
npx tsc --noEmit 2>&1 | grep -E "useScreenRecorder|CanvasCompositor|error" | head -20
```

Expected: no errors for these two files.

- [ ] **Step 3: Commit**

```bash
git add components/recorder/CanvasCompositor.ts
git commit -m "feat(recorder): canvas compositor for webcam bubble overlay"
```

---

## Task 4: `useThumbnailExtractor` hook

**Files:**
- Create: `hooks/useThumbnailExtractor.ts`

- [ ] **Step 1: Create the hook**

Create `hooks/useThumbnailExtractor.ts` with:

```ts
'use client'

/**
 * Extract a single JPEG frame from a video Blob, client-side.
 * Used to generate poster thumbnails without server-side ffmpeg.
 */
export async function extractThumbnail(videoBlob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(videoBlob)
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Failed to load video metadata for thumbnail'))
    })

    const targetTime = Math.min(1, (video.duration || 2) / 2)
    video.currentTime = targetTime

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve()
      video.onerror = () => reject(new Error('Failed to seek video for thumbnail'))
    })

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2d context unavailable')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/jpeg', 0.7)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "useThumbnailExtractor|error" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useThumbnailExtractor.ts
git commit -m "feat(recorder): client-side thumbnail extraction"
```

---

## Task 5: `RecorderContext` — global provider

**Files:**
- Create: `contexts/RecorderContext.tsx`

- [ ] **Step 1: Create the context with full provider implementation**

Create `contexts/RecorderContext.tsx` with:

```tsx
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
```

- [ ] **Step 2: Check that AuthContext exposes `accessToken`**

```bash
grep -n "accessToken" /Users/pierrerebmann/MOMENTUM/COACH/contexts/AuthContext.tsx
```

If it does, proceed. If it does NOT (returns nothing), edit the import in `RecorderContext.tsx` to read the token via `supabase.auth.getSession()` instead:

Replace:
```ts
const { user, accessToken } = useAuth() as { user: { id: string } | null; accessToken?: string | null }
```
with:
```ts
const { user } = useAuth() as { user: { id: string } | null }
async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
```
And in `finalizeRecording`, replace `accessToken ? ... : {}` with:
```ts
const token = await getToken()
... headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
```

- [ ] **Step 3: Verify TS compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "RecorderContext|error" | head -20
```

Expected: zero errors related to `RecorderContext.tsx`.

- [ ] **Step 4: Commit**

```bash
git add contexts/RecorderContext.tsx
git commit -m "feat(recorder): RecorderProvider with persistent state across navigation"
```

---

## Task 6: `RecordingPill` — floating UI

**Files:**
- Create: `components/recorder/RecordingPill.tsx`
- Create: `components/recorder/RecordingPill.module.css`

- [ ] **Step 1: Create the styles**

Create `components/recorder/RecordingPill.module.css` with:

```css
.pill {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--card-bg, #1f1f1f);
  color: var(--text, #fff);
  border-radius: 999px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  font-size: 14px;
  font-weight: 500;
  user-select: none;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff3b3b;
  animation: pulse 1.2s ease-in-out infinite;
}

.dotProcessing {
  background: #f0a020;
  animation: none;
}

.timer { font-variant-numeric: tabular-nums; min-width: 44px; }
.timerWarning { color: #f0a020; }

.btn {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 13px;
  border-radius: 6px;
}
.btnStop { background: #ff3b3b; color: #fff; }
.btnStop:hover { background: #e02525; }
.btnCancel:hover { background: rgba(255, 255, 255, 0.1); }

.uploading {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px;
}
.progressBar {
  width: 80px; height: 4px; border-radius: 2px;
  background: rgba(255, 255, 255, 0.2); overflow: hidden;
}
.progressFill { height: 100%; background: var(--primary, #5b8dff); transition: width 0.3s ease; }

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}
```

- [ ] **Step 2: Create the component**

Create `components/recorder/RecordingPill.tsx` with:

```tsx
'use client'

import { useRecorder } from '@/contexts/RecorderContext'
import styles from './RecordingPill.module.css'

const WARNING_AT_S = 12 * 60

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function RecordingPill() {
  const { isRecording, seconds, isProcessing, isUploading, uploadProgress, stopRecording, cancelRecording } = useRecorder()

  if (!isRecording && !isProcessing && !isUploading) return null

  if (isUploading) {
    return (
      <div className={styles.pill} role="status" aria-live="polite">
        <i className="fas fa-cloud-upload-alt" />
        <span className={styles.uploading}>
          Envoi… {uploadProgress}%
          <span className={styles.progressBar}>
            <span className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
          </span>
        </span>
      </div>
    )
  }

  if (isProcessing) {
    return (
      <div className={styles.pill} role="status" aria-live="polite">
        <span className={`${styles.dot} ${styles.dotProcessing}`} />
        <span>Traitement…</span>
      </div>
    )
  }

  // isRecording
  const isWarning = seconds >= WARNING_AT_S
  return (
    <div className={styles.pill} role="status" aria-live="polite">
      <span className={styles.dot} />
      <span className={`${styles.timer} ${isWarning ? styles.timerWarning : ''}`}>{formatTime(seconds)}</span>
      <button
        className={`${styles.btn} ${styles.btnStop}`}
        onClick={() => { stopRecording() }}
        aria-label="Arrêter l'enregistrement"
      >
        <i className="fas fa-stop" /> Stop
      </button>
      <button
        className={`${styles.btn} ${styles.btnCancel}`}
        onClick={() => {
          if (confirm('Annuler cet enregistrement ? La vidéo sera perdue.')) cancelRecording()
        }}
        aria-label="Annuler"
      >
        Annuler
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/recorder/RecordingPill.tsx components/recorder/RecordingPill.module.css
git commit -m "feat(recorder): RecordingPill floating UI"
```

---

## Task 7: `StartRecordingModal` — pre-record with webcam toggle

**Files:**
- Create: `components/recorder/StartRecordingModal.tsx`

- [ ] **Step 1: Create the modal**

Create `components/recorder/StartRecordingModal.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { useRecorder } from '@/contexts/RecorderContext'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'

interface Props {
  isOpen: boolean
  onClose: () => void
  athleteId: string
}

export default function StartRecordingModal({ isOpen, onClose, athleteId }: Props) {
  const { startRecording } = useRecorder()
  const { toast } = useToast()
  const [withWebcam, setWithWebcam] = useState(false)
  const [starting, setStarting] = useState(false)

  async function handleStart() {
    setStarting(true)
    try {
      await startRecording({ withWebcam, athleteId })
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur démarrage enregistrement'
      toast(msg, 'error')
    } finally {
      setStarting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enregistrer un retour vidéo">
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
          Tu vas choisir l'écran à partager (écran entier, fenêtre ou onglet) au prochain dialogue du navigateur.
          Le micro sera activé automatiquement.
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={withWebcam}
            onChange={(e) => setWithWebcam(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          Inclure ma webcam (bulle en bas à gauche)
        </label>

        <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
          Durée maximum : 15 minutes. Tu peux naviguer librement dans COACH pendant l'enregistrement.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-outline" onClick={onClose} disabled={starting}>Annuler</button>
          <button className="btn btn-red" onClick={handleStart} disabled={starting}>
            {starting ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-circle" /> Démarrer</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/recorder/StartRecordingModal.tsx
git commit -m "feat(recorder): StartRecordingModal with webcam toggle"
```

---

## Task 8: `RetourFinalizeModal` — post-record metadata form

**Files:**
- Create: `components/recorder/RetourFinalizeModal.tsx`

- [ ] **Step 1: Create the modal**

Create `components/recorder/RetourFinalizeModal.tsx` with:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRecorder } from '@/contexts/RecorderContext'
import Modal from '@/components/ui/Modal'

function defaultTitre(): string {
  const d = new Date()
  return `Retour technique du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
}

export default function RetourFinalizeModal() {
  const { pending, finalizeRecording, discardPending, isUploading } = useRecorder()

  const [titre, setTitre] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (pending) {
      setTitre(defaultTitre())
      setCommentaire('')
      const url = URL.createObjectURL(pending.videoBlob)
      setPreviewUrl(url)
      return () => { URL.revokeObjectURL(url) }
    }
  }, [pending])

  const sizeMb = useMemo(() => {
    if (!pending) return 0
    return Math.round((pending.videoBlob.size / (1024 * 1024)) * 10) / 10
  }, [pending])

  if (!pending) return null

  return (
    <Modal isOpen={!!pending} onClose={() => { if (!isUploading) discardPending() }} title="Finaliser le retour vidéo">
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {previewUrl && (
          <video
            src={previewUrl}
            controls
            playsInline
            style={{ width: '100%', maxHeight: 320, borderRadius: 8, background: '#000' }}
          />
        )}
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          Durée: {Math.floor(pending.durationS / 60)}:{(pending.durationS % 60).toString().padStart(2, '0')} · Taille: {sizeMb} MB · Format: {pending.ext.toUpperCase()}
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Titre *</label>
          <input
            type="text"
            className="form-control"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            disabled={isUploading}
            maxLength={120}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Commentaire</label>
          <textarea
            className="form-control"
            rows={3}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Optionnel"
            disabled={isUploading}
            maxLength={500}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            className="btn btn-outline"
            onClick={() => { if (confirm('Jeter cet enregistrement ?')) discardPending() }}
            disabled={isUploading}
          >
            Jeter
          </button>
          <button
            className="btn btn-red"
            onClick={() => finalizeRecording({ titre: titre.trim() || defaultTitre(), commentaire: commentaire.trim() || undefined })}
            disabled={isUploading || !titre.trim()}
          >
            {isUploading ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/recorder/RetourFinalizeModal.tsx
git commit -m "feat(recorder): RetourFinalizeModal post-record form"
```

---

## Task 9: Mount `RecorderProvider` + UI in `(app)/layout.tsx`

**Files:**
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Wrap children with RecorderProvider and render pill + modal**

Open `app/(app)/layout.tsx` and modify the imports section + final return.

Add to imports near the top (after the existing imports):
```tsx
import { RecorderProvider } from '@/contexts/RecorderContext'
import RecordingPill from '@/components/recorder/RecordingPill'
import RetourFinalizeModal from '@/components/recorder/RetourFinalizeModal'
```

Replace the final `return (...)` block (currently `return ( <AthleteProvider>...</AthleteProvider> )`) with:

```tsx
  return (
    <AthleteProvider>
      <RecorderProvider>
        <div className={styles.appLayout}>
          <Sidebar />
          <main className={styles.mainContent}>
            {children}
          </main>
        </div>
        <RecordingPill />
        <RetourFinalizeModal />
      </RecorderProvider>
    </AthleteProvider>
  )
```

- [ ] **Step 2: Verify TS compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "layout|RecorderProvider|error" | head -20
```

Expected: no errors related to layout.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/layout.tsx
git commit -m "feat(recorder): mount RecorderProvider + pill in (app) layout"
```

---

## Task 10: API route `POST /api/videos/save-retour`

**Files:**
- Create: `app/api/videos/save-retour/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/videos/save-retour/route.ts` with:

```ts
import { createClient } from '@supabase/supabase-js'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'

export const maxDuration = 30

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  return _supabaseAdmin
}

interface SaveBody {
  retourId?: string
  athleteId?: string
  videoPath?: string
  thumbnailPath?: string
  durationS?: number
  width?: number
  height?: number
  mimeType?: string
  titre?: string
  commentaire?: string | null
}

export async function POST(request: Request) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(request)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  let body: SaveBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { retourId, athleteId, videoPath, thumbnailPath, durationS, width, height, mimeType, titre, commentaire } = body
  if (!retourId || !athleteId || !videoPath || !thumbnailPath || !mimeType || !titre) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Verify the athlete belongs to this coach
  const { data: athlete, error: athErr } = await supabase
    .from('athletes')
    .select('id, user_id, coach_id')
    .eq('id', athleteId)
    .eq('coach_id', user.id)
    .maybeSingle()
  if (athErr || !athlete) {
    return Response.json({ error: 'Athlete not found or not yours' }, { status: 403 })
  }

  // Insert bilan_retours row
  const { data: inserted, error: insErr } = await supabase
    .from('bilan_retours')
    .insert({
      id: retourId,
      athlete_id: athleteId,
      coach_id: user.id,
      titre,
      commentaire: commentaire ?? null,
      video_path: videoPath,
      thumbnail_path: thumbnailPath,
      duration_s: durationS ?? null,
      width: width ?? null,
      height: height ?? null,
      mime_type: mimeType,
    })
    .select()
    .single()
  if (insErr) {
    console.error('[save-retour] insert error:', insErr)
    return Response.json({ error: 'DB insert failed', details: insErr.message }, { status: 500 })
  }

  // Send push notification (best-effort, don't fail request if push fails)
  if (athlete.user_id) {
    try {
      await supabase.from('notifications').insert({
        user_id: athlete.user_id,
        type: 'retour',
        title: 'Nouveau retour vidéo',
        body: `Votre coach vous a envoyé : ${titre}`,
        metadata: { retour_id: retourId, has_video: true },
      })

      // Expo push (mirror notifyAthlete logic since this runs server-side)
      const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', athlete.user_id)
      if (tokens && tokens.length > 0) {
        const messages = tokens.map((t: { token: string }) => ({
          to: t.token,
          sound: 'default',
          title: 'Nouveau retour vidéo',
          body: `Votre coach vous a envoyé : ${titre}`,
          data: { type: 'retour', retour_id: retourId, has_video: true },
        }))
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        })
      }
    } catch (pushErr) {
      console.error('[save-retour] push failed (non-fatal):', pushErr)
    }
  }

  return Response.json({ ok: true, id: inserted.id })
}
```

- [ ] **Step 2: Verify the route compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "save-retour|error" | head -10
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/videos/save-retour/route.ts
git commit -m "feat(api): POST /api/videos/save-retour"
```

---

## Task 11: API route `GET /api/videos/retour-signed-url`

**Files:**
- Create: `app/api/videos/retour-signed-url/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/videos/retour-signed-url/route.ts` with:

```ts
import { createClient } from '@supabase/supabase-js'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'

export const maxDuration = 10

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  return _supabaseAdmin
}

const TTL_SECONDS = 3600  // 1 hour

export async function GET(request: Request) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(request)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  const { searchParams } = new URL(request.url)
  const retourId = searchParams.get('id')
  if (!retourId) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getSupabaseAdmin()

  // Fetch the retour and verify access
  const { data: retour, error } = await supabase
    .from('bilan_retours')
    .select('id, athlete_id, coach_id, video_path, thumbnail_path, archived_at, athletes(user_id)')
    .eq('id', retourId)
    .maybeSingle()

  if (error || !retour) return Response.json({ error: 'Not found' }, { status: 404 })
  if (retour.archived_at) return Response.json({ error: 'Archived' }, { status: 410 })
  if (!retour.video_path || !retour.thumbnail_path) return Response.json({ error: 'No video' }, { status: 404 })

  // Access check: caller must be the coach OR the athlete (via athletes.user_id)
  const isCoach = retour.coach_id === user.id
  // athletes was joined as nested; depending on PG/PostgREST it may be array or object
  type AthleteRef = { user_id: string | null } | { user_id: string | null }[] | null
  const athletesRef = retour.athletes as AthleteRef
  const athleteUserId = Array.isArray(athletesRef)
    ? athletesRef[0]?.user_id
    : athletesRef?.user_id ?? null
  const isAthlete = !!athleteUserId && athleteUserId === user.id

  if (!isCoach && !isAthlete) return Response.json({ error: 'Forbidden' }, { status: 403 })

  // Generate signed URLs
  const [{ data: vidSigned, error: vidErr }, { data: thumbSigned, error: thumbErr }] = await Promise.all([
    supabase.storage.from('coach-video').createSignedUrl(retour.video_path, TTL_SECONDS),
    supabase.storage.from('coach-video').createSignedUrl(retour.thumbnail_path, TTL_SECONDS),
  ])

  if (vidErr || !vidSigned) return Response.json({ error: 'Sign video URL failed' }, { status: 500 })
  if (thumbErr || !thumbSigned) return Response.json({ error: 'Sign thumb URL failed' }, { status: 500 })

  return Response.json({
    videoUrl: vidSigned.signedUrl,
    thumbnailUrl: thumbSigned.signedUrl,
    expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
  })
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "retour-signed-url|error" | head -10
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/videos/retour-signed-url/route.ts
git commit -m "feat(api): GET /api/videos/retour-signed-url"
```

---

## Task 12: API cron route + vercel.json schedule

**Files:**
- Create: `app/api/videos/archive-old-retours/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron route**

Create `app/api/videos/archive-old-retours/route.ts` with:

```ts
import { createClient } from '@supabase/supabase-js'
import { verifyCronSecret, authErrorResponse } from '@/lib/api/auth'

export const maxDuration = 60

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  return _supabaseAdmin
}

const RETENTION_DAYS = 30
const BATCH_SIZE = 100

export async function GET(request: Request) {
  try { verifyCronSecret(request) } catch (err) { return authErrorResponse(err) }

  const supabase = getSupabaseAdmin()
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400 * 1000).toISOString()

  // 1. Query batch of candidates
  const { data: candidates, error: qErr } = await supabase
    .from('bilan_retours')
    .select('id, video_path, thumbnail_path')
    .lt('created_at', cutoff)
    .is('archived_at', null)
    .not('video_path', 'is', null)
    .limit(BATCH_SIZE)

  if (qErr) return Response.json({ error: 'Query failed', details: qErr.message }, { status: 500 })
  if (!candidates || candidates.length === 0) return Response.json({ archived: 0, message: 'No candidates' })

  // 2. Delete files from storage
  const paths: string[] = []
  for (const r of candidates) {
    if (r.video_path) paths.push(r.video_path)
    if (r.thumbnail_path) paths.push(r.thumbnail_path)
  }
  const { error: delErr } = await supabase.storage.from('coach-video').remove(paths)
  if (delErr) {
    console.error('[archive] storage.remove error (continuing to mark archived):', delErr)
    // Don't fail — we still want to mark archived to avoid retry loops on missing files
  }

  // 3. Mark as archived
  const ids = candidates.map(r => r.id)
  const { error: updErr } = await supabase
    .from('bilan_retours')
    .update({ archived_at: new Date().toISOString() })
    .in('id', ids)
  if (updErr) return Response.json({ error: 'Update failed', details: updErr.message }, { status: 500 })

  return Response.json({ archived: ids.length, ids })
}
```

- [ ] **Step 2: Update `vercel.json`**

Read current file then overwrite:

```bash
cat /Users/pierrerebmann/MOMENTUM/COACH/vercel.json
```

Edit to add the cron + maxDuration config. Final content:

```json
{
  "framework": "nextjs",
  "buildCommand": "next build --webpack",
  "functions": {
    "app/api/stripe/route.ts": { "maxDuration": 30 },
    "app/api/stripe/webhook/route.ts": { "maxDuration": 30 },
    "app/api/stripe/cron/route.ts": { "maxDuration": 120 },
    "app/api/instagram/messages/route.ts": { "maxDuration": 60 },
    "app/api/instagram/sync-reels/route.ts": { "maxDuration": 30 },
    "app/api/instagram/sync-stories/route.ts": { "maxDuration": 30 },
    "app/api/videos/save-retour/route.ts": { "maxDuration": 30 },
    "app/api/videos/archive-old-retours/route.ts": { "maxDuration": 60 }
  },
  "crons": [
    { "path": "/api/instagram/sync-stories", "schedule": "0 8 * * *" },
    { "path": "/api/stripe/cron", "schedule": "0 9 * * *" },
    { "path": "/api/videos/archive-old-retours", "schedule": "0 3 * * *" }
  ]
}
```

- [ ] **Step 3: Verify TS compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "archive-old-retours|error" | head -10
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/videos/archive-old-retours/route.ts vercel.json
git commit -m "feat(api): archive-old-retours cron + vercel.json schedule"
```

---

## Task 13: `RetourVideoPlayer` component

**Files:**
- Create: `components/videos/RetourVideoPlayer.tsx`
- Create: `components/videos/RetourVideoPlayer.module.css`

- [ ] **Step 1: Create the styles**

Create `components/videos/RetourVideoPlayer.module.css` with:

```css
.wrapper {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}
.video {
  width: 100%;
  display: block;
  max-height: 70vh;
}
.archived {
  padding: 24px;
  text-align: center;
  color: var(--text2);
  font-size: 14px;
  background: var(--card-bg-2, #2a2a2a);
  border-radius: 8px;
}
.controls {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.85);
}
.speedBtn {
  background: transparent;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
}
.speedBtnActive { background: var(--primary, #5b8dff); border-color: var(--primary, #5b8dff); }
```

- [ ] **Step 2: Create the component**

Create `components/videos/RetourVideoPlayer.tsx` with:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = createClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [urls, setUrls] = useState<SignedUrls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speed, setSpeed] = useState<number>(1)

  useEffect(() => {
    if (archived) return
    let cancelled = false

    async function fetchUrls() {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) { setError('Session expirée'); return }

        const res = await fetch(`/api/videos/retour-signed-url?id=${encodeURIComponent(retourId)}`, {
          headers: { Authorization: `Bearer ${token}` },
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
  }, [retourId, archived, supabase])

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
```

- [ ] **Step 3: Commit**

```bash
git add components/videos/RetourVideoPlayer.tsx components/videos/RetourVideoPlayer.module.css
git commit -m "feat(player): RetourVideoPlayer with speed control"
```

---

## Task 14: Wire button + display into retours page

**Files:**
- Modify: `app/(app)/athletes/[id]/retours/page.tsx`

- [ ] **Step 1: Add native record button alongside the existing Loom URL flow**

Open `app/(app)/athletes/[id]/retours/page.tsx`. Apply these changes:

**A. Update imports (top of file):** add after the existing imports:
```tsx
import StartRecordingModal from '@/components/recorder/StartRecordingModal'
import RetourVideoPlayer from '@/components/videos/RetourVideoPlayer'
```

**B. Update the local state and select query:** the SELECT must now also fetch the new columns.

Replace the `loadRetours` function's select line:
```tsx
.select('id, athlete_id, coach_id, loom_url, titre, commentaire, type, created_at')
```
with:
```tsx
.select('id, athlete_id, coach_id, loom_url, titre, commentaire, type, created_at, video_path, thumbnail_path, duration_s, archived_at, audio_url')
```

**C. Add the new modal state near other useState calls:**
```tsx
const [showRecordModal, setShowRecordModal] = useState(false)
```

**D. Update the header buttons block (around line 100-106).** Replace:
```tsx
<button className="btn btn-red" onClick={() => setShowModal(true)}>
  <i className="fas fa-video" /> Envoyer un retour video
</button>
```
with:
```tsx
<div style={{ display: 'flex', gap: 8 }}>
  <button className="btn btn-red" onClick={() => setShowRecordModal(true)}>
    <i className="fas fa-circle" /> Enregistrer un retour
  </button>
  <button className="btn btn-outline" onClick={() => setShowModal(true)}>
    <i className="fas fa-link" /> Lien Loom
  </button>
</div>
```

**E. Update the card rendering inside `retours.map((r) => ...)`:** replace the entire card body (the current implementation around lines 114-142) with:
```tsx
return (
  <div key={r.id} className={styles.retourCard}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
      <div className={styles.retourIcon}>
        <i className={`fas ${r.video_path ? 'fa-video' : r.audio_url ? 'fa-microphone' : r.loom_url ? 'fa-link' : 'fa-comment'}`} style={{ color: 'var(--primary)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{r.titre || 'Retour bilan'}</div>
        {r.commentaire && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{r.commentaire}</div>}

        {r.video_path && (
          <div style={{ marginTop: 10 }}>
            <RetourVideoPlayer retourId={r.id} archived={!!r.archived_at} />
          </div>
        )}
        {r.audio_url && !r.video_path && (
          <div style={{ marginTop: 6 }}>
            <audio controls src={r.audio_url} style={{ height: 28, maxWidth: 250 }} />
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{date}</div>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      {r.loom_url && !r.video_path && (
        <a href={r.loom_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
          <i className="fas fa-external-link-alt" /> Voir
        </a>
      )}
      <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteRetour(r.id)}>
        <i className="fas fa-trash" />
      </button>
    </div>
  </div>
)
```

**F. Add the StartRecordingModal at the end of the JSX, just before closing the outermost `<div>`:**
```tsx
<StartRecordingModal
  isOpen={showRecordModal}
  onClose={() => setShowRecordModal(false)}
  athleteId={params.id}
/>
```

**G. Update `deleteRetour` to also delete storage files when video_path exists.** Replace the current function with:
```tsx
async function deleteRetour(id: string) {
  if (!confirm('Supprimer ce retour video ?')) return
  // Find the retour to know if there's video_path to clean
  const target = retours.find(r => r.id === id)
  if (target?.video_path) {
    // best-effort cleanup; RLS allows coach to delete own files
    const paths = [target.video_path, target.thumbnail_path].filter(Boolean) as string[]
    if (paths.length) await supabase.storage.from('coach-video').remove(paths)
  }
  const { error } = await supabase.from('bilan_retours').delete().eq('id', id)
  if (error) { toast('Erreur lors de la suppression', 'error'); return }
  toast('Retour supprime', 'success')
  loadRetours()
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "retours/page|StartRecording|RetourVideoPlayer|error" | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/athletes/\[id\]/retours/page.tsx
git commit -m "feat(retours): native screen recorder button + video player"
```

---

## Task 15: End-to-end smoke test

**Files:** None to create. This is a manual verification gate.

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
npm run dev
```

Wait for "Ready in X.Xs" on a port (default 3000).

- [ ] **Step 2: Verify pre-flight prerequisites**

Open Supabase dashboard, confirm:
- Project on Pro plan (badge visible)
- Bucket `coach-video` exists, private
- Run in SQL Editor:
  ```sql
  SELECT count(*) FROM information_schema.columns WHERE table_name = 'bilan_retours' AND column_name = 'video_path';
  ```
  Expected: 1
- Run:
  ```sql
  SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%video%';
  ```
  Expected: 3 rows (write/delete/read)

- [ ] **Step 3: Test recording flow with webcam OFF**

In Chrome:
1. Login as coach, navigate to any athlete → Retours techniques tab
2. Click "Enregistrer un retour"
3. Modal opens. Webcam toggle OFF. Click "Démarrer"
4. Browser asks for screen share — pick a tab
5. Browser asks for mic — allow
6. Modal closes, **floating pill bottom-right** appears with red dot + 00:01 timer
7. Navigate to `/dashboard` then `/athletes` — pill stays, timer continues
8. Return to athlete retours, talk for 10 seconds
9. Click "Stop" on the pill
10. Pill becomes "Traitement…" then RetourFinalizeModal opens
11. Video preview plays. Title pre-filled with today's date. Click "Envoyer"
12. Pill becomes "Envoi… X%" then disappears
13. Toast green "Retour vidéo envoyé !"
14. Liste retours refreshes, new card appears with video icon + inline player
15. Click play → video plays. Click "1.5×" → speed changes. Click "2×" → faster.

If any step fails, capture browser console + network tab errors before continuing.

- [ ] **Step 4: Test recording flow with webcam ON**

Repeat Task 15 / Step 3 but check the webcam toggle in the StartRecordingModal.
1. Browser asks for webcam permission too
2. **Verify the recorded video has a circular webcam bubble in bottom-left corner**
3. Verify file size is reasonable (~50-150 MB for 5 min)

- [ ] **Step 5: Test rejection paths**

- Click "Démarrer" then **cancel the screen share dialog** → toast error "Tu as refusé le partage d'écran." Pill does not appear.
- Start recording → click "Annuler" on pill → confirm → pill disappears, no Storage upload.
- During upload, network throttling to 3G in DevTools → upload completes (slow but works).

- [ ] **Step 6: Test playback signed URL on coach side**

In Chrome DevTools Network tab, refresh the retours page:
- See `GET /api/videos/retour-signed-url?id=...` with 200 + JSON body containing `videoUrl` (long signed URL with `token=` query param)
- Video element loads from that URL
- After 1 hour, refresh — new signed URL fetched

- [ ] **Step 7: Test access denial**

- Login as a different coach (or, if no second account, manually call the endpoint with another coach's ID via browser console):
  ```js
  fetch('/api/videos/retour-signed-url?id=<some-other-coachs-retour-id>', {
    headers: { Authorization: 'Bearer ' + (await supabase.auth.getSession()).data.session.access_token }
  }).then(r => r.status)
  ```
  Expected: `403`

- [ ] **Step 8: Test cron route locally**

```bash
curl -i "http://localhost:3000/api/videos/archive-old-retours" \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)"
```

Expected: 200 with body `{"archived":0,"message":"No candidates"}` (no rows >30j old yet).

To force-test, manually backdate a row:
```sql
-- in Supabase SQL Editor — replace <id> with a real retour id you just created
UPDATE bilan_retours SET created_at = now() - interval '31 days' WHERE id = '<id>';
```
Then re-run the curl. Expected: `{"archived":1,"ids":["..."]}`. Verify in Supabase Storage that the files are gone.

- [ ] **Step 9: ATHLETE app readiness check**

The ATHLETE app (separate repo `momentum-athlete`) currently consumes `bilan_retours` via the same DB. Quick check:

```sql
SELECT id, athlete_id, video_path, archived_at FROM bilan_retours WHERE video_path IS NOT NULL ORDER BY created_at DESC LIMIT 5;
```

Confirm at least 1 row from your tests. The ATHLETE app **needs a follow-up task** to render `video_path` retours via the same `/api/videos/retour-signed-url` endpoint. **That's out of scope of this plan** (it's a `momentum-athlete` repo change). Document the follow-up in `tasks/todo.md`:

```bash
echo "
## Follow-up — ATHLETE app
- [ ] Update RetourCard in momentum-athlete to detect video_path and fetch /api/videos/retour-signed-url
- [ ] Use expo-av Video component, support speed control 1x/1.5x/2x
- [ ] Hide loom_url + audio_url paths when video_path is set
" >> tasks/todo.md
```

- [ ] **Step 10: Commit verification artifacts**

```bash
git add tasks/todo.md
git commit -m "chore: log ATHLETE app follow-up tasks for native retours"
```

- [ ] **Step 11: Final regression check**

Confirm none of the existing flows broke:
- Send a Loom URL retour (the legacy flow) → still works, displays "Voir" link
- Send an audio retour from the bilans page → still works (different bucket, untouched)
- Open `/videos` → execution_videos still load + play

If all green, the v1 is ready to merge.

---

## Self-review notes

**Spec coverage check:**
- §3.1 Storage Pro + bucket → Pre-flight + Task 1 ✅
- §3.2 mp4 priority + fallback → Task 2 ✅
- §3.3 Canvas compositing webcam toggle → Tasks 3, 7 ✅
- §3.4 Persistent recorder during nav → Tasks 5, 9 ✅
- §3.5 Client-side thumbnail → Task 4 ✅
- §3.6 30-day archival cron → Task 12 ✅
- §3.7 RLS + signed URLs → Tasks 1, 11 ✅
- §4.2 Schema columns → Task 1 ✅
- §4.3 Bucket layout `<coach_id>/<retour_id>.<ext>` → Task 5 ✅
- §4.4 RecorderProvider interface → Task 5 ✅
- §4.5 Direct upload pattern → Task 5 ✅
- §4.6 API routes save-retour + signed-url → Tasks 10, 11 ✅
- §4.7 Player + speed control → Task 13 ✅
- §4.8 Vercel cron → Task 12 ✅
- §5.x UX flow → Tasks 6, 7, 8 + Task 14 wire-up ✅
- §6 File inventory → mapped 1-to-1 to tasks ✅
- §7 Success criteria → Task 15 smoke test covers all ✅

**Type/method consistency check:**
- `useScreenRecorder` returns `{ blob, durationS, width, height, mimeType, ext }` — used same shape in `RecorderContext` Task 5 ✅
- `extractThumbnail(Blob): Promise<Blob>` — exported in Task 4, called in Task 5 ✅
- `startCompositing(screenStream, camStream)` returns `{ canvas, stream, animFrameId }` — Task 3 + consumed in Task 2's hook ✅
- `RecorderContext.startRecording({ withWebcam, athleteId })` — defined Task 5, called Task 7 ✅
- `bilan_retours` columns: `video_path, thumbnail_path, duration_s, width, height, mime_type, archived_at` — defined Task 1, used in Tasks 10, 11, 12, 14 ✅
- API param names: `retourId, athleteId, videoPath, thumbnailPath, durationS, width, height, mimeType, titre, commentaire` — consistent across Task 5 (POST body) and Task 10 (route handler) ✅
- Cron route response `{ archived: number, ids?: string[] }` — used identically Task 12 ✅

**No placeholders found.**
