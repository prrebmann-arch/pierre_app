'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import Toggle from '@/components/ui/Toggle'
import Skeleton from '@/components/ui/Skeleton'
import {
  GROUPS,
  getFood,
  getFoodPortions,
} from '@/lib/fodmapCatalog'
import {
  deriveActiveWeek,
  deriveGroupStatus,
  deriveProgress,
  type FodmapLog,
  type GroupStatus,
} from '@/lib/fodmap'

const RATING_COLOR: Record<'green' | 'yellow' | 'red', string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
}

const STATUS_LABEL: Record<GroupStatus, string> = {
  not_started: 'À faire',
  in_progress: 'En cours',
  done_all_green: '✓ Toléré',
  done_yellow: '✓ Modéré',
  done_red: '✗ Symptômes',
}

const STATUS_BG: Record<GroupStatus, string> = {
  not_started: 'var(--bg2)',
  in_progress: 'rgba(179,8,8,0.18)',
  done_all_green: 'rgba(34,197,94,0.18)',
  done_yellow: 'rgba(234,179,8,0.18)',
  done_red: 'rgba(239,68,68,0.18)',
}

const STATUS_BORDER: Record<GroupStatus, string> = {
  not_started: 'transparent',
  in_progress: '#b30808',
  done_all_green: '#22c55e',
  done_yellow: '#eab308',
  done_red: '#ef4444',
}

const PORTION_ORDER: Record<'S' | 'M' | 'L', number> = { S: 0, M: 1, L: 2 }

