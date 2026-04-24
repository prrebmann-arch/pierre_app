'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_PRIORITIES = 3

type RoutineItem = {
  id: string
  athlete_id: string
  coach_id: string | null
  title: string
  emoji: string | null
  is_priority: boolean
  priority_order: number | null
  display_order: number
  active: boolean
  created_by: 'coach' | 'athlete'
  created_at: string
}

type RoutineLog = {
  id: string
  routine_item_id: string
  athlete_id: string
  date: string
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoStr(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function RoutinePage() {
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<RoutineItem[]>([])
  const [logs, setLogs] = useState<RoutineLog[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RoutineItem | null>(null)
  const [saving, setSaving] = useState(false)

  const [formTitle, setFormTitle] = useState('')
  const [formEmoji, setFormEmoji] = useState('')
  const [formIsPriority, setFormIsPriority] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [{ data: itemsData, error: itemsErr }, { data: logsData, error: logsErr }] = await Promise.all([
        supabase
          .from('routine_items')
          .select('id, athlete_id, coach_id, title, emoji, is_priority, priority_order, display_order, active, created_by, created_at')
          .eq('athlete_id', params.id)
          .eq('active', true),
        supabase
          .from('routine_logs')
          .select('id, routine_item_id, athlete_id, date')
          .eq('athlete_id', params.id)
          .gte('date', daysAgoStr(6))
          .lte('date', todayStr()),
      ])
      if (itemsErr) {
        console.error('[routine] items error:', itemsErr)
        toast(`Erreur: ${itemsErr.message}`, 'error')
      }
      if (logsErr) console.error('[routine] logs error:', logsErr)
      setItems((itemsData || []) as RoutineItem[])
      setLogs((logsData || []) as RoutineLog[])
    } finally {
      setLoading(false)
    }
  }, [params.id, supabase, toast])

  useEffect(() => { loadData() }, [loadData])

  const priorities = useMemo(
    () =>
      items
        .filter((i) => i.is_priority)
        .sort((a, b) => (a.priority_order ?? 99) - (b.priority_order ?? 99)),
    [items]
  )
  const routine = useMemo(
    () =>
      items
        .filter((i) => !i.is_priority)
        .sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at)),
    [items]
  )

  // 7-day engagement % (non-priority and priority combined)
  const engagement = useMemo(() => {
    if (items.length === 0) return null
    const totalCells = items.length * 7
    const pct = Math.round((logs.length / totalCells) * 100)
    return Math.min(100, Math.max(0, pct))
  }, [items, logs])

  const openAdd = () => {
    setEditing(null)
    setFormTitle('')
    setFormEmoji('')
    setFormIsPriority(false)
    setModalOpen(true)
  }

  const openEdit = (item: RoutineItem) => {
    setEditing(item)
    setFormTitle(item.title)
    setFormEmoji(item.emoji || '')
    setFormIsPriority(item.is_priority)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formTitle.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const patch: Partial<RoutineItem> = {
          title: formTitle.trim(),
          emoji: formEmoji.trim() || null,
          is_priority: formIsPriority,
        }
        // Reassign priority_order if changing priority state
        if (formIsPriority && !editing.is_priority) {
          if (priorities.length >= MAX_PRIORITIES) {
            toast(`Limite: ${MAX_PRIORITIES} prioritaires max`, 'error')
            setSaving(false)
            return
          }
          patch.priority_order = priorities.length
        } else if (!formIsPriority && editing.is_priority) {
          patch.priority_order = null
        }
        const { error } = await supabase.from('routine_items').update(patch).eq('id', editing.id)
        if (error) throw error
      } else {
        if (formIsPriority && priorities.length >= MAX_PRIORITIES) {
          toast(`Limite: ${MAX_PRIORITIES} prioritaires max`, 'error')
          setSaving(false)
          return
        }
        const payload = {
          athlete_id: params.id,
          coach_id: user?.id,
          title: formTitle.trim(),
          emoji: formEmoji.trim() || null,
          is_priority: formIsPriority,
          priority_order: formIsPriority ? priorities.length : null,
          display_order: routine.length,
          created_by: 'coach' as const,
        }
        const { error } = await supabase.from('routine_items').insert(payload)
        if (error) throw error
      }
      setModalOpen(false)
      await loadData()
      toast('Routine enregistrée', 'success')
    } catch (e: any) {
      console.error('[routine] save error:', e)
      toast(`Erreur: ${e.message || e}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: RoutineItem) => {
    if (!confirm(`Supprimer « ${item.title} » ?`)) return
    try {
      const { error } = await supabase.from('routine_items').update({ active: false }).eq('id', item.id)
      if (error) throw error
      await loadData()
    } catch (e: any) {
      toast(`Erreur: ${e.message || e}`, 'error')
    }
  }

  const moveItem = async (item: RoutineItem, dir: 'up' | 'down') => {
    const list = item.is_priority ? priorities : routine
    const idx = list.findIndex((i) => i.id === item.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= list.length) return
    const other = list[swapIdx]

    const field = item.is_priority ? 'priority_order' : 'display_order'
    const aVal = (item as any)[field] ?? idx
    const bVal = (other as any)[field] ?? swapIdx
    try {
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('routine_items').update({ [field]: bVal }).eq('id', item.id),
        supabase.from('routine_items').update({ [field]: aVal }).eq('id', other.id),
      ])
      if (e1 || e2) throw e1 || e2
      await loadData()
    } catch (e: any) {
      toast(`Erreur: ${e.message || e}`, 'error')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton width="100%" height={120} />
      </div>
    )
  }

  return (
    <div className={styles.tabContent} style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            ☀️ Routine matinale + Top 3 du jour
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>
            Tâches que l'athlète coche chaque matin. Les 3 prioritaires sont épinglées en haut.
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            background: 'var(--primary)', color: '#fff', border: 'none',
            padding: '10px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <i className="fas fa-plus" style={{ marginRight: 6 }} />
          Nouvel item
        </button>
      </div>

      {engagement !== null && (
        <div style={{
          padding: 14, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)',
          marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 22 }}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, letterSpacing: 0.5 }}>
              ENGAGEMENT 7 DERNIERS JOURS
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
              {engagement}% complété
            </div>
          </div>
          <div style={{
            flex: 2, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              width: `${engagement}%`, height: '100%',
              background: engagement > 70 ? '#22c55e' : engagement > 40 ? '#f59e0b' : '#ef4444',
            }} />
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon="fas fa-sun"
          message="Aucune routine définie. Crée la routine matinale de ton athlète — il verra les tâches dans son app dès demain matin."
        />
      ) : (
        <>
          {priorities.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: 'var(--text3)',
                letterSpacing: 0.8, marginBottom: 10,
              }}>
                ⭐ TOP 3 DU JOUR
              </div>
              {priorities.map((item, i) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={i}
                  total={priorities.length}
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(item)}
                  onMove={moveItem}
                />
              ))}
            </div>
          )}
          <div>
            <div style={{
              fontSize: 12, fontWeight: 700, color: 'var(--text3)',
              letterSpacing: 0.8, marginBottom: 10,
            }}>
              ROUTINE
            </div>
            {routine.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
                Aucun item hors du top 3.
              </div>
            ) : (
              routine.map((item, i) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={i}
                  total={routine.length}
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(item)}
                  onMove={moveItem}
                />
              ))
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier l\u2019item' : 'Nouvel item de routine'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--text2)' }}>
            Titre
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Ex: Boire 500ml d'eau"
              style={{
                marginTop: 6, width: '100%', padding: 10, background: 'var(--bg3)',
                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14,
              }}
              autoFocus
            />
          </label>
          <label style={{ fontSize: 13, color: 'var(--text2)' }}>
            Emoji (optionnel)
            <input
              type="text"
              value={formEmoji}
              onChange={(e) => setFormEmoji(e.target.value)}
              placeholder="💧"
              maxLength={4}
              style={{
                marginTop: 6, width: 80, padding: 10, background: 'var(--bg3)',
                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 20, textAlign: 'center',
              }}
            />
          </label>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, marginTop: 4,
          }}>
            <input
              type="checkbox"
              checked={formIsPriority}
              onChange={(e) => setFormIsPriority(e.target.checked)}
            />
            ⭐ Épingler dans le Top 3 du jour
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => setModalOpen(false)}
              style={{
                flex: 1, padding: 10, background: 'var(--bg3)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formTitle.trim()}
              style={{
                flex: 1, padding: 10, background: 'var(--primary)', color: '#fff',
                border: 'none', borderRadius: 8, fontWeight: 600,
                cursor: saving || !formTitle.trim() ? 'not-allowed' : 'pointer',
                opacity: saving || !formTitle.trim() ? 0.5 : 1,
              }}
            >
              {saving ? '...' : editing ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ItemRow({
  item, index, total, onEdit, onDelete, onMove,
}: {
  item: RoutineItem
  index: number
  total: number
  onEdit: () => void
  onDelete: () => void
  onMove: (item: RoutineItem, dir: 'up' | 'down') => void
}) {
  const isAthlete = item.created_by === 'athlete'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 10, marginBottom: 6,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          onClick={() => onMove(item, 'up')}
          disabled={index === 0}
          style={{ background: 'none', border: 'none', color: index === 0 ? 'var(--bg3)' : 'var(--text2)', cursor: index === 0 ? 'default' : 'pointer', padding: 2 }}
          title="Monter"
        >
          <i className="fas fa-chevron-up" style={{ fontSize: 10 }} />
        </button>
        <button
          onClick={() => onMove(item, 'down')}
          disabled={index === total - 1}
          style={{ background: 'none', border: 'none', color: index === total - 1 ? 'var(--bg3)' : 'var(--text2)', cursor: index === total - 1 ? 'default' : 'pointer', padding: 2 }}
          title="Descendre"
        >
          <i className="fas fa-chevron-down" style={{ fontSize: 10 }} />
        </button>
      </div>
      {item.emoji && <span style={{ fontSize: 18 }}>{item.emoji}</span>}
      <span style={{ flex: 1, fontSize: 14 }}>{item.title}</span>
      {isAthlete && (
        <span style={{
          fontSize: 10, padding: '2px 6px', borderRadius: 4,
          background: 'rgba(155, 89, 182, 0.15)', color: '#9b59b6', fontWeight: 600,
        }}>
          ajouté par l'athlète
        </span>
      )}
      <button
        onClick={onEdit}
        style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 6 }}
        title="Modifier"
      >
        <i className="fas fa-pen" style={{ fontSize: 12 }} />
      </button>
      <button
        onClick={onDelete}
        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6 }}
        title="Supprimer"
      >
        <i className="fas fa-trash" style={{ fontSize: 12 }} />
      </button>
    </div>
  )
}
