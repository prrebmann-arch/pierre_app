'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import styles from '@/styles/training.module.css'

interface CardioConfig {
  titre: string
  minutes: number | null
  bpm_min: number | null
  bpm_max: number | null
  frequence: string | null
}

interface CardioSectionProps {
  athleteId: string
  cardio: CardioConfig | null
  pasJournalier: number | null
  onSaved: () => void
}

const FREQ_LABELS: Record<string, string> = {
  post_training: 'Post training',
  repos: 'Jours de repos',
  '7j7': '7j/7',
}

export default function CardioSection({ athleteId, cardio, pasJournalier, onSaved }: CardioSectionProps) {
  const [editing, setEditing] = useState(false)
  const [titre, setTitre] = useState(cardio?.titre || '')
  const [minutes, setMinutes] = useState(cardio?.minutes?.toString() || '')
  const [bpmMin, setBpmMin] = useState(cardio?.bpm_min?.toString() || '')
  const [bpmMax, setBpmMax] = useState(cardio?.bpm_max?.toString() || '')
  const [frequence, setFrequence] = useState(cardio?.frequence || '')
  const [pas, setPas] = useState(pasJournalier?.toString() || '')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  async function handleSave() {
    if (!titre.trim()) {
      toast('Veuillez entrer un titre', 'error')
      return
    }
    setSaving(true)
    const cardioData: CardioConfig = {
      titre: titre.trim(),
      minutes: parseInt(minutes) || null,
      bpm_min: parseInt(bpmMin) || null,
      bpm_max: parseInt(bpmMax) || null,
      frequence: frequence || null,
    }
    const pasVal = parseInt(pas) || null
    const { error } = await supabase
      .from('athletes')
      .update({ cardio_config: cardioData, pas_journalier: pasVal })
      .eq('id', athleteId)
    setSaving(false)
    if (error) {
      toast('Erreur lors de la sauvegarde', 'error')
      return
    }
    toast('Cardio sauvegarde !')
    setEditing(false)
    onSaved()
  }

  async function handleDelete() {
    if (!confirm('Supprimer la configuration cardio ?')) return
    const { error } = await supabase
      .from('athletes')
      .update({ cardio_config: null })
      .eq('id', athleteId)
    if (error) {
      toast('Erreur lors de la suppression', 'error')
      return
    }
    toast('Cardio supprime')
    onSaved()
  }

  if (editing) {
    return (
      <div className={styles.cdCard}>
        <div className={styles.cdHeader}>
          <div className={styles.cdTitle}>
            <i className="fa-solid fa-heartbeat" /> Cardio
          </div>
          <button className={styles.cdBtn} onClick={() => setEditing(false)}>
            <i className="fa-solid fa-times" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Titre (ex: LISS Cardio)"
            className="rm-m-input"
            style={{ fontSize: 13 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label className="label-sm">Duree (min)</label>
              <input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                min={1}
                max={120}
                placeholder="30"
                className="rm-m-input"
                style={{ textAlign: 'center' }}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="label-sm">BPM cible</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="number"
                  value={bpmMin}
                  onChange={(e) => setBpmMin(e.target.value)}
                  min={60}
                  max={200}
                  placeholder="120"
                  className="rm-m-input"
                  style={{ textAlign: 'center' }}
                />
                <span style={{ color: 'var(--text3)', fontSize: 12 }}>&ndash;</span>
                <input
                  type="number"
                  value={bpmMax}
                  onChange={(e) => setBpmMax(e.target.value)}
                  min={60}
                  max={220}
                  placeholder="140"
                  className="rm-m-input"
                  style={{ textAlign: 'center' }}
                />
              </div>
            </div>
            <div>
              <label className="label-sm">
                <i className="fa-solid fa-shoe-prints" style={{ marginRight: 3 }} /> Pas/jour
              </label>
              <input
                type="number"
                value={pas}
                onChange={(e) => setPas(e.target.value)}
                min={0}
                max={100000}
                placeholder="10000"
                className="rm-m-input"
                style={{ textAlign: 'center' }}
              />
            </div>
          </div>
          <div>
            <label className="label-sm">Frequence</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {(['post_training', 'repos', '7j7'] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`${styles.cdFreqBtn} ${frequence === val ? styles.cdFreqBtnActive : ''}`}
                  onClick={() => setFrequence(val)}
                >
                  {FREQ_LABELS[val]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-red btn-sm" onClick={handleSave} disabled={saving}>
              <i className="fa-solid fa-save" /> Enregistrer
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!cardio && !pasJournalier) {
    return (
      <div className="card mb-20">
        <div className="card-header">
          <div className="card-title">
            <i className="fa-solid fa-heartbeat" /> Cardio & Activite
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
            <i className="fa-solid fa-plus" /> Ajouter
          </button>
        </div>
        <div className="empty-state" style={{ padding: 20 }}>
          <i className="fa-solid fa-heart-pulse" style={{ fontSize: 24, color: 'var(--text3)' }} />
          <p className="text-small text-muted" style={{ marginTop: 8 }}>
            Aucun cardio configure
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.cdCard}>
      <div className={styles.cdHeader}>
        <div className={styles.cdTitle}>
          <i className="fa-solid fa-heartbeat" /> Cardio & Activite
        </div>
        <div className="flex gap-6">
          <button className={styles.cdBtn} onClick={() => {
            setTitre(cardio?.titre || '')
            setMinutes(cardio?.minutes?.toString() || '')
            setBpmMin(cardio?.bpm_min?.toString() || '')
            setBpmMax(cardio?.bpm_max?.toString() || '')
            setFrequence(cardio?.frequence || '')
            setPas(pasJournalier?.toString() || '')
            setEditing(true)
          }}>
            <i className="fa-solid fa-pen" />
          </button>
          <button className={`${styles.cdBtn} ${styles.cdBtnDel}`} onClick={handleDelete}>
            <i className="fa-solid fa-trash" />
          </button>
        </div>
      </div>
      <div className={styles.cdBody}>
        <div className={styles.cdRow}>
          {cardio && (
            <>
              <div className={styles.cdStat}>
                <span className={styles.cdStatVal}>
                  {cardio.minutes || '-'}<small>min</small>
                </span>
                <span className={styles.cdStatLbl}>{cardio.titre || 'Cardio'}</span>
              </div>
              <div className={styles.cdSep} />
              <div className={styles.cdStat}>
                <span className={styles.cdStatVal}>
                  {cardio.bpm_min || '?'}&ndash;{cardio.bpm_max || '?'}
                </span>
                <span className={styles.cdStatLbl}>BPM cible</span>
              </div>
              <div className={styles.cdSep} />
              <div className={styles.cdStat}>
                <span className={`${styles.cdStatVal} ${styles.cdStatFreq}`}>
                  {FREQ_LABELS[cardio.frequence || ''] || cardio.frequence || '-'}
                </span>
                <span className={styles.cdStatLbl}>Frequence</span>
              </div>
              <div className={styles.cdSep} />
            </>
          )}
          <div className={styles.cdStat}>
            <span className={styles.cdStatVal}>
              <i className="fa-solid fa-shoe-prints" style={{ fontSize: 12, color: 'var(--primary)', marginRight: 4 }} />
              {pasJournalier ? Number(pasJournalier).toLocaleString('fr-FR') : '\u2014'}
            </span>
            <span className={styles.cdStatLbl}>Pas/jour</span>
          </div>
        </div>
      </div>
    </div>
  )
}