export default function FodmapPage() {
  const params = useParams<{ id: string }>()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [logs, setLogs] = useState<FodmapLog[]>([])

  const loadData = useCallback(async () => {
    try {
      const { data: ath, error: athErr } = await supabase
        .from('athletes').select('fodmap_enabled').eq('id', params.id).single()
      if (athErr) {
        console.error('[fodmap] athlete', athErr)
        toast(`Erreur: ${athErr.message}`, 'error')
        return
      }
      const on = ath?.fodmap_enabled || false
      setEnabled(on)
      if (!on) { setLogs([]); return }
      const { data, error } = await supabase
        .from('athlete_fodmap_logs')
        .select('id, athlete_id, group_key, food_key, portion_size, rating, note, logged_at, iso_week_start, archived_at')
        .eq('athlete_id', params.id)
        .is('archived_at', null)
        .order('logged_at', { ascending: false })
        .limit(500)
      if (error) {
        console.error('[fodmap] logs', error)
        toast(`Erreur: ${error.message}`, 'error')
        return
      }
      setLogs((data || []) as FodmapLog[])
    } finally {
      setLoading(false)
    }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (params.id) loadData() }, [params.id, loadData])
  useRefetchOnResume(loadData, loading)

  async function toggleFodmap(on: boolean) {
    const { error } = await supabase.from('athletes').update({ fodmap_enabled: on }).eq('id', params.id)
    if (error) {
      console.error('[fodmap] toggle', error)
      toast(`Erreur: ${error.message}`, 'error')
      return
    }
    toast(on ? 'Test FODMAP activé' : 'Test FODMAP désactivé', 'success')
    setEnabled(on)
    if (on) loadData()
  }

  async function rearmWeek(iso_week_start: string, group_key: string) {
    const groupLabel = GROUPS.find((g) => g.key === group_key)?.label || group_key
    const ok = confirm(`Ré-armer la semaine du ${iso_week_start} pour le groupe "${groupLabel}" ? L'athlète pourra refaire ce groupe lundi prochain.`)
    if (!ok) return
    const { error } = await supabase
      .from('athlete_fodmap_logs')
      .update({ archived_at: new Date().toISOString() })
      .eq('athlete_id', params.id)
      .eq('iso_week_start', iso_week_start)
      .is('archived_at', null)
    if (error) {
      console.error('[fodmap] rearm', error)
      toast(`Erreur: ${error.message}`, 'error')
      return
    }
    toast('Semaine ré-armée', 'success')
    loadData()
  }

  if (loading) return <Skeleton height={300} borderRadius={12} />

  if (!enabled) {
    return (
      <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg2)', borderRadius: 16, border: '1px solid var(--glass-border)' }}>
        <i className="fas fa-vial" style={{ fontSize: 36, color: 'var(--text3)', marginBottom: 16, display: 'block' }} />
        <p style={{ color: 'var(--text3)', marginBottom: 16 }}>Test FODMAP désactivé pour cet athlète</p>
        <Toggle checked={false} onChange={toggleFodmap} />
      </div>
    )
  }

  const today = new Date()
  const active = deriveActiveWeek(logs, today)
  const progress = deriveProgress(logs)

  const groupedByWeek = new Map<string, FodmapLog[]>()
  for (const l of logs) {
    const key = `${l.iso_week_start}__${l.group_key}`
    const arr = groupedByWeek.get(key) || []
    arr.push(l)
    groupedByWeek.set(key, arr)
  }
  const history = Array.from(groupedByWeek.entries())
    .map(([k, arr]) => {
      const [iso_week_start, group_key] = k.split('__')
      return { iso_week_start, group_key, logs: arr, status: deriveGroupStatus(arr, group_key) }
    })
    .filter((h) => h.status !== 'in_progress' && h.status !== 'not_started')
    .filter((h) => !active || h.iso_week_start !== active.iso_week_start)
    .sort((a, b) => b.iso_week_start.localeCompare(a.iso_week_start))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 8, flexWrap: 'wrap' }}>
        <Toggle checked={enabled} onChange={toggleFodmap} label="Test FODMAP actif" />
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          Progression : <strong style={{ color: 'var(--text)' }}>{progress.done} / {progress.total}</strong>
        </div>
      </div>

      {active && (() => {
        const food = getFood(active.food_key)
        const group = GROUPS.find((g) => g.key === active.group_key)
        const portions = getFoodPortions(active.food_key)
        return (
          <div style={{ padding: 16, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Semaine en cours</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{group?.label} · {food?.emoji} {food?.label}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => rearmWeek(active.iso_week_start, active.group_key)}>
                <i className="fas fa-rotate-left" /> Ré-armer
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {(['S', 'M', 'L'] as const).map((size, i) => {
                const dayLabel = ['Lundi', 'Mercredi', 'Vendredi'][i]
                const log = active.logs.find((l) => l.portion_size === size)
                const portion = portions.find((p) => p.size === size)
                return (
                  <div key={size} style={{ padding: 10, background: 'var(--bg3)', borderRadius: 8, borderLeft: log ? `3px solid ${RATING_COLOR[log.rating]}` : '3px solid transparent' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{dayLabel}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{portion?.label}</div>
                    {log ? (
                      <>
                        <div style={{ fontSize: 12, color: RATING_COLOR[log.rating], marginTop: 4 }}>
                          {log.rating === 'green' ? '🟢 Toléré' : log.rating === 'yellow' ? '🟡 Modéré' : '🔴 Symptômes'}
                        </div>
                        {log.note && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, fontStyle: 'italic' }}>{log.note}</div>}
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>En attente</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {history.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
            <i className="fas fa-clock-rotate-left" style={{ color: 'var(--primary)', marginRight: 6 }} />Historique
          </h3>
          {history.map((h) => {
            const food = getFood(h.logs[0].food_key)
            const group = GROUPS.find((g) => g.key === h.group_key)
            const sortedLogs = [...h.logs].sort((a, b) => PORTION_ORDER[a.portion_size] - PORTION_ORDER[b.portion_size])
            return (
              <div key={`${h.iso_week_start}-${h.group_key}`} style={{ padding: 12, background: 'var(--bg2)', borderRadius: 10, borderLeft: `3px solid ${STATUS_BORDER[h.status]}`, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{group?.label} · {food?.emoji} {food?.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Semaine du {h.iso_week_start} · {STATUS_LABEL[h.status]}</div>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => rearmWeek(h.iso_week_start, h.group_key)}>
                    <i className="fas fa-rotate-left" /> Ré-armer
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text2)', flexWrap: 'wrap' }}>
                  {sortedLogs.map((l) => (
                    <span key={l.id}>
                      <span style={{ color: RATING_COLOR[l.rating] }}>●</span> {l.portion_size}{l.note ? ` — ${l.note}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '24px 0 10px' }}>
        <i className="fas fa-list" style={{ color: 'var(--primary)', marginRight: 6 }} />Tous les groupes
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {GROUPS.map((g) => {
          const status = deriveGroupStatus(logs, g.key)
          return (
            <div key={g.key} style={{ padding: 10, background: STATUS_BG[status], borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{g.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{STATUS_LABEL[status]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
