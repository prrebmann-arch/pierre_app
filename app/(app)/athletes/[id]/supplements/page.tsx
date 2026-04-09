'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { getPageCache, setPageCache } from '@/lib/utils'
import Toggle from '@/components/ui/Toggle'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

type SuppType = 'complement' | 'supplementation'

const FREQ_OPTIONS = [
  { value: '1x/jour', label: '1x/jour' },
  { value: '2x/jour', label: '2x/jour' },
  { value: '3x/jour', label: '3x/jour' },
  { value: 'tous les 2 jours', label: 'Tous les 2 jours (EOD)' },
  { value: 'tous les 3 jours', label: 'Tous les 3 jours' },
  { value: '2x/semaine', label: '2x/semaine' },
  { value: '3x/semaine', label: '3x/semaine' },
  { value: '1x/semaine', label: '1x/semaine' },
  { value: 'au besoin', label: 'Au besoin' },
]

const UNITE_OPTIONS = ['mg', 'g', 'ml', 'caps', 'gelules', 'cuillere', 'UI']

function getIntervalDays(freq: string): number {
  const map: Record<string, number> = {
    '1x/jour': 1, '2x/jour': 0.5, '3x/jour': 0.333,
    'tous les 2 jours': 2, 'tous les 3 jours': 3,
    '2x/semaine': 3.5, '3x/semaine': 2.333, '1x/semaine': 7,
  }
  return map[freq] || 0
}

function isDueDate(startDate: string | null, intervalDays: number, checkDate: string): boolean {
  if (!startDate || intervalDays <= 0) return true
  if (intervalDays <= 1) return true
  const start = new Date(startDate + 'T00:00:00')
  const check = new Date(checkDate + 'T00:00:00')
  const diffDays = Math.round((check.getTime() - start.getTime()) / 86400000)
  if (diffDays < 0) return false
  return diffDays % Math.round(intervalDays) === 0
}

const HISTORY_DAYS = 14

