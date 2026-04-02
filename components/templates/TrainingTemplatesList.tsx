'use client'

import { useState, useMemo } from 'react'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

interface TrainingTemplate {
  id: string
  nom: string
  category?: string | null
  pattern_type?: string
  pattern_data?: Record<string, unknown>
  sessions_data?: Array<{
    nom?: string
    jour?: string
    exercices?: Array<{ nom?: string; series?: string | number; reps?: string }> | string
    exercises?: Array<{ nom?: string; series?: string | number; reps?: string }>
  }>
  created_at?: string
}

interface Props {
  templates: TrainingTemplate[]
  onEdit: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

function parseSessionExercises(s: Record<string, any>) {
  let exs: Array<{ series?: string | number }> = []
  try {
    const raw = s.exercices ?? s.exercises ?? []
    exs = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    exs = []
  }
  return exs
}

export default function TrainingTemplatesList({ templates, onEdit, onCreate, onDelete }: Props) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q ? templates.filter((t) => t.nom?.toLowerCase().includes(q)) : templates
  }, [templates, search])

  const groups = useMemo(() => {
    const g: Record<string, TrainingTemplate[]> = {}
    filtered.forEach((t) => {
      const cat = t.category || 'Sans categorie'
      if (!g[cat]) g[cat] = []
      g[cat].push(t)
    })
    return g
  }, [filtered])

  const catNames = useMemo(() => {
    return Object.keys(groups).sort((a, b) => {
      if (a === 'Sans categorie') return 1
      if (b === 'Sans categorie') return -1
      return a.localeCompare(b)
    })
  }, [groups])

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 13 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un template..."
            style={{ width: '100%', padding: '8px 12px 8px 34px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>
        <Button variant="red" onClick={onCreate}>
          <i className="fas fa-plus" /> Nouveau template
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={search ? 'fas fa-search' : 'fas fa-dumbbell'}
          message={search ? 'Aucun resultat' : 'Aucun template training'}
          action={!search ? <Button variant="red" onClick={onCreate}><i className="fas fa-plus" /> Creer un template</Button> : undefined}
        />
      ) : (
        catNames.map((cat) => {
          const items = groups[cat]
          const isCollapsed = collapsed[cat]
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div
                onClick={() => toggleCategory(cat)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', userSelect: 'none',
                  marginBottom: isCollapsed ? 0 : 8,
                }}
              >
                <i className={`fas fa-chevron-${isCollapsed ? 'right' : 'down'}`} style={{ fontSize: 10, color: 'var(--text3)', width: 12 }} />
                <i className={`fas fa-folder${isCollapsed ? '' : '-open'}`} style={{ color: 'var(--primary)', fontSize: 13 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{cat}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{items.length}</span>
              </div>
              {!isCollapsed && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 8 }}>
                  {items.map((t) => (
                    <TrainingTemplateCard key={t.id} template={t} onEdit={onEdit} onDelete={onDelete} />
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function TrainingTemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: TrainingTemplate
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const sd = template.sessions_data ?? []
  let totalEx = 0
  let totalSeries = 0
  sd.forEach((s) => {
    const exs = parseSessionExercises(s)
    exs.forEach((ex) => {
      totalEx++
      totalSeries += parseInt(String(ex.series)) || 0
    })
  })

  const sessionTags = sd.map((s) => s.nom || 'Seance')

  return (
    <div
      className="card"
      style={{ margin: 0, cursor: 'pointer' }}
      onClick={() => onEdit(template.id)}
    >
      <div className="card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title" style={{ fontSize: 14 }}>{template.nom}</div>
          <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 3 }}>
            {sd.length} seance(s) · {totalEx} exos · {totalSeries} series
          </div>
          {sessionTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
              {sessionTags.map((tag, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block', padding: '2px 8px', background: 'var(--bg3)',
                    borderRadius: 6, fontSize: 11, color: 'var(--text2)', fontWeight: 500,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm" onClick={() => onEdit(template.id)} title="Modifier">
            <i className="fas fa-pen" />
          </Button>
          <Button variant="outline" size="sm" className="btn-danger" onClick={() => onDelete(template.id)} title="Supprimer">
            <i className="fas fa-trash" />
          </Button>
        </div>
      </div>
    </div>
  )
}
