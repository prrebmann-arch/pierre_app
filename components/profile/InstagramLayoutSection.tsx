'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Card from '@/components/ui/Card'
import styles from '@/styles/profile.module.css'

const BUCKET = 'content-drafts'
function layoutPath(userId: string) {
  // Premier segment = user.id pour passer la RLS du bucket content-drafts
  return `${userId}/instagram-layout.png`
}

const EXPECTED_W = 1080
const EXPECTED_H = 1350

export default function InstagramLayoutSection() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [layoutUrl, setLayoutUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  const refreshLayout = useCallback(async () => {
    if (!user?.id) return
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(layoutPath(user.id))
    try {
      const res = await fetch(`${data.publicUrl}?t=${Date.now()}`, { method: 'HEAD' })
      setLayoutUrl(res.ok ? `${data.publicUrl}?t=${Date.now()}` : null)
    } catch {
      setLayoutUrl(null)
    }
  }, [user?.id, supabase])

  useEffect(() => { refreshLayout() }, [refreshLayout])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user?.id) return

    if (file.type !== 'image/png') {
      toast('Le layout doit être un PNG (avec transparence)', 'error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('Fichier trop lourd (max 10 MB)', 'error')
      return
    }

    // Optional dimension check (warning only)
    const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve(null)
      img.src = URL.createObjectURL(file)
    })
    if (dims && (dims.w !== EXPECTED_W || dims.h !== EXPECTED_H)) {
      const ok = confirm(
        `Le PNG fait ${dims.w}×${dims.h}, le format Instagram portrait attendu est ${EXPECTED_W}×${EXPECTED_H}. Uploader quand même ?`,
      )
      if (!ok) return
    }

    setUploading(true)
    try {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(layoutPath(user.id), file, {
          contentType: 'image/png',
          upsert: true,
          cacheControl: '60',
        })
      if (error) throw error
      toast('Layout enregistré !', 'success')
      await refreshLayout()
    } catch (err) {
      console.error('[InstagramLayout] upload error', err)
      const msg = err instanceof Error ? err.message : String(err)
      toast(`Erreur: ${msg}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!user?.id) return
    if (!confirm('Supprimer le layout Instagram ?')) return
    setRemoving(true)
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([layoutPath(user.id)])
      if (error) throw error
      toast('Layout supprimé', 'success')
      setLayoutUrl(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast(`Erreur: ${msg}`, 'error')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card title="Layout export Instagram" className={styles.section}>
      <div className={styles.cardBody}>
        <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13, lineHeight: 1.5 }}>
          PNG transparent {EXPECTED_W}×{EXPECTED_H}px (format Instagram portrait 4:5). Sera superposé
          sur les exports avant/après. Laisse transparent les zones où les photos doivent apparaître.
        </p>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 12 }}>
          {layoutUrl ? (
            <div style={{ position: 'relative', width: 120, aspectRatio: '4 / 5', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg3)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={layoutUrl} alt="Layout Instagram" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{ width: 120, aspectRatio: '4 / 5', borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12, padding: 8, textAlign: 'center' }}>
              Aucun layout
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}
            >
              <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'}`} style={{ marginRight: 6 }} />
              {layoutUrl ? 'Remplacer' : 'Uploader le layout'}
            </button>
            {layoutUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 8, fontWeight: 600, cursor: removing ? 'not-allowed' : 'pointer', fontSize: 13 }}
              >
                <i className={`fas ${removing ? 'fa-spinner fa-spin' : 'fa-trash'}`} style={{ marginRight: 6 }} />
                Supprimer
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
