'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { getPageCache, setPageCache } from '@/lib/utils'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import Toggle from '@/components/ui/Toggle'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function MenstrualPage() {
  const params = useParams<{ id: string }>()
  const { toast } = useToast()
  const supabase = createClient()

  const cacheKey = `athlete_${params.id}_menstrual`
  const [cached] = useState(() => getPageCache<{ enabled: boolean; entries: any[] }>(cacheKey))

  const [loading, setLoading] = useState(!cached)
  const [enabled, setEnabled] = useState(cached?.enabled ?? false)
  const [entries, setEntries] = useState<any[]>(cached?.entries ?? [])

  const loadData = useCallback(async () => {
    if (!entries.length && !cached) setLoading(true)
    try {
      const [{ data: logs, error: logsErr }, { data: ath }] = await Promise.all([
        supabase.from('menstrual_logs').select('id, athlete_id, start_date, end_date, flow, created_at').eq('athlete_id', params.id).order('start_date', { ascending: false }).limit(24),
        supabase.from('athletes').select('menstrual_tracking_enabled').eq('id', params.id).single(),
      ])
      if (logsErr) { console.error('[menstrual] logs', logsErr); toast(`Erreur: ${logsErr.message}`, 'error') }
      const enabledVal = ath?.menstrual_tracking_enabled || false
      const entriesData = logs || []
      setEnabled(enabledVal)
      setEntries(entriesData)
      setPageCache(cacheKey, { enabled: enabledVal, entries: entriesData })
    } finally {
      setLoading(false)
    }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function updateLog(logId: string, patch: { start_date?: string; end_date?: string | null; flow?: string }) {
    const { error } = await supabase.from('menstrual_logs').update(patch).eq('id', logId)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    toast('Mis à jour', 'success')
    loadData()
  }

  async function deleteLog(logId: string) {
    if (!confirm('Supprimer cet enregistrement ?')) return
    const { error } = await supabase.from('menstrual_logs').delete().eq('id', logId)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    toast('Supprimé', 'success')
    loadData()
  }

  useEffect(() => {
    if (params.id) loadData()
  }, [params.id, loadData])

  useRefetchOnResume(loadData, loading)

  async function toggleTracking(on: boolean) {
    const { error } = await supabase.from('athletes').update({ menstrual_tracking_enabled: on }).eq('id', params.id)
    if (error) { toast('Erreur', 'error'); return }
    toast(on ? 'Suivi menstruel active' : 'Suivi menstruel desactive', 'success')
    setEnabled(on)
  }

  if (loading) return <Skeleton height={300} borderRadius={12} />

  // Toggle banner
  const toggleBanner = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px',
      background: enabled ? 'rgba(236,72,153,0.08)' : 'rgba(239,68,68,0.08)',
      borderRadius: 8, marginBottom: 16,
      border: `1px solid ${enabled ? 'rgba(236,72,153,0.2)' : 'rgba(239,68,68,0.2)'}`,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {enabled ? (
            <><i className="fas fa-unlock" style={{ color: '#ec4899', marginRight: 6 }} />Suivi active pour l&apos;athlete</>
          ) : (
            <><i className="fas fa-lock" style={{ color: 'var(--danger)', marginRight: 6 }} />Suivi desactive</>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
          L&apos;athlete {enabled ? 'peut enregistrer' : 'ne voit pas'} le suivi menstruel dans l&apos;app
        </div>
      </div>
      <Toggle checked={enabled} onChange={toggleTracking} />
    </div>
  )

  if (!entries.length) {
    return (
      <div>
        {toggleBanner}
        <EmptyState
          icon="fas fa-venus"
          message="Aucun cycle enregistre"
          action={<span style={{ fontSize: 11, color: 'var(--text3)' }}>L&apos;athlete doit activer le suivi dans son app</span>}
        />
      </div>
    )
  }

  // Stats calculation
  const completed = entries.filter((e: any) => e.end_date).sort((a: any, b: any) => a.start_date.localeCompare(b.start_date))
  let avgCycle = 28, avgDuration = 5
  if (completed.length >= 2) {
    const cycleLengths: number[] = []
    const durations: number[] = []
    for (let i = 1; i < completed.length; i++) {
      cycleLengths.push(daysBetween(completed[i - 1].start_date, completed[i].start_date))
    }
    completed.forEach((l: any) => durations.push(daysBetween(l.start_date, l.end_date)))
    avgCycle = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length) || 28
    avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) || 5
  }

  // Predictions
  const lastEntry = entries[0]
  const lastStart = new Date(lastEntry.start_date + 'T12:00:00')
  const nextStart = new Date(lastStart)
  nextStart.setDate(nextStart.getDate() + avgCycle)
  const ovulation = new Date(nextStart)
  ovulation.setDate(ovulation.getDate() - 14)

  // Phase timeline
  const menPct = Math.round((avgDuration / avgCycle) * 100)
  const ovDay = avgCycle - 14
  const follPct = Math.round(((ovDay - avgDuration) / avgCycle) * 100)
  const ovPct = Math.round((2 / avgCycle) * 100)
  const lutPct = 100 - menPct - follPct - ovPct

  return (
    <div>
      {toggleBanner}

      {/* Stats */}
      <div className={styles.menstrualStats}>
        <div className={styles.menstrualStatCard}>
          <div className={styles.menstrualStatVal}>{avgCycle}</div>
          <div className={styles.menstrualStatLabel}>jours / cycle</div>
        </div>
        <div className={styles.menstrualStatCard}>
          <div className={styles.menstrualStatVal}>{avgDuration}</div>
          <div className={styles.menstrualStatLabel}>jours de regles</div>
        </div>
        <div className={styles.menstrualStatCard}>
          <div className={styles.menstrualStatVal}>{completed.length}</div>
          <div className={styles.menstrualStatLabel}>cycles</div>
        </div>
      </div>

      {/* Predictions */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          <i className="fas fa-wand-magic-sparkles" style={{ marginRight: 6, color: '#ec4899' }} />Predictions
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600 }}>Prochaines regles</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{formatDateShort(nextStart)}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600 }}>Ovulation estimee</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{formatDateShort(ovulation)}</div>
          </div>
        </div>
      </div>

      {/* Phase timeline */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          <i className="fas fa-chart-bar" style={{ marginRight: 6, color: 'var(--text3)' }} />Phases du cycle
        </div>
        <div className={styles.phaseBar}>
          <div className={styles.phaseBarSegment} style={{ width: `${menPct}%`, background: '#ef4444' }}>
            <span className={styles.phaseBarLabel}>Regles</span>
          </div>
          <div className={styles.phaseBarSegment} style={{ width: `${follPct}%`, background: '#3b82f6' }}>
            <span className={styles.phaseBarLabel}>Folliculaire</span>
          </div>
          <div className={styles.phaseBarSegment} style={{ width: `${ovPct}%`, background: '#f59e0b' }}>
            <span className={styles.phaseBarLabel}>Ov.</span>
          </div>
          <div className={styles.phaseBarSegment} style={{ width: `${lutPct}%`, background: '#9b59b6' }}>
            <span className={styles.phaseBarLabel}>Luteale</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)' }}>
          <span>J1</span>
          <span>J{avgDuration}</span>
          <span>J{ovDay} (ovulation)</span>
          <span>J{avgCycle}</span>
        </div>
      </div>

      {/* History */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          <i className="fas fa-history" style={{ marginRight: 6, color: 'var(--text3)' }} />Historique des cycles
        </div>
        {entries.map((e: any) => (
          <CycleRow
            key={e.id}
            entry={e}
            onUpdate={(patch) => updateLog(e.id, patch)}
            onDelete={() => deleteLog(e.id)}
          />
        ))}
      </div>
    </div>
  )
}

