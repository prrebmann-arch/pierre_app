'use client'

import { useState, useCallback, useEffect } from 'react'
import { PROG_PHASES, type ProgPhaseKey } from '@/lib/constants'
import { toDateStr } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import styles from '@/styles/roadmap.module.css'

export interface PhaseFormData {
  id: string | null
  name: string
  phase: ProgPhaseKey
  description: string
  start_date: string
  end_date: string
  status: 'planifiee' | 'en_cours' | 'terminee'
  programme_id: string | null
  nutrition_id: string | null
}

interface ProgramRef {
  id: string
  nom: string
}

interface NutritionRef {
  id: string
  nom: string
}

interface PhaseModalProps {
  isOpen: boolean
  onClose: () => void
  data: PhaseFormData
  programs: ProgramRef[]
  nutritions: NutritionRef[]
  onSave: (data: PhaseFormData) => Promise<void>
}

function calcWeeks(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (7 * 86400000)))
}

export default function PhaseModal({
  isOpen,
  onClose,
  data,
  programs,
  nutritions,
  onSave,
}: PhaseModalProps) {
  const isEdit = !!data.id

  const [name, setName] = useState(data.name)
  const [phase, setPhase] = useState<ProgPhaseKey>(data.phase)
  const [description, setDescription] = useState(data.description)
  const [startDate, setStartDate] = useState(data.start_date)
  const [endDate, setEndDate] = useState(data.end_date)
  const [status, setStatus] = useState(data.status)
  const [programmeId, setProgrammeId] = useState(data.programme_id || '')
  const [nutritionId, setNutritionId] = useState(data.nutrition_id || '')
  const [weeks, setWeeks] = useState(() => calcWeeks(data.start_date, data.end_date))
  const [saving, setSaving] = useState(false)

  // Reset form when data changes
  useEffect(() => {
    setName(data.name)
    setPhase(data.phase)
    setDescription(data.description)
    setStartDate(data.start_date)
    setEndDate(data.end_date)
    setStatus(data.status)
    setProgrammeId(data.programme_id || '')
    setNutritionId(data.nutrition_id || '')
    setWeeks(calcWeeks(data.start_date, data.end_date))
  }, [data])

  const recalcEnd = useCallback(
    (start: string, w: number) => {
      const d = new Date(start + 'T00:00:00')
      d.setDate(d.getDate() + w * 7 - 1)
      setEndDate(toDateStr(d))
    },
    [],
  )

  const handleStartChange = (val: string) => {
    setStartDate(val)
    recalcEnd(val, weeks)
  }

  const handleEndChange = (val: string) => {
    setEndDate(val)
    if (startDate) {
      setWeeks(calcWeeks(startDate, val))
    }
  }

  const adjustWeeks = (delta: number) => {
    const next = Math.max(1, weeks + delta)
    setWeeks(next)
    recalcEnd(startDate, next)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    if (!startDate || !endDate) return
    if (endDate < startDate) return

    setSaving(true)
    await onSave({
      id: data.id,
      name: name.trim(),
      phase,
      description: description.trim(),
      start_date: startDate,
      end_date: endDate,
      status,
      programme_id: programmeId || null,
      nutrition_id: nutritionId || null,
    })
    setSaving(false)
  }

  const statusOptions: { key: 'planifiee' | 'en_cours' | 'terminee'; label: string; color: string; bg: string }[] = [
    { key: 'planifiee', label: 'Planifiee', color: 'var(--text3)', bg: 'var(--bg3)' },
    { key: 'en_cours', label: 'En cours', color: 'var(--success)', bg: 'rgba(34,197,94,0.15)' },
    { key: 'terminee', label: 'Terminee', color: 'var(--text3)', bg: 'var(--bg3)' },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className={styles.rmMHead}>
        <span className={styles.rmMTitle}>{isEdit ? 'Modifier la phase' : 'Nouvelle phase'}</span>
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
      </div>

      <div className={styles.rmMBody}>
        <div className={styles.rmModalPhases}>
          {(Object.entries(PROG_PHASES) as [ProgPhaseKey, (typeof PROG_PHASES)[ProgPhaseKey]][]).map(
            ([k, v]) => (
              <button
                key={k}
                type="button"
                className={phase === k ? styles.rmModalPhaseBtnActive : styles.rmModalPhaseBtn}
                style={{ '--phase-color': v.color } as React.CSSProperties}
                onClick={() => setPhase(k)}
              >
                {v.label}
              </button>
            ),
          )}
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Titre de la phase *"
          className={`${styles.rmMInput} ${styles.rmMTitleInput}`}
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={1}
          placeholder="Description (optionnel)"
          className={`${styles.rmMInput} ${styles.rmMDesc}`}
        />

        <div className={styles.rmMDates}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleStartChange(e.target.value)}
            className={`${styles.rmMInput} ${styles.rmMDate}`}
          />
          <div className={styles.rmMWeeks}>
            <button type="button" className={styles.rmMWeeksBtn} onClick={() => adjustWeeks(-1)}>
              &minus;
            </button>
            <span>{weeks}</span>
            <small>sem</small>
            <button type="button" className={styles.rmMWeeksBtn} onClick={() => adjustWeeks(1)}>
              +
            </button>
          </div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleEndChange(e.target.value)}
            className={`${styles.rmMInput} ${styles.rmMDate}`}
          />
        </div>

        <div className={styles.rmMRow}>
          <div className={styles.rmModalStatuses}>
            {statusOptions.map((s) => (
              <button
                key={s.key}
                type="button"
                className={status === s.key ? styles.rmModalStatusBtnActive : styles.rmModalStatusBtn}
                style={{ '--st-color': s.color, '--st-bg': s.bg } as React.CSSProperties}
                onClick={() => setStatus(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`${styles.rmMRow} ${styles.rmMSelects}`}>
          <select
            value={programmeId}
            onChange={(e) => setProgrammeId(e.target.value)}
            className={styles.rmMInput}
          >
            <option value="">— Aucun programme —</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
          <select
            value={nutritionId}
            onChange={(e) => setNutritionId(e.target.value)}
            className={styles.rmMInput}
          >
            <option value="">— Aucune nutrition —</option>
            {nutritions.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nom}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.rmMFoot}>
        <button className="btn btn-outline" onClick={onClose}>
          Annuler
        </button>
        <button className="btn btn-red" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Creer'}
        </button>
      </div>
    </Modal>
  )
}
