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
      {/* Search + Create bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 400 }}>
          <i className="fas fa-search" style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text3)', fontSize: 12,
          }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un template..."
            style={{
              width: '100%', padding: '10px 14px 10px 38px',
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              fontSize: 13, outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          />
        </div>
        <Button variant="red" onClick={onCreate}>
          <i className="fas fa-plus" style={{ marginRight: 6 }} /> Nouveau template
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={search ? 'fas fa-search' : 'fas fa-dumbbell'}
          message={search ? 'Aucun resultat' : 'Aucun template training'}
          action={!search ? <Button variant="red" onClick={onCreate}><i className="fas fa-plus" /> Creer un template</Button> : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {catNames.map((cat) => {
            const items = groups[cat]
            const isCollapsed = collapsed[cat]
            return (
              <div key={cat}>
                {/* Category header */}
                <div
                  onClick={() => toggleCategory(cat)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', cursor: 'pointer', userSelect: 'none',
                    marginBottom: isCollapsed ? 0 : 12,
                    borderRadius: 'var(--radius-sm)',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <i
                    className={`fas fa-chevron-${isCollapsed ? 'right' : 'down'}`}
                    style={{
                      fontSize: 9, color: 'var(--text3)', width: 14,
                      transition: 'transform var(--transition-fast)',
                    }}
                  />
                  <i
                    className={`fas fa-folder${isCollapsed ? '' : '-open'}`}
                    style={{ color: 'var(--primary)', fontSize: 14 }}
                  />
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: 'var(--text)',
                    letterSpacing: '-0.01em', flex: 1,
                  }}>
                    {cat}
                  </span>
                  <span style={{
                    fontSize: 11, color: 'var(--text3)',
                    background: 'var(--bg3)', padding: '2px 10px',
                    borderRadius: 20, fontWeight: 600,
                  }}>
                    {items.length}
                  </span>
                </div>

                {/* Cards grid */}
                {!isCollapsed && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 12,
                  }}>
                    {items.map((t) => (
                      <TrainingTemplateCard key={t.id} template={t} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
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
  const [hovered, setHovered] = useState(false)

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onEdit(template.id)}
      style={{
        position: 'relative',
        background: hovered ? 'var(--bg-card-hover)' : 'var(--bg2)',
        border: `1px solid ${hovered ? 'var(--primary-border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '20px 22px',
        cursor: 'pointer',
        transition: 'all var(--transition-base)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? 'var(--shadow-card-hover), 0 0 20px rgba(179,8,8,0.06)' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Red accent line at top */}
      <div style={{
        position: 'absolute', top: 0, left: 20, right: 20,
        height: 2, background: 'var(--primary)',
        opacity: hovered ? 1 : 0,
        transition: 'opacity var(--transition-fast)',
        borderRadius: '0 0 2px 2px',
      }} />

      {/* Title row */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, marginBottom: 12,
      }}>
        <h3 style={{
          margin: 0, fontSize: 15, fontWeight: 700,
          color: 'var(--text)', letterSpacing: '-0.01em',
          lineHeight: 1.3, flex: 1, minWidth: 0,
        }}>
          {template.nom}
        </h3>

        {/* Action buttons - visible on hover */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex', gap: 4, flexShrink: 0,
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateX(0)' : 'translateX(4px)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <button
            onClick={() => onEdit(template.id)}
            title="Modifier"
            style={{
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 8, cursor: 'pointer', color: 'var(--text2)',
              fontSize: 11, transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--primary)'
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.borderColor = 'var(--primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg3)'
              e.currentTarget.style.color = 'var(--text2)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <i className="fas fa-pen" />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            title="Supprimer"
            style={{
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 8, cursor: 'pointer', color: 'var(--text2)',
              fontSize: 11, transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--danger)'
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.borderColor = 'var(--danger)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg3)'
              e.currentTarget.style.color = 'var(--text2)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <i className="fas fa-trash" />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        marginBottom: sessionTags.length > 0 ? 14 : 0,
        fontSize: 12, color: 'var(--text3)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="fas fa-calendar-day" style={{ fontSize: 10, color: 'var(--primary)', opacity: 0.7 }} />
          <span><strong style={{ color: 'var(--text2)', fontWeight: 600 }}>{sd.length}</strong> seance{sd.length > 1 ? 's' : ''}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="fas fa-dumbbell" style={{ fontSize: 10, color: 'var(--primary)', opacity: 0.7 }} />
          <span><strong style={{ color: 'var(--text2)', fontWeight: 600 }}>{totalEx}</strong> exos</span>
        </span>
        {totalSeries > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fas fa-layer-group" style={{ fontSize: 10, color: 'var(--primary)', opacity: 0.7 }} />
            <span><strong style={{ color: 'var(--text2)', fontWeight: 600 }}>{totalSeries}</strong> series</span>
          </span>
        )}
      </div>

      {/* Session tags */}
      {sessionTags.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 5,
          paddingTop: 12,
          borderTop: '1px solid var(--border-subtle)',
        }}>
          {sessionTags.map((tag, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                background: 'var(--primary-bg)',
                border: '1px solid var(--primary-border)',
                borderRadius: 6,
                fontSize: 11,
                color: 'var(--text2)',
                fontWeight: 500,
                letterSpacing: '0.01em',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
