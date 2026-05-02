'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import Skeleton from '@/components/ui/Skeleton'

const QUICK_MESSAGES = [
  'Bon entraînement à tous cette semaine !',
  'Pensez à rentrer vos bilans avant dimanche.',
  'Petite annonce importante :',
  'Bravo à tous pour vos progrès !',
  'Rappel : objectif de la semaine 👇',
]

type Tab = 'text' | 'loom'

export default function AnnoncesPage() {
  const { user, accessToken } = useAuth()
  const { toast } = useToast()
  const { athletes, loading: athletesLoading } = useAthleteContext()

  const [tab, setTab] = useState<Tab>('text')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Editor state
  const [selectedChip, setSelectedChip] = useState(-1)
  const [customMsg, setCustomMsg] = useState('')
  const [loomUrl, setLoomUrl] = useState('')
  const [titre, setTitre] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Audio recorder — path without athleteId since broadcast
  const audio = useAudioRecorder({
    bucket: 'coach-audio',
    pathPrefix: `${user?.id || 'unknown'}/annonce_`,
  })

  // Filtered & sorted athletes
  const filteredAthletes = useMemo(() => {
    const q = search.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const list = (athletes || []).filter((a) => a.id && a.coach_id === user?.id)
    if (!q) return list.sort((a, b) => (a.prenom || '').localeCompare(b.prenom || ''))
    return list.filter((a) => {
      const name = `${a.prenom || ''} ${a.nom || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return name.includes(q)
    }).sort((a, b) => (a.prenom || '').localeCompare(b.prenom || ''))
  }, [athletes, search, user?.id])

  const allSelected = filteredAthletes.length > 0 && filteredAthletes.every((a) => selectedIds.has(a.id))
  const someSelected = selectedIds.size > 0

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        filteredAthletes.forEach((a) => next.delete(a.id))
      } else {
        filteredAthletes.forEach((a) => next.add(a.id))
      }
      return next
    })
  }

  function clearAll() {
    setSelectedIds(new Set())
  }

  // Auto-suggest title from message
  useEffect(() => {
    const message = customMsg.trim() || (selectedChip >= 0 ? QUICK_MESSAGES[selectedChip] : '')
    if (message && !titre) setTitre(message.slice(0, 40))
  }, [customMsg, selectedChip, titre])

  const message = customMsg.trim() || (selectedChip >= 0 ? QUICK_MESSAGES[selectedChip] : '')
  const hasMessage = !!message
  const hasAudio = !!audio.audioUrl
  const hasLoom = !!loomUrl.trim()

  function reset() {
    setSelectedChip(-1)
    setCustomMsg('')
    setLoomUrl('')
    setTitre('')
    audio.clearAudio()
    setTab('text')
  }

  async function handleSubmit() {
    if (selectedIds.size === 0) { toast('Sélectionne au moins un destinataire', 'error'); return }
    if (!hasMessage && !hasAudio && !hasLoom) { toast('Ajoute un message, un Loom ou un vocal', 'error'); return }

    setSubmitting(true)
    try {
      const finalTitre = titre.trim() || (
        hasMessage ? message.slice(0, 40)
        : hasAudio ? 'Message vocal'
        : hasLoom ? 'Vidéo Loom'
        : 'Annonce'
      )
      const type = hasLoom ? (hasAudio ? 'mixed' : 'loom') : (hasAudio ? 'audio' : 'message')

      const res = await fetch('/api/annonces/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken || ''}` },
        body: JSON.stringify({
          athlete_ids: Array.from(selectedIds),
          type,
          titre: finalTitre,
          commentaire: message || null,
          audio_url: hasAudio ? audio.audioUrl : null,
          loom_url: hasLoom ? loomUrl.trim() : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(`Erreur: ${json.error || res.status}`, 'error')
        return
      }
      toast(`Envoyé à ${json.inserted} athlète${json.inserted > 1 ? 's' : ''}${json.skipped_no_user > 0 ? ` (${json.skipped_no_user} sans push)` : ''}`, 'success')
      reset()
      setSelectedIds(new Set())
    } catch (e: any) {
      console.error('[annonces] submit', e)
      toast(`Erreur: ${e.message || e}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (athletesLoading) return <Skeleton height={500} borderRadius={12} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.4 }}>
          <i className="fas fa-bullhorn" style={{ color: '#ef4444', marginRight: 10 }} />
          Annonces
        </h1>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
          Envoie un message, un vocal ou une vidéo Loom à plusieurs athlètes en un clic.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 16, alignItems: 'start' }}>
        {/* LEFT: recipients picker */}
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 14, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <strong style={{ fontSize: 13 }}>Destinataires</strong>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              background: someSelected ? 'rgba(239,68,68,0.15)' : 'var(--bg3)',
              color: someSelected ? '#ef4444' : 'var(--text3)',
            }}>
              {selectedIds.size} / {(athletes || []).length}
            </span>
          </div>

          <input
            type="text"
            placeholder="Rechercher un athlète..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-control"
            style={{ fontSize: 13 }}
          />

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={toggleAllFiltered}
              className="btn btn-outline btn-sm"
              style={{ flex: 1 }}
            >
              <i className={`fas fa-${allSelected ? 'square-minus' : 'square-check'}`} style={{ marginRight: 4 }} />
              {allSelected ? 'Tout décocher' : 'Tout cocher'}
              {search && filteredAthletes.length !== (athletes || []).length && ` (${filteredAthletes.length})`}
            </button>
            {someSelected && (
              <button onClick={clearAll} className="btn btn-outline btn-sm" title="Effacer la sélection">
                <i className="fas fa-times" />
              </button>
            )}
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            overflow: 'auto', flex: 1, minHeight: 200,
            margin: '0 -6px', padding: '0 6px',
          }}>
            {filteredAthletes.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: 20 }}>
                Aucun athlète ne correspond
              </div>
            )}
            {filteredAthletes.map((a) => {
              const on = selectedIds.has(a.id)
              const noUser = !a.user_id
              return (
                <button
                  key={a.id}
                  onClick={() => toggle(a.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: on ? 'rgba(239,68,68,0.10)' : 'var(--bg)',
                    border: on ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border)',
                    borderRadius: 8,
                    cursor: 'pointer', textAlign: 'left',
                    color: 'var(--text)',
                    transition: 'all 100ms',
                  }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: 4,
                    border: on ? '1.5px solid #ef4444' : '1.5px solid var(--text3)',
                    background: on ? '#ef4444' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {on && <i className="fas fa-check" style={{ color: 'white', fontSize: 9 }} />}
                  </span>
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: 'var(--text3)', flexShrink: 0,
                    }}>
                      {(a.prenom?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.prenom} {a.nom}
                    </div>
                    {noUser && (
                      <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                        Pas inscrit (pas de push)
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* RIGHT: editor */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            <button onClick={() => setTab('text')} style={tabBtn(tab === 'text')}>
              <i className="fas fa-comment-alt" style={{ marginRight: 6 }} />Texte ou vocal
            </button>
            <button onClick={() => setTab('loom')} style={tabBtn(tab === 'loom')}>
              <i className="fab fa-loom" style={{ marginRight: 6 }} />Loom
            </button>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={labelStyle}><i className="fas fa-tag" style={{ marginRight: 4 }} />Titre (optionnel)</div>
              <input
                type="text" placeholder="Auto-généré si vide"
                value={titre} onChange={(e) => setTitre(e.target.value)}
                className="form-control" maxLength={80}
              />
            </div>

            {tab === 'text' && (
              <>
                <div>
                  <div style={labelStyle}><i className="fas fa-comment-dots" style={{ marginRight: 4 }} />Messages rapides</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {QUICK_MESSAGES.map((msg, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setSelectedChip(i); setCustomMsg('') }}
                        style={{
                          padding: '6px 12px',
                          background: selectedChip === i ? 'rgba(239,68,68,0.15)' : 'var(--bg)',
                          border: selectedChip === i ? '1px solid #ef4444' : '1px solid var(--border)',
                          borderRadius: 8, fontSize: 12, cursor: 'pointer',
                          color: 'var(--text)',
                        }}
                      >
                        {msg}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={labelStyle}><i className="fas fa-pen" style={{ marginRight: 4 }} />Message personnalisé</div>
                  <textarea
                    placeholder="Tape ton message..."
                    value={customMsg}
                    onChange={(e) => { setCustomMsg(e.target.value); if (e.target.value) setSelectedChip(-1) }}
                    rows={4}
                    className="form-control"
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <div style={labelStyle}><i className="fas fa-microphone" style={{ marginRight: 4 }} />Message vocal</div>
                  {!audio.audioUrl ? (
                    !audio.isRecording ? (
                      <button
                        onClick={() => audio.startRecording()}
                        disabled={audio.uploading}
                        className="btn btn-outline"
                        style={{ width: '100%' }}
                      >
                        <i className="fas fa-microphone" style={{ marginRight: 6 }} />
                        {audio.uploading ? 'Upload...' : 'Enregistrer un vocal'}
                      </button>
                    ) : (
                      <button
                        onClick={() => audio.stopRecording()}
                        className="btn btn-red"
                        style={{ width: '100%' }}
                      >
                        <i className="fas fa-stop" style={{ marginRight: 6 }} />
                        Stop ({formatTime(audio.seconds)})
                      </button>
                    )
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <audio src={audio.audioUrl} controls style={{ flex: 1, height: 32 }} />
                      <button onClick={() => audio.clearAudio()} className="btn btn-outline btn-sm" title="Supprimer">
                        <i className="fas fa-trash-can" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'loom' && (
              <div>
                <div style={labelStyle}><i className="fab fa-loom" style={{ marginRight: 4 }} />URL Loom</div>
                <input
                  type="url"
                  placeholder="https://www.loom.com/share/..."
                  value={loomUrl}
                  onChange={(e) => setLoomUrl(e.target.value)}
                  className="form-control"
                />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  Tu peux ajouter un message ci-dessus (onglet Texte) qui accompagnera la vidéo.
                </div>
              </div>
            )}

            {/* Submit bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
              padding: '14px 0 0', borderTop: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1, fontSize: 11, color: 'var(--text3)' }}>
                {selectedIds.size === 0 ? (
                  <span style={{ color: '#f59e0b' }}>⚠ Sélectionne au moins un destinataire</span>
                ) : !hasMessage && !hasAudio && !hasLoom ? (
                  <span style={{ color: '#f59e0b' }}>⚠ Ajoute un message, un vocal ou un Loom</span>
                ) : (
                  <>Sera envoyé à <strong style={{ color: 'var(--text)' }}>{selectedIds.size}</strong> athlète{selectedIds.size > 1 ? 's' : ''}</>
                )}
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || selectedIds.size === 0 || (!hasMessage && !hasAudio && !hasLoom)}
                className="btn btn-red"
                style={{ minWidth: 160 }}
              >
                {submitting ? '...' : (
                  <><i className="fas fa-paper-plane" style={{ marginRight: 6 }} />Envoyer</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const tabBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '12px 14px', background: 'transparent',
  color: active ? '#ef4444' : 'var(--text2)',
  border: 'none',
  borderBottom: active ? '2px solid #ef4444' : '2px solid transparent',
  cursor: 'pointer', fontSize: 13, fontWeight: 600,
})

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: 0.5,
}