function CycleRow({
  entry, onUpdate, onDelete,
}: {
  entry: any
  onUpdate: (patch: { start_date?: string; end_date?: string | null; flow?: string }) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [start, setStart] = useState(entry.start_date)
  const [end, setEnd] = useState(entry.end_date || '')
  const [flow, setFlow] = useState(entry.flow || 'medium')

  const dur = entry.end_date ? daysBetween(entry.start_date, entry.end_date) : null
  const flowLabel = entry.flow === 'light' ? 'Leger' : entry.flow === 'heavy' ? 'Abondant' : 'Moyen'
  const flowColor = entry.flow === 'light' ? '#f9a8d4' : entry.flow === 'heavy' ? '#be185d' : '#ec4899'

  function save() {
    const patch: any = {}
    if (start !== entry.start_date) patch.start_date = start
    if ((end || null) !== (entry.end_date || null)) patch.end_date = end || null
    if (flow !== entry.flow) patch.flow = flow
    if (Object.keys(patch).length > 0) onUpdate(patch)
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{
        padding: 12, marginBottom: 8,
        background: 'var(--bg)', border: '1px solid var(--primary)', borderRadius: 8,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 130px' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, marginBottom: 3 }}>Début</div>
            <input type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} style={{ fontSize: 13 }} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, marginBottom: 3 }}>Fin (optionnel)</div>
            <input type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} style={{ fontSize: 13 }} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, marginBottom: 3 }}>Flux</div>
            <select className="form-control" value={flow} onChange={(e) => setFlow(e.target.value)} style={{ fontSize: 13 }}>
              <option value="light">Léger</option>
              <option value="medium">Moyen</option>
              <option value="heavy">Abondant</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          <button onClick={onDelete} style={{ background: 'transparent', border: '1px solid var(--border)', color: '#ef4444', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
            <i className="fas fa-trash-can" /> Supprimer
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setStart(entry.start_date); setEnd(entry.end_date || ''); setFlow(entry.flow || 'medium'); setEditing(false) }} className="btn btn-outline btn-sm">Annuler</button>
            <button onClick={save} className="btn btn-red btn-sm">Enregistrer</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ width: 8, height: 8, borderRadius: 4, background: flowColor }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {formatDateShort(new Date(entry.start_date + 'T12:00:00'))}
          {entry.end_date ? ` \u2192 ${formatDateShort(new Date(entry.end_date + 'T12:00:00'))}` : ' '}
          {!entry.end_date && <span style={{ color: '#ec4899', fontSize: 11 }}>(en cours)</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
          {flowLabel} &middot; {dur != null ? `${dur} jours` : 'En cours'}
        </div>
      </div>
      <button
        onClick={() => setEditing(true)}
        title="Modifier"
        style={{
          background: 'transparent', border: '1px solid var(--border)',
          padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
          color: 'var(--text2)', fontSize: 11, fontWeight: 600,
        }}
      >
        <i className="fas fa-pen" /> Modifier
      </button>
    </div>
  )
}
