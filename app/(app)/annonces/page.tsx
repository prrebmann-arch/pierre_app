'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import Skeleton from '@/components/ui/Skeleton'
import NouveauRetourPanel from '@/components/recorder/NouveauRetourPanel'

export default function AnnoncesPage() {
  const { user } = useAuth()
  const { athletes, loading: athletesLoading } = useAthleteContext()

  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
  const broadcastIds = useMemo(() => Array.from(selectedIds), [selectedIds])

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
      if (allSelected) filteredAthletes.forEach((a) => next.delete(a.id))
      else filteredAthletes.forEach((a) => next.add(a.id))
      return next
    })
  }

  function clearAll() { setSelectedIds(new Set()) }

  if (athletesLoading) return <Skeleton height={500} borderRadius={12} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1200 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.4 }}>
          <i className="fas fa-bullhorn" style={{ color: '#ef4444', marginRight: 10 }} />
          Annonces
        </h1>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
          Envoie un retour (texte / vocal / Loom URL / écran rec / portrait selfie) à plusieurs athlètes en un clic.
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
            type="text" placeholder="Rechercher un athlète..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="form-control" style={{ fontSize: 13 }}
          />

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={toggleAllFiltered} className="btn btn-outline btn-sm" style={{ flex: 1 }}>
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
                    color: 'var(--text)', transition: 'all 100ms',
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

        {/* RIGHT: full retour panel (broadcast mode) */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 16px 16px' }}>
          {selectedIds.size === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
              <i className="fas fa-arrow-left" style={{ fontSize: 28, marginBottom: 12, display: 'block' }} />
              Sélectionne au moins un destinataire à gauche pour composer ton annonce.
            </div>
          ) : (
            <NouveauRetourPanel
              athleteId=""
              broadcastIds={broadcastIds}
              active={true}
              onCreated={() => setSelectedIds(new Set())}
            />
          )}
        </div>
      </div>
    </div>
  )
}