export default function SupplementsPage() {
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const cacheKey = `athlete_${params.id}_supplements`
  const [cached] = useState(() => getPageCache<{ assignments: any[]; unlocked: boolean }>(cacheKey))

  const [loading, setLoading] = useState(!cached)
  const [tab, setTab] = useState<SuppType>('complement')
  const [assignments, setAssignments] = useState<any[]>(cached?.assignments ?? [])
  const [unlocked, setUnlocked] = useState(cached?.unlocked ?? false)
  const [logs, setLogs] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formNom, setFormNom] = useState('')
  const [formMarque, setFormMarque] = useState('')
  const [formDosage, setFormDosage] = useState('')
  const [formUnite, setFormUnite] = useState('mg')
  const [formFreq, setFormFreq] = useState('1x/jour')
  const [formMoment, setFormMoment] = useState('')
  const [formLien, setFormLien] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formConcentration, setFormConcentration] = useState('')

  const loadData = useCallback(async () => {
    if (!assignments.length) setLoading(true)
    try {
      const rangeStart = new Date()
      rangeStart.setDate(rangeStart.getDate() - (HISTORY_DAYS - 1))
      const startDate = rangeStart.toISOString().slice(0, 10)
      const today = new Date().toISOString().slice(0, 10)

      const [{ data: assigns }, { data: ath }, { data: logData }] = await Promise.all([
        supabase.from('athlete_supplements').select('*, supplements(*)').eq('athlete_id', params.id),
        supabase.from('athletes').select('supplementation_unlocked').eq('id', params.id).single(),
        supabase.from('supplement_logs').select('id, athlete_id, athlete_supplement_id, taken_date, taken').eq('athlete_id', params.id).gte('taken_date', startDate).lte('taken_date', today).order('taken_date', { ascending: false }),
      ])
      const filteredAssigns = (assigns || []).filter((a: any) => a.actif !== false)
      const unlockedVal = ath?.supplementation_unlocked || false
      setAssignments(filteredAssigns)
      setUnlocked(unlockedVal)
      setLogs(logData || [])

      setPageCache(cacheKey, { assignments: filteredAssigns, unlocked: unlockedVal })
    } finally {
      setLoading(false)
    }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.id) loadData()
  }, [params.id, loadData])

  async function toggleUnlock(on: boolean) {
    const { error } = await supabase.from('athletes').update({ supplementation_unlocked: on }).eq('id', params.id)
    if (error) { toast('Erreur', 'error'); return }
    setUnlocked(on)
    toast(on ? 'Supplementation visible par l\'athlete' : 'Supplementation masquee', 'success')
  }

  async function saveNewSupplement() {
    if (!formNom.trim()) { toast('Nom obligatoire', 'error'); return }
    if (!formDosage.trim()) { toast('Dosage obligatoire', 'error'); return }
    setSaving(true)

    // Create supplement
    const { data: supp, error: e1 } = await supabase.from('supplements').insert({
      coach_id: user?.id,
      type: tab,
      nom: formNom.trim(),
      marque: formMarque.trim() || null,
      lien_achat: formLien.trim() || null,
    }).select().single()
    if (e1 || !supp) { toast('Erreur creation supplement', 'error'); setSaving(false); return }

    const intervalMap: Record<string, number> = {
      '1x/jour': 1, '2x/jour': 1, '3x/jour': 1,
      'tous les 2 jours': 2, 'tous les 3 jours': 3,
      '2x/semaine': 3.5, '3x/semaine': 2.333, '1x/semaine': 7, 'au besoin': 0,
    }

    const { error: e2 } = await supabase.from('athlete_supplements').insert({
      athlete_id: params.id,
      supplement_id: supp.id,
      dosage: formDosage.trim(),
      unite: formUnite,
      frequence: formFreq,
      intervalle_jours: intervalMap[formFreq] || 1,
      moment_prise: formMoment.trim() || null,
      concentration_mg_ml: parseFloat(formConcentration) || null,
      notes: formNotes.trim() || null,
      actif: true,
    })
    setSaving(false)
    if (e2) { toast('Erreur assignation', 'error'); return }

    toast('Supplement ajoute', 'success')
    setShowAddModal(false)
    resetForm()
    loadData()
  }

  function resetForm() {
    setFormNom(''); setFormMarque(''); setFormDosage(''); setFormUnite('mg')
    setFormFreq('1x/jour'); setFormMoment(''); setFormLien(''); setFormNotes(''); setFormConcentration('')
  }

  function openEditModal(a: any) {
    const s = a.supplements || {}
    setEditingId(a.id)
    setFormNom(s.nom || '')
    setFormMarque(s.marque || '')
    setFormDosage(a.dosage || '')
    setFormUnite(a.unite || 'mg')
    setFormFreq(a.frequence || '1x/jour')
    setFormMoment(a.moment_prise || '')
    setFormLien(s.lien_achat || '')
    setFormNotes(a.notes || '')
    setFormConcentration(a.concentration_mg_ml ? String(a.concentration_mg_ml) : '')
    setShowAddModal(true)
  }

  async function saveEditSupplement() {
    if (!editingId) return
    if (!formDosage.trim()) { toast('Dosage obligatoire', 'error'); return }
    setSaving(true)

    const intervalMap: Record<string, number> = {
      '1x/jour': 1, '2x/jour': 1, '3x/jour': 1,
      'tous les 2 jours': 2, 'tous les 3 jours': 3,
      '2x/semaine': 3.5, '3x/semaine': 2.333, '1x/semaine': 7, 'au besoin': 0,
    }

    // Get old values for history
    const oldAssignment = assignments.find((a: any) => a.id === editingId)

    // Update assignment
    const { error } = await supabase.from('athlete_supplements').update({
      dosage: formDosage.trim(),
      unite: formUnite,
      frequence: formFreq,
      intervalle_jours: intervalMap[formFreq] || 1,
      moment_prise: formMoment.trim() || null,
      concentration_mg_ml: parseFloat(formConcentration) || null,
      notes: formNotes.trim() || null,
    }).eq('id', editingId)

    if (error) { toast('Erreur modification', 'error'); setSaving(false); return }

    // Log dosage change in history
    if (oldAssignment && (oldAssignment.dosage !== formDosage.trim() || oldAssignment.unite !== formUnite || oldAssignment.frequence !== formFreq)) {
      await supabase.from('supplement_dosage_history').insert({
        athlete_supplement_id: editingId,
        ancien_dosage: oldAssignment.dosage,
        nouveau_dosage: formDosage.trim(),
        ancienne_unite: oldAssignment.unite,
        nouvelle_unite: formUnite,
        ancienne_frequence: oldAssignment.frequence,
        nouvelle_frequence: formFreq,
        changed_by: user?.id,
      }).catch(() => { /* table might not exist yet */ })
    }

    setSaving(false)
    toast('Supplement modifie', 'success')
    setShowAddModal(false)
    setEditingId(null)
    resetForm()
    loadData()
  }

  async function removeAssignment(id: string) {
    if (!confirm('Retirer ce supplement ?')) return
    const { error } = await supabase.from('athlete_supplements').update({ actif: false }).eq('id', id)
    if (error) { toast('Erreur', 'error'); return }
    toast('Supplement retire', 'success')
    loadData()
  }

  if (loading) return <Skeleton height={300} borderRadius={12} />

  const assigned = assignments.filter((a: any) => a.supplements?.type === tab)
  const today = new Date().toISOString().slice(0, 10)

  // Build per-assignment history for 14 days + delay detection
  function getAssignmentHistory(a: any) {
    const intervalDays = a.intervalle_jours || getIntervalDays(a.frequence) || 1
    const isOnDemand = a.frequence === 'au besoin'
    const days: { date: string; label: string; status: 'taken' | 'missed' | 'not_due' | 'today_pending' | 'today_taken' }[] = []
    let missedCount = 0
    let lastDueMissed: string | null = null

    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      const log = logs.find((l: any) => l.athlete_supplement_id === a.id && l.taken_date === ds)
      const due = isOnDemand ? false : isDueDate(a.start_date, intervalDays, ds)
      const isToday = ds === today

      let status: typeof days[0]['status']
      if (isToday) {
        status = log?.taken ? 'today_taken' : 'today_pending'
      } else if (!due) {
        status = 'not_due'
      } else if (log?.taken) {
        status = 'taken'
      } else {
        status = 'missed'
        missedCount++
        if (!lastDueMissed || ds > lastDueMissed) lastDueMissed = ds
      }

      days.push({
        date: ds,
        label: d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 2) + ' ' + d.getDate(),
        status,
      })
    }

    // Calculate delay in days from last missed due date
    let delayDays = 0
    if (lastDueMissed) {
      delayDays = Math.round((new Date(today + 'T00:00:00').getTime() - new Date(lastDueMissed + 'T00:00:00').getTime()) / 86400000)
    }

    return { days, missedCount, delayDays, isOnDemand }
  }

  // Compliance grid for supplementation (summary)
  let complianceHtml = null
  if (tab === 'supplementation' && assigned.length) {
    const suppIds = assigned.map((a: any) => a.id)
    const todayLogs = logs.filter((l: any) => l.taken_date === today && suppIds.includes(l.athlete_supplement_id))
    const takenTodayCount = todayLogs.filter((l: any) => l.taken).length

    const days: { label: string; taken: number; due: number; pct: number }[] = []
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      const dayLogs = logs.filter((l: any) => l.taken_date === ds && suppIds.includes(l.athlete_supplement_id))
      const taken = dayLogs.filter((l: any) => l.taken).length
      // Count how many supplements were due that day
      let dueCount = 0
      for (const a of assigned) {
        const intervalDays = a.intervalle_jours || getIntervalDays(a.frequence) || 1
        if (a.frequence !== 'au besoin' && isDueDate(a.start_date, intervalDays, ds)) dueCount++
      }
      days.push({
        label: d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 2) + '\n' + d.getDate(),
        taken, due: dueCount,
        pct: dueCount > 0 ? taken / dueCount : 0,
      })
    }

    complianceHtml = (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            <i className="fas fa-chart-bar" style={{ marginRight: 6, color: 'var(--text3)' }} />Suivi des prises (14 jours)
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: takenTodayCount === assigned.length ? 'var(--success)' : 'var(--warning)' }}>
            Aujourd&apos;hui : {takenTodayCount}/{assigned.length}
          </div>
        </div>
        <div className={styles.complianceGrid}>
          {days.map((d, i) => {
            const color = d.due === 0 ? 'var(--bg4)' : d.pct >= 1 ? 'var(--success)' : d.pct > 0 ? 'var(--warning)' : 'var(--danger)'
            return (
              <div key={i} className={styles.complianceDay}>
                <div className={styles.complianceDayLabel} style={{ whiteSpace: 'pre-line' }}>{d.label}</div>
                <div className={styles.complianceDayBar} style={{ background: color }}>
                  {d.due > 0 && <span className={styles.complianceDayCount}>{d.taken}/{d.due}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Weekly dose calculation helper
  function calcWeekly(a: any) {
    const interval = getIntervalDays(a.frequence)
    if (!interval || a.frequence === 'au besoin') return null
    const inj = 7 / interval
    const dose = parseFloat((a.dosage || '').replace(',', '.')) || 0
    if (a.concentration_mg_ml && a.unite === 'ml') {
      return `${(dose * a.concentration_mg_ml * inj).toFixed(0)} mg/semaine`
    }
    if (dose) return `${(dose * inj).toFixed(0)} ${a.unite}/semaine`
    return null
  }

  return (
    <div>
      {/* Tab buttons */}
      <div className={styles.filterBar}>
        <button className={tab === 'complement' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setTab('complement')}>
          <i className="fas fa-capsules" /> Complements
        </button>
        <button className={tab === 'supplementation' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setTab('supplementation')}>
          <i className="fas fa-pills" /> Supplementation
        </button>
      </div>

      {/* Unlock toggle for supplementation */}
      {tab === 'supplementation' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: unlocked ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          borderRadius: 8, marginBottom: 16,
          border: `1px solid ${unlocked ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {unlocked ? <><i className="fas fa-unlock" style={{ color: 'var(--success)', marginRight: 6 }} />Visible par l&apos;athlete</> : <><i className="fas fa-lock" style={{ color: 'var(--danger)', marginRight: 6 }} />Masque pour l&apos;athlete</>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              La supplementation {unlocked ? 'est accessible' : 'n\'est pas accessible'} dans l&apos;app mobile
            </div>
          </div>
          <Toggle checked={unlocked} onChange={toggleUnlock} />
        </div>
      )}

      {complianceHtml}

      {/* Actions bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-red btn-sm" onClick={() => { resetForm(); setShowAddModal(true) }}>
          <i className="fas fa-plus" /> Ajouter
        </button>
      </div>

      {/* Cards */}
      {assigned.length === 0 ? (
        <EmptyState icon="fas fa-pills" message={`Aucun ${tab === 'complement' ? 'complement' : 'supplement'} assigne`} />
      ) : (
        <div className={styles.suppGrid}>
          {assigned.map((a: any) => {
            const s = a.supplements || {}
            const weekly = calcWeekly(a)
            const history = getAssignmentHistory(a)
            const todayStatus = history.days[history.days.length - 1]?.status
            return (
              <div key={a.id} className={styles.suppCard}>
                <div className={styles.suppCardHeader}>
                  <div>
                    <div className={styles.suppCardName}>{s.nom}</div>
                    {s.marque && <div className={styles.suppCardBrand}>{s.marque}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {s.lien_achat && (
                      <a href={s.lien_achat} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ fontSize: 10 }}>
                        <i className="fas fa-shopping-cart" /> Acheter
                      </a>
                    )}
                    {/* Delay / on-track badge (supplementation only) */}
                    {tab === 'supplementation' && !history.isOnDemand && (
                      history.delayDays > 0 ? (
                        <span className={styles.suppBadgeLate}>
                          <i className="fas fa-exclamation-triangle" style={{ marginRight: 3 }} />
                          En retard de {history.delayDays}j
                        </span>
                      ) : (
                        <span className={styles.suppBadgeOk}>
                          <i className="fas fa-check" style={{ marginRight: 3 }} />A jour
                        </span>
                      )
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{a.dosage}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>{a.unite}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)' }}>
                    <span><i className="fas fa-redo" style={{ marginRight: 3 }} />{a.frequence}</span>
                    {a.moment_prise && <span><i className="fas fa-clock" style={{ marginRight: 3 }} />{a.moment_prise}</span>}
                  </div>
                  {weekly && (
                    <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginTop: 6 }}>
                      <i className="fas fa-calculator" style={{ marginRight: 4 }} />{weekly}
                    </div>
                  )}
                  {a.notes && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{a.notes}</div>}
                </div>

                {/* 14-day history grid (supplementation only) */}
                {tab === 'supplementation' && <div className={styles.suppHistorySection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)' }}>Historique 14 jours</span>
                    {!history.isOnDemand && history.missedCount > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--danger)' }}>
                        {history.missedCount} manquee{history.missedCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className={styles.suppHistoryGrid}>
                    {history.days.map((d, i) => {
                      let bg: string
                      let title: string
                      switch (d.status) {
                        case 'taken': bg = 'var(--success)'; title = 'Pris'; break
                        case 'missed': bg = 'var(--danger)'; title = 'Manque'; break
                        case 'not_due': bg = 'var(--bg4)'; title = 'Pas prevu'; break
                        case 'today_taken': bg = 'var(--success)'; title = 'Pris aujourd\'hui'; break
                        case 'today_pending': bg = 'var(--info, #3b82f6)'; title = 'En attente'; break
                      }
                      return (
                        <div key={i} className={styles.suppHistoryCell} title={`${d.date} — ${title}`} style={{ background: bg }} />
                      )
                    })}
                  </div>
                  <div className={styles.suppHistoryLegend}>
                    <span><span className={styles.suppDot} style={{ background: 'var(--success)' }} /> Pris</span>
                    <span><span className={styles.suppDot} style={{ background: 'var(--danger)' }} /> Manque</span>
                    <span><span className={styles.suppDot} style={{ background: 'var(--bg4)' }} /> Pas prevu</span>
                    <span><span className={styles.suppDot} style={{ background: 'var(--info, #3b82f6)' }} /> Aujourd&apos;hui</span>
                  </div>
                </div>}

                {/* Today status */}
                {tab === 'supplementation' && (
                  <div style={{ fontSize: 10, fontWeight: 600, color: todayStatus === 'today_taken' ? 'var(--success)' : 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                    <i className={todayStatus === 'today_taken' ? 'fas fa-check-circle' : 'far fa-circle'} />
                    {todayStatus === 'today_taken' ? 'Pris aujourd\'hui' : 'Pas encore pris'}
                  </div>
                )}

                <div className={styles.suppCardFooter}>
                  <button className="btn btn-outline btn-sm" onClick={() => openEditModal(a)}>
                    <i className="fas fa-pen" /> Modifier
                  </button>
                  <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeAssignment(a.id)}>
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add supplement modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingId(null); resetForm() }} title={editingId ? 'Modifier le supplement' : `Ajouter un ${tab === 'complement' ? 'complement' : 'supplement'}`}>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="text" className="form-control" placeholder="Nom du produit *" value={formNom} onChange={(e) => setFormNom(e.target.value)} />
          <input type="text" className="form-control" placeholder="Marque" value={formMarque} onChange={(e) => setFormMarque(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" className="form-control" placeholder="Dosage *" value={formDosage} onChange={(e) => setFormDosage(e.target.value)} style={{ flex: 1 }} />
            <select className="form-control" value={formUnite} onChange={(e) => setFormUnite(e.target.value)} style={{ width: 100 }}>
              {UNITE_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <select className="form-control" value={formFreq} onChange={(e) => setFormFreq(e.target.value)}>
            {FREQ_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          {tab === 'supplementation' && (
            <input type="number" className="form-control" placeholder="Concentration (mg/ml)" value={formConcentration} onChange={(e) => setFormConcentration(e.target.value)} step="any" />
          )}
          <input type="text" className="form-control" placeholder="Moment de prise (ex: matin)" value={formMoment} onChange={(e) => setFormMoment(e.target.value)} />
          <input type="url" className="form-control" placeholder="Lien d'achat (optionnel)" value={formLien} onChange={(e) => setFormLien(e.target.value)} />
          <textarea className="form-control" placeholder="Notes" rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-outline" onClick={() => setShowAddModal(false)}>Annuler</button>
            <button className="btn btn-red" onClick={editingId ? saveEditSupplement : saveNewSupplement} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-plus" style={{ marginRight: 4 }} />Ajouter</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
