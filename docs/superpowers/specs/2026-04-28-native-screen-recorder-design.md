# Native Screen Recorder — Retours Techniques

**Date:** 2026-04-28
**Repo:** COACH (Next.js App Router, Supabase, Vercel)
**Auteur:** Pierre Rebmann (via brainstorming session)
**Statut:** Approved, ready for implementation plan

---

## 1. Contexte et motivation

Aujourd'hui, le coach donne des retours aux athlètes via 3 canaux dans la page `/athletes/[id]/retours`:
1. Texte libre (`commentaire`)
2. Audio (bucket `coach-audio`, via `useAudioRecorder.ts`)
3. URL Loom externe (champ `loom_url`)

Loom Business coûte $18/mois et reste un service tiers obligatoire pour ce flow. L'objectif est d'ajouter un **4e canal natif** : enregistrement vidéo écran + audio (+ webcam optionnelle) directement intégré dans COACH, stocké sur Supabase, et lisible dans l'ATHLETE app.

Les 3 canaux existants restent en place (rétrocompat + flexibilité pour autres coachs si plateforme s'élargit un jour).

## 2. Scope v1 — strict

**Inclus:**
- Bouton "Enregistrer un retour vidéo" sur la page `retours techniques` uniquement
- Capture: écran (choix utilisateur via browser dialog) + audio micro
- Webcam optionnelle (toggle au démarrage, off par défaut, composée en bulle ronde via canvas)
- Format de sortie: **mp4/h264** prioritaire, fallback webm si non supporté
- Cap durée: 15 min hard, warning visuel à 12 min
- Bitrate: 1.2 Mbps (qualité visuelle indistinguable pour du screen content)
- Recorder persistant pendant la navigation entre pages COACH
- Génération de thumbnail côté client (extraction d'une frame mp4)
- Vitesse de lecture côté athlète et coach (1x / 1.5x / 2x)
- Archivage automatique après 30 jours
- Notification push à l'athlète (réutilise `notifyAthlete`)

**Exclus (out-of-scope v1, peut venir plus tard):**
- Transcription automatique (Whisper)
- Commentaires timestampés sur la vidéo
- Analytics de vues
- Backup en IndexedDB pendant l'enregistrement (perte si crash browser)
- Application au-delà de "retours techniques" (bilans, posing : non v1)
- Upload streamé pendant l'enregistrement (single-shot upload au stop suffit pour v1)

## 3. Décisions clés

### 3.1 Stockage : Supabase Storage + upgrade Pro

**Décision:** Migrer le projet COACH/Supabase vers le plan Pro ($25/mo) et stocker les vidéos dans un nouveau bucket privé `coach-video`.

**Justification:**
- Supabase Free actuellement saturé à ~80% (808 MB / 1 GB) avant même cette feature, donc upgrade requis sous 1-2 mois indépendamment du projet
- Loom économisé ($18/mo) couvre 72% du coût Pro → coût net réel **+$7/mo**
- Pro débloque : 100 GB storage, 250 GB egress/mo, backups journaliers, suppression de la pause auto, daily metrics
- Cohérence single-vendor : reste du stack (auth, audio retours, photos, `execution_videos`) déjà sur Supabase
- Pattern `useAudioRecorder.ts` directement réutilisable

**Alternative considérée et rejetée:** Cloudflare R2 (free tier, zero egress) — rejeté car ajoute un second vendor, force migration des `execution_videos` pour vraiment résoudre le problème de saturation Free, et le delta économique est faible ($7/mo) vs la complexité d'opération.

### 3.2 Format de sortie : mp4 prioritaire

**Décision:** `MediaRecorder` configuré avec `mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'` si `isTypeSupported()` retourne true. Sinon fallback `video/webm;codecs=vp9,opus`.

**Justification:**
- L'ATHLETE app utilise `expo-av` qui exige du h264/mp4 sur iOS pour streaming progressif
- Safari (Mac) et Chrome ≥ 130 (2024+) supportent MP4 muxing natif dans MediaRecorder
- Pas de transcoding serveur requis → architecture beaucoup plus simple
- Firefox = webm seulement → message "utilise Chrome ou Safari pour enregistrer"

### 3.3 Capture composée écran + webcam

**Décision:** Toggle "Inclure ma webcam" au démarrage, off par défaut. Si activé, composition canvas 30 fps (écran plein cadre + cercle webcam 180×180px en bottom-left, 16px d'inset). `canvas.captureStream(30)` fournit la track vidéo, audio mic ajouté séparément.

**Justification:**
- Pour un retour technique, la voix + ce qu'on pointe à l'écran suffit dans 90% des cas
- Mais la bulle webcam apporte de la chaleur humaine quand le coach veut être explicitement présent (ex: bilan plus sensible)
- Le choix par enregistrement est trivial UX (case à cocher au démarrage)

### 3.4 Recorder persistant entre pages

**Décision:** `<RecorderProvider>` placé dans `app/(app)/layout.tsx`, au-dessus du tree des pages. Héberge MediaRecorder, streams, state. `<RecordingPill>` rendue dans le même provider, position `fixed` bottom-right, visible sur toutes les pages tant que `isRecording === true` ou `isUploading === true`.

**Justification:**
- Le provider ne se démonte pas pendant les navigations Next.js Client Router → recorder continue
- Le coach peut filmer l'app COACH en naviguant librement (séance → vidéo athlète → notes)
- C'est un avantage différenciant vs Loom qui filme tout l'OS y compris d'autres apps

### 3.5 Thumbnail extrait côté client

**Décision:** Au stop, charger le Blob mp4 dans un `<video>` caché, seek à `min(1, duration / 2)` secondes, dessiner sur un `<canvas>`, exporter en `image/jpeg` qualité 0.7. Upload du JPG en parallèle du mp4.

**Justification:**
- Élimine le besoin de ffmpeg server-side (Edge Function packaging lourd, timeouts)
- Le browser sait déjà décoder son propre mp4 → fiable
- ~30 lignes de code, zéro infra additionnelle

### 3.6 Archivage automatique 30 jours

**Décision:** Cron Supabase quotidien (via `pg_cron` ou Edge Function scheduled) qui:
1. Identifie les `bilan_retours` dont `created_at < now() - interval '30 days'` AND `archived_at IS NULL`
2. Pour chaque ligne avec `video_path` set, supprime le fichier du bucket `coach-video` ET la thumbnail associée
3. Set `archived_at = now()` sur la ligne

L'athlète et le coach voient toujours le titre + commentaire. La carte affiche un badge "Vidéo archivée" à la place du player.

**Justification:**
- Volume estimé 360 retours/mo × 70 MB = ~25 GB/mo nouveau
- Sans archivage, on accumule indéfiniment et on tape les 100 GB Pro en ~4 mois
- 30 jours = couvre largement le cycle d'usage réel (retours hebdomadaires consommés sous 7-14j)
- Paramètre facile à rallonger plus tard si besoin

### 3.7 Sécurité d'accès

**Décision:** Bucket `coach-video` privé, RLS sur les fichiers via path-prefix. Lecture via signed URL générée par API route Next.js, TTL 1h, cache côté client.

**RLS pattern:**
```sql
-- coach peut écrire sous son own coach_id
-- athlète peut lire les fichiers liés à un bilan_retours dont athlete_id = lui
```

L'API route `/api/videos/retour-signed-url?retour_id=X` vérifie:
1. L'utilisateur est authentifié
2. Le `bilan_retours` X existe
3. L'utilisateur est le coach OU l'athlète associé à `X.athlete_id`
4. Si oui, génère et retourne une signed URL

**Justification:**
- Cohérent avec les autres ressources Supabase (RLS first-class)
- Pas de leak public possible (pas de URL publique stable)
- L'athlète ne peut pas lister tous les retours, seulement les siens

## 4. Architecture technique

### 4.1 Vue d'ensemble du flux

```
┌─────────────────────────────────────────────────────────────────┐
│ COACH BROWSER                                                    │
│                                                                  │
│  RecorderProvider (layout)                                       │
│    ├─ getDisplayMedia() → screen track                           │
│    ├─ getUserMedia({ audio }) → mic track                        │
│    ├─ [optionnel] getUserMedia({ video }) → cam track            │
│    ├─ Canvas compositing 30fps → output video stream             │
│    ├─ MediaRecorder(combinedStream, { mimeType: 'video/mp4...' })│
│    └─ <RecordingPill> fixed bottom-right                         │
│                                                                  │
│  on stop:                                                        │
│    ├─ Concat chunks → Blob                                       │
│    ├─ Extract thumbnail via hidden <video> + <canvas>            │
│    ├─ Show modal "Titre + commentaire + envoyer"                 │
│    ├─ POST /api/videos/upload-retour                             │
│    │     - signed PUT URL pour mp4                               │
│    │     - signed PUT URL pour jpg                               │
│    │     - retour_id généré server-side                          │
│    ├─ PUT direct mp4 + jpg vers Supabase Storage                 │
│    └─ POST /api/videos/save-retour                               │
│          - INSERT bilan_retours                                  │
│          - notifyAthlete                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ SUPABASE                                                         │
│                                                                  │
│  Storage: coach-video/<coach_id>/<retour_id>.mp4                 │
│           coach-video/<coach_id>/<retour_id>.jpg                 │
│  DB:      bilan_retours { video_path, thumbnail_path, ... }      │
│  pg_cron: archive_old_retours() toutes les 24h                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ COACH WEB / ATHLETE APP (lecture)                                │
│                                                                  │
│  GET /api/videos/retour-signed-url?id=X                          │
│       → vérifie ownership → retourne signed URL 1h               │
│  <VideoPlayer src={signedUrl} poster={signedThumbUrl}>           │
│       + speed picker 1x / 1.5x / 2x                              │
│       + duration display                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Schema database

**Table existante `bilan_retours` — colonnes ajoutées:**

```sql
ALTER TABLE bilan_retours
  ADD COLUMN video_path text,         -- ex: 'abc-coach-uuid/retour-xyz.mp4'
  ADD COLUMN thumbnail_path text,     -- ex: 'abc-coach-uuid/retour-xyz.jpg'
  ADD COLUMN duration_s int,
  ADD COLUMN width int,
  ADD COLUMN height int,
  ADD COLUMN mime_type text,          -- 'video/mp4' ou 'video/webm'
  ADD COLUMN archived_at timestamptz; -- null = vidéo encore présente
```

`loom_url` reste inchangé pour rétrocompat. `audio_url` reste inchangé (autre type de retour). Les anciens retours continuent de fonctionner sans migration.

**Logique d'affichage côté client (priorité):**
```
si archived_at !== null      → badge "Vidéo archivée (>30j)"
sinon si video_path          → <VideoPlayer> + signed URL
sinon si loom_url            → <iframe> Loom (legacy)
sinon si audio_url           → <audio>
sinon                        → texte seul (commentaire)
```

### 4.3 Bucket Supabase Storage

**Nom:** `coach-video`
**Visibilité:** privée
**Path layout:** `<coach_id>/<retour_id>.<ext>` (mp4 et jpg)

**RLS policies (à appliquer via SQL):**

```sql
-- coach peut INSERT sous son own coach_id (path commence par son uuid)
CREATE POLICY "coach_write_own_videos" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'coach-video'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- coach peut DELETE ses propres fichiers (utile pour archivage manuel)
CREATE POLICY "coach_delete_own_videos" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'coach-video'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- la lecture passe par signed URL générée côté server, pas par RLS direct
-- donc pas de policy SELECT au niveau storage.objects
```

### 4.4 RecorderProvider — interface React

```ts
interface RecorderContextValue {
  // state
  isRecording: boolean
  seconds: number
  isUploading: boolean
  uploadProgress: number      // 0-100
  withWebcam: boolean

  // actions
  startRecording(opts: { withWebcam: boolean, athleteId: string }): Promise<void>
  stopRecording(): Promise<{ blob: Blob, thumbnailBlob: Blob, durationS: number, width: number, height: number, mimeType: string }>
  cancelRecording(): void

  // pending blob (waiting for user to fill modal)
  pendingRecording: PendingRecording | null
  finalizeRecording(meta: { titre: string, commentaire?: string }): Promise<void>
}
```

**Localisation:** `contexts/RecorderContext.tsx`
**Provider mounted:** `app/(app)/layout.tsx`
**Pill component:** `components/recorder/RecordingPill.tsx`
**Modal component:** `components/recorder/RetourFinalizeModal.tsx`

### 4.5 Upload côté client (pattern existant)

L'upload se fait **directement depuis le browser via le client Supabase authentifié** (même pattern que `useAudioRecorder.ts` avec `coach-audio`). Pas besoin de signed PUT URLs ni d'API route intermédiaire pour l'upload — les RLS policies path-based sécurisent l'écriture (`(storage.foldername(name))[1] = auth.uid()::text`).

```ts
const retourId = crypto.randomUUID()
const videoPath = `${coachId}/${retourId}.mp4`
const thumbnailPath = `${coachId}/${retourId}.jpg`

await Promise.all([
  supabase.storage.from('coach-video').upload(videoPath, videoBlob, { contentType: mimeType }),
  supabase.storage.from('coach-video').upload(thumbnailPath, thumbnailBlob, { contentType: 'image/jpeg' }),
])
```

### 4.6 API routes Next.js (lecture + insert)

**`POST /api/videos/save-retour`**
- Auth: cookie session, retrieve coach `user_id`
- Input: `{ retourId, athleteId, videoPath, thumbnailPath, durationS, width, height, mimeType, titre, commentaire? }`
- Validation: athlete appartient au coach
- Action: INSERT `bilan_retours` + `notifyAthlete()` push
- Output: `{ ok: true, id }`

**`GET /api/videos/retour-signed-url?id=<retour_id>`**
- Auth: cookie session
- Validation: utilisateur est coach OU athlete du `bilan_retours`
- Action: génère signed GET URLs via `supabase.storage.from('coach-video').createSignedUrl(path, 3600)`
- Output: `{ videoUrl, thumbnailUrl, expiresAt }` (TTL 3600s)

### 4.7 Player partagé

**Composant:** `components/videos/RetourVideoPlayer.tsx`
- Props: `{ retourId: string }`
- Fetch signed URLs via `/api/videos/retour-signed-url`
- HTML5 `<video controls poster={thumbUrl} preload="metadata">`
- Custom speed control overlay (3 boutons: 1x, 1.5x, 2x → set `videoEl.playbackRate`)
- Affichage durée totale + temps écoulé
- Re-fetch URL si expirée (intercept HTML5 video error event)

Côté ATHLETE app : composant équivalent avec `expo-av` `Video` component, même API REST côté serveur.

### 4.8 Cron archivage 30 jours

**Approche:** Vercel cron (déjà utilisé dans `app/api/stripe/cron/route.ts`) qui appelle une route `/api/videos/archive-old-retours`. Une SQL function PL/pgSQL ne peut pas supprimer de fichiers Storage, donc tout passe par cette route Node.js qui orchestre query DB + delete Storage + update DB.

**Route `/api/videos/archive-old-retours`:**
```ts
// auth via verifyCronSecret() depuis @/lib/api/auth (pattern stripe/cron existant)
// 1. Query rows à archiver
const { data: oldRetours } = await supabaseAdmin
  .from('bilan_retours')
  .select('id, video_path, thumbnail_path')
  .lt('created_at', new Date(Date.now() - 30 * 86400e3).toISOString())
  .is('archived_at', null)
  .not('video_path', 'is', null)

// 2. Delete Storage files par batch
const pathsToDelete = oldRetours.flatMap(r => [r.video_path, r.thumbnail_path])
await supabaseAdmin.storage.from('coach-video').remove(pathsToDelete)

// 3. Mark as archived in DB
const ids = oldRetours.map(r => r.id)
await supabaseAdmin.from('bilan_retours').update({ archived_at: new Date().toISOString() }).in('id', ids)

return Response.json({ archived: ids.length })
```

**Vercel cron schedule** (dans `vercel.json`):
```json
{ "path": "/api/videos/archive-old-retours", "schedule": "0 3 * * *" }
```

→ Tourne tous les jours à 3h UTC. Authentifié via `verifyCronSecret(request)` (cohérent avec `app/api/stripe/cron/route.ts`).

## 5. UX Flow détaillé

### 5.1 Démarrer un enregistrement

1. Coach sur `/athletes/[id]/retours`, clique "Enregistrer un retour vidéo" (nouveau bouton, à côté du "Envoyer un retour vidéo (URL Loom)" existant)
2. Modal pré-record affiche:
   - Toggle "Inclure ma webcam" (off par défaut)
   - Bouton "Démarrer l'enregistrement"
   - Note explicative: "Tu choisiras quel écran/onglet partager au prochain écran"
3. Click démarrer → browser dialog natif `getDisplayMedia` → coach choisit (écran entier / fenêtre / onglet)
4. Si webcam ON: 2e dialog `getUserMedia({ video: true })` pour permission caméra
5. 3e dialog `getUserMedia({ audio: true })` pour permission micro
6. Compteur de 3 secondes avant le vrai start (laisse le temps de basculer sur la bonne fenêtre)
7. Recording démarre → modal pré-record se ferme → `<RecordingPill>` apparaît bottom-right

### 5.2 Pendant l'enregistrement

- `<RecordingPill>` affiche:
  - Point rouge clignotant + timer `MM:SS`
  - Bouton "Stop" (rouge)
  - Bouton "Annuler" (gris, demande confirmation)
- Coach peut naviguer librement dans COACH (séance, vidéos d'exos, notes)
- À 12 min, le timer devient orange + tooltip "Cap à 15 min"
- À 15 min, stop automatique avec toast info

### 5.3 Stop → finalize

1. Coach clique Stop sur la pill
2. Pill devient "Traitement..." pendant que:
   - MediaRecorder concatène les chunks
   - Thumbnail extrait via canvas
3. Modal `RetourFinalizeModal` s'ouvre:
   - Preview vidéo (lecture locale du Blob)
   - Champ "Titre" (placeholder: "Retour technique du 28 avril")
   - Champ "Commentaire" (optionnel)
   - Si on n'est plus sur la page de l'athlète, dropdown "Athlète destinataire"
   - Bouton "Envoyer" + "Annuler"
4. Click Envoyer:
   - Pill devient "Envoi... XX%"
   - 2 PUTs parallèles vers Supabase Storage
   - POST save-retour
   - Toast success + close modal + refresh liste retours

### 5.4 Lecture côté coach

- Sur `/athletes/[id]/retours`, chaque carte avec `video_path` affiche:
  - Thumbnail (poster)
  - Click → player inline (ou modal selon UX)
  - Speed picker 1x/1.5x/2x
  - Bouton supprimer (DELETE retour + cleanup storage)

### 5.5 Lecture côté athlète (ATHLETE app)

Hors scope de ce repo COACH, mais à prévoir comme tâche dans le repo ATHLETE:
- Composant `RetourVideoCard` qui détecte `video_path !== null`
- Fetch signed URL via même API route Next.js
- expo-av Video component avec speed picker (`setRateAsync`)

## 6. Composants à créer / modifier

### Nouveaux fichiers

```
contexts/
  RecorderContext.tsx              # Provider + hooks

components/recorder/
  RecordingPill.tsx                # Floating UI bottom-right
  StartRecordingModal.tsx          # Pre-record modal (webcam toggle)
  RetourFinalizeModal.tsx          # Post-record modal (titre + commentaire)
  CanvasCompositor.ts              # Logique compositing screen + webcam

components/videos/
  RetourVideoPlayer.tsx            # Player avec speed control

hooks/
  useScreenRecorder.ts             # Hook bas niveau (getDisplayMedia + MediaRecorder)
  useThumbnailExtractor.ts         # Extract frame from blob

app/api/videos/
  save-retour/route.ts             # INSERT bilan_retours + push notif
  retour-signed-url/route.ts       # Generate signed GET URLs (TTL 1h)
  archive-old-retours/route.ts     # Vercel cron handler (30j cleanup)

sql/
  bilan_retours_video_columns.sql  # ALTER TABLE migration (colonnes vidéo)
  coach_video_bucket_rls.sql       # RLS policies storage.objects (bucket créé via dashboard)

vercel.json                        # Ajout du cron archive-old-retours
```

### Fichiers modifiés

```
app/(app)/layout.tsx               # Wrap avec <RecorderProvider>
app/(app)/athletes/[id]/retours/page.tsx
                                   # Ajout bouton "Enregistrer" + affichage video_path
                                   # Maintien du flow Loom URL existant
```

## 7. Critères de succès v1

- [ ] Coach peut enregistrer un retour vidéo screen+audio en cliquant un bouton
- [ ] Toggle webcam fonctionne, bulle composée correctement en bottom-left
- [ ] Recorder continue pendant la navigation entre pages COACH
- [ ] Vidéo lisible sur Chrome desktop, Safari Mac, Safari iOS, Android Chrome
- [ ] Thumbnail générée et affichée comme poster
- [ ] Speed control 1x/1.5x/2x fonctionne côté COACH
- [ ] Athlète reçoit notification push avec le titre du retour
- [ ] Athlète peut lire la vidéo dans l'ATHLETE app (au moins en stub côté app : URL accessible)
- [ ] Archivage cron tourne et supprime les retours > 30j
- [ ] Coût Supabase storage observé ≤ 50 GB après 1 mois d'usage réel
- [ ] Aucune régression sur le flow Loom URL existant

## 8. Risques connus

| Risque | Impact | Mitigation |
|---|---|---|
| Browser crash pendant enregistrement → perte | Moyen | V2: backup chunks IndexedDB |
| Connexion lente coupe upload 100 MB | Moyen | V2: TUS resumable. V1: retry simple |
| Firefox utilisateur sans support mp4 | Faible | Message "Utilise Chrome/Safari" + détection au démarrage |
| iOS Safari ne supporte pas getDisplayMedia | Faible | Coach utilise Mac/Windows desktop, pas iPad. À documenter |
| Volume réel > estimation, dépassement Pro 100 GB | Faible | Réduire rétention à 14j. Monitor mensuel via daily metrics |
| Vidéo trop grosse upload échoue | Moyen | Cap 15 min + bitrate 1.2 Mbps borne taille à ~150 MB max |

## 9. Coûts récapitulatif

| Item | $/mois |
|---|---|
| Supabase Pro | $25.00 |
| Loom (économisé) | -$18.00 |
| **Net delta vs aujourd'hui** | **+$7.00** |
| Bénéfices Pro inclus | backups, no auto-pause, 100x storage, 50x egress |

## 10. Hors scope explicite (à ne PAS faire en v1)

- Application aux pages `/bilans` et `/posing` (planifié pour v2 si la v1 est validée)
- Transcription Whisper (v2)
- Commentaires timestampés sur la vidéo (v2)
- Analytics de vues (v2)
- Backup IndexedDB (v2)
- Upload streamé pendant l'enregistrement / TUS (v2)
- Migration des `loom_url` existants vers le nouveau format (jamais : on les laisse vivre)

---

## Annexe A — Snippets clés

### Détection mp4 support

```ts
function getSupportedMimeType(): { mimeType: string, ext: 'mp4' | 'webm' } {
  const candidates = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' as const },
    { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' as const },
    { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' as const },
  ]
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) return c
  }
  throw new Error('No supported video MIME type for MediaRecorder')
}
```

### Canvas compositing

```ts
function startCompositing(screenStream: MediaStream, camStream: MediaStream | null): MediaStream {
  const canvas = document.createElement('canvas')
  const screenVideo = document.createElement('video')
  const camVideo = camStream ? document.createElement('video') : null
  screenVideo.srcObject = screenStream
  screenVideo.muted = true
  screenVideo.play()
  if (camVideo) {
    camVideo.srcObject = camStream
    camVideo.muted = true
    camVideo.play()
  }
  const ctx = canvas.getContext('2d')!
  const draw = () => {
    if (screenVideo.readyState >= 2) {
      canvas.width = screenVideo.videoWidth
      canvas.height = screenVideo.videoHeight
      ctx.drawImage(screenVideo, 0, 0)
      if (camVideo && camVideo.readyState >= 2) {
        const r = 90
        const cx = 16 + r
        const cy = canvas.height - 16 - r
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(camVideo, cx - r, cy - r, r * 2, r * 2)
        ctx.restore()
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.lineWidth = 4
        ctx.strokeStyle = 'white'
        ctx.stroke()
      }
    }
    requestAnimationFrame(draw)
  }
  draw()
  return canvas.captureStream(30)
}
```

### Thumbnail extraction

```ts
async function extractThumbnail(videoBlob: Blob): Promise<Blob> {
  const video = document.createElement('video')
  video.src = URL.createObjectURL(videoBlob)
  video.muted = true
  await new Promise(r => video.onloadedmetadata = r as any)
  video.currentTime = Math.min(1, video.duration / 2)
  await new Promise(r => video.onseeked = r as any)
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d')!.drawImage(video, 0, 0)
  URL.revokeObjectURL(video.src)
  return new Promise<Blob>((res, rej) => {
    canvas.toBlob(b => b ? res(b) : rej(new Error('thumbnail failed')), 'image/jpeg', 0.7)
  })
}
```
