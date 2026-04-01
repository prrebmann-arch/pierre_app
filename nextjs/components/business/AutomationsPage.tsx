'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Toggle from '@/components/ui/Toggle'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/business.module.css'

// ── Types ──
interface AutomationMessage {
  id?: string
  automation_id?: string
  message_text: string
  delay_seconds: number
  position: number
}

interface Automation {
  id: string
  name: string
  trigger_type: 'dm' | 'comment_reply' | 'story_reply'
  trigger_keyword?: string
  is_active: boolean
  automation_messages?: AutomationMessage[]
  created_at: string
}

interface WizardData {
  name: string
  trigger_type: 'dm' | 'comment_reply' | 'story_reply'
  trigger_keyword: string
  messages: { text: string; delay: number }[]
}

const DELAYS = [
  { v: 0, l: 'Aucun' }, { v: 60, l: '1 minute' }, { v: 300, l: '5 minutes' },
  { v: 900, l: '15 minutes' }, { v: 1800, l: '30 minutes' }, { v: 3600, l: '1 heure' },
  { v: 7200, l: '2 heures' }, { v: 86400, l: '1 jour' },
]

const TRIGGER_LABELS: Record<string, string> = {
  dm: 'DM recu', comment_reply: 'Commentaire', story_reply: 'Story reply',
}
const TRIGGER_ICONS: Record<string, string> = {
  dm: 'fa-comment', comment_reply: 'fa-comments', story_reply: 'fa-circle',
}

