'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/business.module.css'

// ── Types ──
interface Lead {
  id: string
  name: string
  instagram_handle?: string
  email?: string
  phone?: string
  source?: string
  status: string
  notes?: string
  tags?: string[]
  message_count?: number
  created_at: string
}

const LEAD_STATUSES: Record<string, { label: string; color: string; icon: string }> = {
  new_lead:     { label: 'New lead',    color: '#ef4444', icon: 'fa-circle' },
  in_contact:   { label: 'In contact',  color: '#3b82f6', icon: 'fa-comment' },
  qualified:    { label: 'Qualified',    color: '#f59e0b', icon: 'fa-star' },
  unqualified:  { label: 'Unqualified', color: '#6b7280', icon: 'fa-times' },
  call_booked:  { label: 'Call booked', color: '#8b5cf6', icon: 'fa-calendar' },
  deposit:      { label: 'Deposit',     color: '#10b981', icon: 'fa-money-bill' },
  won:          { label: 'Won',         color: '#22c55e', icon: 'fa-check' },
  lost:         { label: 'Lost',        color: '#ef4444', icon: 'fa-ban' },
  no_show:      { label: 'No show',     color: '#f97316', icon: 'fa-user-slash' },
}

const SOURCES = [
  { value: 'dm', label: 'DM' },
  { value: 'comment', label: 'Commentaire' },
  { value: 'story_reply', label: 'Story' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'manual', label: 'Manuel' },
]

export default function LeadsPipeline() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<Lead[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [search, setSearch] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [formName, setFormName] = useState('')
  const [formIg, setFormIg] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formSource, setFormSource] = useState('dm')
  const [formStatus, setFormStatus] = useState('new_lead')
  const [formNotes, setFormNotes] = useState('')

  const loadLeads = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('leads').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200)
    setLeads((data || []) as Lead[])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => { loadLeads() }, [loadLeads])

  // Filtered leads
  let filtered = leads
  if (filterStatus) filtered = filtered.filter(l => l.status === filterStatus)
  if (filterSource) filtered = filtered.filter(l => l.source === filterSource)
  if (search) {
    const s = search.toLowerCase()
    filtered = filtered.filter(l => (l.name || '').toLowerCase().includes(s) || (l.instagram_handle || '').toLowerCase().includes(s))
  }

  // Status counts
  const counts: Record<string, number> = {}
  leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1 })

  function openAdd() {
    setEditingLead(null)
    setFormName(''); setFormIg(''); setFormEmail(''); setFormPhone('')
    setFormSource('dm'); setFormStatus('new_lead'); setFormNotes('')
    setShowModal(true)
  }

  function openEdit(lead: Lead) {
    setEditingLead(lead)
    setFormName(lead.name)
    setFormIg(lead.instagram_handle || '')
    setFormEmail(lead.email || '')
    setFormPhone(lead.phone || '')
    setFormSource(lead.source || 'manual')
    setFormStatus(lead.status)
    setFormNotes(lead.notes || '')
    setShowModal(true)
  }

  async function saveLead() {
    if (!user) return
    const name = formName.trim()
    if (!name) { toast('Nom obligatoire', 'error'); return }

    if (editingLead) {
      const { error } = await supabase.from('leads').update({
        name: formName.trim(),
        status: formStatus,
        instagram_handle: formIg.trim() || null,
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        source: formSource,
        notes: formNotes.trim() || null,
      }).eq('id', editingLead.id)
      if (error) { toast('Erreur: ' + error.message, 'error'); return }
      toast('Lead mis a jour !', 'success')
    } else {
      const { error } = await supabase.from('leads').insert({
        user_id: user.id, name,
        instagram_handle: formIg.trim() || null,
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        source: formSource,
        notes: formNotes.trim() || null,
        status: 'new_lead',
      })
      if (error) { toast('Erreur: ' + error.message, 'error'); return }
      toast('Lead ajoute !', 'success')
    }
    setShowModal(false)
    loadLeads()
  }

  async function deleteLead() {
    if (!editingLead) return
    if (!confirm('Supprimer ce lead ?')) return
    await supabase.from('leads').delete().eq('id', editingLead.id)
    setShowModal(false)
    toast('Lead supprime', 'success')
    loadLeads()
  }

  if (loading) return <Skeleton />

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="Rechercher..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, width: 200 }}
        />
        <select
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12 }}
        >
          <option value="">Tous les statuts ({leads.length})</option>
          {Object.entries(LEAD_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>{v.label} ({counts[k] || 0})</option>
          ))}
        </select>
        <select
          value={filterSource} onChange={e => setFilterSource(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12 }}
        >
          <option value="">Toutes sources</option>
          {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <Button variant="red" size="sm" onClick={openAdd}><i className="fas fa-plus" /> Nouveau lead</Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon="fas fa-user-plus" message="Aucun lead" action={<Button variant="red" onClick={openAdd}><i className="fas fa-plus" /> Nouveau lead</Button>} />
      ) : (
        <div className="nd-table-wrap">
          <table className="nd-table">
            <thead>
              <tr><th>Lead</th><th>Statut</th><th>Tags</th><th>Source</th><th>Date</th></tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const st = LEAD_STATUSES[l.status] || LEAD_STATUSES.new_lead
                const date = new Date(l.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                return (
                  <tr key={l.id} className="nd-tr" onClick={() => openEdit(l)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>
                          {(l.name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{l.name}</span>
                          {l.message_count ? <span style={{ background: '#3b82f6', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10, marginLeft: 6 }}>{l.message_count}</span> : null}
                          {l.instagram_handle && <div style={{ fontSize: 10, color: 'var(--text3)' }}>@{l.instagram_handle}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.leadBadge} style={{ background: `${st.color}20`, color: st.color }}>
                        <i className={`fas ${st.icon}`} style={{ fontSize: 8 }} /> {st.label}
                      </span>
                    </td>
                    <td>
                      {(l.tags || []).map(t => (
                        <span key={t} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'var(--bg4)', color: 'var(--text3)', marginRight: 3 }}>{t}</span>
                      ))}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text3)' }}>{l.source || '--'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text3)' }}>{date}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lead Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingLead ? editingLead.name : 'Nouveau lead'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0' }}>
          <input type="text" className="field-input" placeholder="Nom *" value={formName} onChange={e => setFormName(e.target.value)} />
          {editingLead && (
            <select className="field-input" value={formStatus} onChange={e => setFormStatus(e.target.value)}>
              {Object.entries(LEAD_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )}
          <input type="text" className="field-input" placeholder="@instagram (optionnel)" value={formIg} onChange={e => setFormIg(e.target.value)} />
          <input type="email" className="field-input" placeholder="Email (optionnel)" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
          <input type="tel" className="field-input" placeholder="Telephone (optionnel)" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
          <select className="field-input" value={formSource} onChange={e => setFormSource(e.target.value)}>
            {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <textarea className="field-input" placeholder="Notes" rows={2} value={formNotes} onChange={e => setFormNotes(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 8 }}>
            {editingLead && (
              <Button variant="outline" size="sm" onClick={deleteLead} style={{ color: 'var(--danger)' }}><i className="fas fa-trash" /></Button>
            )}
            <div style={{ flex: 1 }} />
            <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button variant="red" onClick={saveLead}>
              <i className={`fas ${editingLead ? 'fa-check' : 'fa-plus'}`} style={{ marginRight: 4 }} />
              {editingLead ? 'Sauvegarder' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
