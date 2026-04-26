'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import styles from '@/styles/bilans.module.css'

const POSITIONS = ['front', 'side', 'back'] as const
type Position = typeof POSITIONS[number]

const LABELS: Record<Position, string> = {
  front: 'Face',
  side: 'Profil',
  back: 'Dos',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  athleteId: string
  athletePrenom: string
  existingDates: string[] // dates des bilans déjà saisis (YYYY-MM-DD)
  onSuccess: () => void
}

export default function BilanPhotosUploadModal({
  isOpen,
  onClose,
  athleteId,
  athletePrenom,
  existingDates,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const supabase = createClient()
  const [date, setDate] = useState<string>(() => existingDates[0] || new Date().toISOString().slice(0, 10))
  const [files, setFiles] = useState<Partial<Record<Position, File>>>({})
  const [previews, setPreviews] = useState<Partial<Record<Position, string>>>({})
  const [uploading, setUploading] = useState(false)
  const inputRefs = {
    front: useRef<HTMLInputElement>(null),
    side: useRef<HTMLInputElement>(null),
    back: useRef<HTMLInputElement>(null),
  }

  // Reset state à chaque ouverture
  useEffect(() => {
    if (isOpen) {
      setDate(existingDates[0] || new Date().toISOString().slice(0, 10))
      setFiles({})
      setPreviews({})
    }
  }, [isOpen, existingDates])

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      Object.values(previews).forEach(u => { if (u) URL.revokeObjectURL(u) })
    }
  }, [previews])

  const dateHasBilan = useMemo(() => existingDates.includes(date), [existingDates, date])

  const handlePick = (pos: Position, file: File | null) => {
    setFiles(prev => {
      const next = { ...prev }
      if (file) next[pos] = file
      else delete next[pos]
      return next
    })
    setPreviews(prev => {
      if (prev[pos]) URL.revokeObjectURL(prev[pos]!)
      const next = { ...prev }
      if (file) next[pos] = URL.createObjectURL(file)
      else delete next[pos]
      return next
    })
  }

  const handleSubmit = async () => {
    const positions = POSITIONS.filter(p => files[p])
    if (positions.length === 0) {
      toast('Sélectionnez au moins une photo', 'error')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast('Date invalide', 'error')
      return
    }

    setUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { toast('Session expirée', 'error'); return }

      const fd = new FormData()
      fd.append('athlete_id', athleteId)
      fd.append('date', date)
      for (const p of positions) fd.append(p, files[p]!)

      const res = await fetch('/api/bilan-photos/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast(`Erreur: ${json.error || res.statusText}`, 'error')
        return
      }
      toast(`${positions.length} photo(s) importée(s) pour le ${date}`, 'success')
      onSuccess()
      onClose()
    } catch (err) {
      toast(`Erreur réseau: ${(err as Error).message}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  const s = styles
  return (
    <div className={s.btOverlay} onClick={(e) => { if (e.target === e.currentTarget && !uploading) onClose() }}>
      <div className={s.btPopup} style={{ width: 540 }}>
        <div className={s.btPopupHeader}>
          <div className={s.btPopupTitle}>
            <div className={s.btPopupAvatar}><i className="fas fa-camera" /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Importer photos de bilan</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>{athletePrenom}</div>
            </div>
          </div>
          <button onClick={onClose} disabled={uploading} aria-label="Fermer"
            style={{ background: 'transparent', border: 0, fontSize: 18, cursor: 'pointer', color: 'var(--text2)', padding: 4 }}>
            <i className="fas fa-times" />
          </button>
        </div>

        <div className={s.btPopupBody}>
          {/* Date */}
          <div style={{ marginBottom: 18 }}>
            <div className={s.btSectionLabel} style={{ marginBottom: 8 }}>Date du bilan</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              list="bilan-dates"
              disabled={uploading}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--bg2)',
                color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
              }}
            />
            <datalist id="bilan-dates">
              {existingDates.map(d => <option key={d} value={d} />)}
            </datalist>
            <div style={{ marginTop: 6, fontSize: 11, color: dateHasBilan ? 'var(--success)' : 'var(--warning)' }}>
              {dateHasBilan
                ? <><i className="fas fa-check-circle" /> Bilan existant — les photos seront ajoutées</>
                : <><i className="fas fa-info-circle" /> Aucun bilan à cette date — un bilan sera créé avec les photos</>}
            </div>
          </div>

          {/* 3 slots photos */}
          <div className={s.btSectionLabel} style={{ marginBottom: 8 }}>Photos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {POSITIONS.map((pos) => (
              <div key={pos} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  ref={inputRefs[pos]}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handlePick(pos, e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => inputRefs[pos].current?.click()}
                  disabled={uploading}
                  style={{
                    aspectRatio: '3 / 4',
                    border: previews[pos] ? '2px solid var(--primary)' : '2px dashed var(--border)',
                    borderRadius: 12, background: 'var(--bg2)',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    overflow: 'hidden', position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  {previews[pos] ? (
                    <img src={previews[pos]} alt={LABELS[pos]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--text3)' }}>
                      <i className="fas fa-image" style={{ fontSize: 24 }} />
                      <span style={{ fontSize: 11 }}>Choisir</span>
                    </div>
                  )}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{LABELS[pos]}</span>
                  {previews[pos] && (
                    <button
                      type="button"
                      onClick={() => handlePick(pos, null)}
                      disabled={uploading}
                      style={{ background: 'transparent', border: 0, color: 'var(--danger)', fontSize: 11, cursor: 'pointer', padding: 0 }}
                      aria-label="Retirer"
                    >
                      <i className="fas fa-times" /> Retirer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={s.btPopupFooter}>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{
              padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading || Object.keys(files).length === 0}
            style={{
              padding: '8px 16px', borderRadius: 10, border: 0,
              background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: uploading ? 'wait' : 'pointer', opacity: Object.keys(files).length === 0 ? 0.5 : 1,
            }}
          >
            {uploading ? <><i className="fas fa-spinner fa-spin" /> Import...</> : <><i className="fas fa-upload" /> Importer</>}
          </button>
        </div>
      </div>
    </div>
  )
}