export default function AutomationsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [automations, setAutomations] = useState<Automation[]>([])
  const [wizardStep, setWizardStep] = useState(0) // 0 = list view, 1-4 = wizard
  const [wizardData, setWizardData] = useState<WizardData>({
    name: '', trigger_type: 'dm', trigger_keyword: '', messages: [{ text: '', delay: 0 }],
  })

  const loadAutomations = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('automations')
      .select('*, automation_messages(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setAutomations((data || []) as Automation[])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => { loadAutomations() }, [loadAutomations])

  async function toggleAuto(id: string, on: boolean) {
    await supabase.from('automations').update({ is_active: on }).eq('id', id)
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: on } : a))
    toast(on ? 'Automatisation activee' : 'Automatisation desactivee', 'success')
  }

  async function deleteAuto(id: string) {
    if (!confirm('Supprimer cette automatisation ?')) return
    await supabase.from('automations').delete().eq('id', id)
    toast('Automatisation supprimee', 'success')
    loadAutomations()
  }

  function startWizard() {
    setWizardData({ name: '', trigger_type: 'dm', trigger_keyword: '', messages: [{ text: '', delay: 0 }] })
    setWizardStep(1)
  }

  async function createAutomation() {
    if (!user) return
    const { data: auto, error: e1 } = await supabase.from('automations').insert({
      user_id: user.id,
      name: wizardData.name,
      trigger_type: wizardData.trigger_type,
      trigger_keyword: wizardData.trigger_keyword || null,
      is_active: true,
    }).select().single()

    if (e1 || !auto) { toast('Erreur: ' + (e1?.message || 'Unknown'), 'error'); return }

    const msgs = wizardData.messages.filter(m => m.text).map((m, i) => ({
      automation_id: (auto as Automation).id,
      message_text: m.text,
      delay_seconds: m.delay,
      position: i + 1,
    }))
    if (msgs.length) {
      const { error: e2 } = await supabase.from('automation_messages').insert(msgs)
      if (e2) toast('Erreur messages: ' + e2.message, 'error')
    }

    toast('Automatisation creee !', 'success')
    setWizardStep(0)
    loadAutomations()
  }

  if (loading) return <Skeleton />

  // ── Wizard Steps ──
  if (wizardStep > 0) {
    return (
      <div className={styles.wizardWrap}>
        {/* Step 1: Name */}
        {wizardStep === 1 && (
          <>
            <div className={styles.wizardStep}>Etape 1/4</div>
            <h2 className={styles.wizardTitle}>Nommez votre automatisation</h2>
            <input
              type="text" className="field-input" placeholder="Ex: New Customer outreach"
              value={wizardData.name}
              onChange={e => setWizardData(prev => ({ ...prev, name: e.target.value }))}
              style={{ fontSize: 15, padding: 14 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <Button variant="outline" onClick={() => setWizardStep(0)}>Annuler</Button>
              <Button variant="red" onClick={() => {
                if (!wizardData.name.trim()) { toast('Nom obligatoire', 'error'); return }
                setWizardStep(2)
              }}>Continuer</Button>
            </div>
          </>
        )}

        {/* Step 2: Trigger */}
        {wizardStep === 2 && (
          <>
            <div className={styles.wizardStep}>Etape 2/4</div>
            <h2 className={styles.wizardTitle}>Quand declencher ?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { type: 'dm' as const, icon: 'fa-comment', label: "Quelqu'un m'envoie un DM" },
                { type: 'comment_reply' as const, icon: 'fa-comments', label: 'Quelqu\'un commente un post ou reel' },
                { type: 'story_reply' as const, icon: 'fa-circle', label: 'Quelqu\'un repond a ma story' },
              ]).map(opt => (
                <button
                  key={opt.type}
                  className={`${styles.triggerOption} ${wizardData.trigger_type === opt.type ? styles.triggerOptionActive : ''}`}
                  onClick={() => setWizardData(prev => ({ ...prev, trigger_type: opt.type }))}
                >
                  <i className={`fas ${opt.icon}`} style={{ fontSize: 20 }} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <input
                type="text" className="field-input" placeholder="Mot-cle declencheur (optionnel)"
                value={wizardData.trigger_keyword}
                onChange={e => setWizardData(prev => ({ ...prev, trigger_keyword: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <Button variant="outline" onClick={() => setWizardStep(1)}>Retour</Button>
              <Button variant="red" onClick={() => setWizardStep(3)}>Continuer</Button>
            </div>
          </>
        )}

        {/* Step 3: Messages */}
        {wizardStep === 3 && (
          <>
            <div className={styles.wizardStep}>Etape 3/4</div>
            <h2 className={styles.wizardTitle}>Message de reponse</h2>
            {wizardData.messages.map((m, i) => (
              <div key={i} style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>Message {i + 1}</span>
                  {i > 0 && (
                    <button className="nd2-btn nd2-btn-del" onClick={() => setWizardData(prev => ({
                      ...prev, messages: prev.messages.filter((_, j) => j !== i),
                    }))}><i className="fas fa-times" /></button>
                  )}
                </div>
                <textarea
                  className="field-input" rows={3} placeholder="Votre message..."
                  value={m.text}
                  onChange={e => setWizardData(prev => ({
                    ...prev, messages: prev.messages.map((msg, j) => j === i ? { ...msg, text: e.target.value } : msg),
                  }))}
                  style={{ marginBottom: 8 }}
                />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Delai</div>
                <select
                  className="field-input"
                  value={m.delay}
                  onChange={e => setWizardData(prev => ({
                    ...prev, messages: prev.messages.map((msg, j) => j === i ? { ...msg, delay: parseInt(e.target.value) || 0 } : msg),
                  }))}
                >
                  {DELAYS.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
                </select>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setWizardData(prev => ({
              ...prev, messages: [...prev.messages, { text: '', delay: 0 }],
            }))} style={{ marginBottom: 16 }}>
              <i className="fas fa-plus" /> Ajouter un message
            </Button>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Button variant="outline" onClick={() => setWizardStep(2)}>Retour</Button>
              <Button variant="red" onClick={() => {
                const valid = wizardData.messages.filter(m => m.text.trim())
                if (!valid.length) { toast('Au moins un message requis', 'error'); return }
                setWizardData(prev => ({ ...prev, messages: valid }))
                setWizardStep(4)
              }}>Continuer</Button>
            </div>
          </>
        )}

        {/* Step 4: Confirm */}
        {wizardStep === 4 && (
          <>
            <div className={styles.wizardStep}>Etape 4/4</div>
            <h2 className={styles.wizardTitle}>Confirmation</h2>
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Nom</span>
                <div style={{ fontWeight: 600 }}>{wizardData.name}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Declencheur</span>
                <div style={{ fontWeight: 600 }}>
                  {TRIGGER_LABELS[wizardData.trigger_type]}
                  {wizardData.trigger_keyword && ` (mot-cle: "${wizardData.trigger_keyword}")`}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Messages</span>
                <div style={{ fontWeight: 600 }}>{wizardData.messages.length} message{wizardData.messages.length > 1 ? 's' : ''}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <Button variant="outline" onClick={() => setWizardStep(3)}>Retour</Button>
              <Button variant="red" onClick={createAutomation}>
                <i className="fas fa-check" style={{ marginRight: 4 }} />Creer l&apos;automatisation
              </Button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── List View ──
  if (!automations.length) {
    return (
      <EmptyState
        icon="fas fa-robot"
        message="Creez une automatisation pour repondre automatiquement aux DMs et commentaires"
        action={<Button variant="red" onClick={startWizard}><i className="fas fa-plus" style={{ marginRight: 6 }} />Nouvelle Automatisation</Button>}
      />
    )
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button variant="red" size="sm" onClick={startWizard}><i className="fas fa-plus" /> Nouvelle Automatisation</Button>
      </div>
      {automations.map(a => {
        const msgs = a.automation_messages || []
        return (
          <div key={a.id} className={styles.autoCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className={styles.autoIcon} style={{ background: a.is_active ? 'rgba(34,197,94,0.12)' : 'var(--bg4)' }}>
                <i className="fas fa-robot" style={{ color: a.is_active ? 'var(--success)' : 'var(--text3)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  <i className={`fas ${TRIGGER_ICONS[a.trigger_type]}`} style={{ marginRight: 4 }} />
                  {TRIGGER_LABELS[a.trigger_type]}
                  {a.trigger_keyword && ` \u00b7 mot-cle: "${a.trigger_keyword}"`}
                  {` \u00b7 ${msgs.length} message${msgs.length > 1 ? 's' : ''}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Toggle checked={a.is_active} onChange={(on) => toggleAuto(a.id, on)} />
              <button className="nd2-btn nd2-btn-del" onClick={() => deleteAuto(a.id)}><i className="fas fa-trash" /></button>
            </div>
          </div>
        )
      })}
    </>
  )
}
