'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import FormGroup from '@/components/ui/FormGroup'

interface NutritionTemplate {
  id: string
  nom: string
  category?: string | null
  template_type?: string
  calories_objectif?: number
  proteines?: number
  glucides?: number
  lipides?: number
  meals_data?: unknown
  created_at?: string
}

interface Props {
  templates: NutritionTemplate[]
  onRefresh: () => void
}

type SubTab = 'diete' | 'jour' | 'repas'

function mealCount(t: NutritionTemplate): number {
  try {
    const md = typeof t.meals_data === 'string' ? JSON.parse(t.meals_data) : (t.meals_data || [])
    if (Array.isArray(md)) return md.length
  } catch { /* ignore */ }
  return 0
}

export default function NutritionTemplatesList({ templates, onRefresh }: Props) {
  const supabase = createClient()
  const { coach } = useAuth()
  const { toast } = useToast()

  const [subTab, setSubTab] = useState<SubTab>('diete')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Editor state
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editCalories, setEditCalories] = useState(0)
  const [editProteines, setEditProteines] = useState(0)
  const [editGlucides, setEditGlucides] = useState(0)
  const [editLipides, setEditLipides] = useState(0)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const byType = templates.filter((t) => (t.template_type || 'jour') === subTab)
    const q = search.toLowerCase()
    return q ? byType.filter((t) => t.nom?.toLowerCase().includes(q)) : byType
  }, [templates, subTab, search])

  const groups = useMemo(() => {
    const g: Record<string, NutritionTemplate[]> = {}
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

  const existingCategories = useMemo(() => {
    return [...new Set(templates.map((t) => t.category).filter(Boolean))] as string[]
  }, [templates])

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  const startCreate = () => {
    setCreating(true)
    setEditing(null)
    setEditName('')
    setEditCategory('')
    setEditCalories(0)
    setEditProteines(0)
    setEditGlucides(0)
    setEditLipides(0)
  }

  const startEdit = (t: NutritionTemplate) => {
    setEditing(t.id)
    setCreating(false)
    setEditName(t.nom)
    setEditCategory(t.category || '')
    setEditCalories(t.calories_objectif || 0)
    setEditProteines(t.proteines || 0)
    setEditGlucides(t.glucides || 0)
    setEditLipides(t.lipides || 0)
  }

  const cancelEdit = () => {
    setEditing(null)
    setCreating(false)
  }

  const handleSave = async () => {
    if (!editName.trim()) {
      toast('Le nom est obligatoire', 'error')
      return
    }
    if (!coach) return

    setSaving(true)
    const payload = {
      nom: editName.trim(),
      category: editCategory || null,
      template_type: subTab,
      calories_objectif: editCalories,
      proteines: editProteines,
      glucides: editGlucides,
      lipides: editLipides,
      coach_id: coach.id,
    }

    let error
    if (editing) {
      ;({ error } = await supabase.from('nutrition_templates').update(payload).eq('id', editing))
    } else {
      ;({ error } = await supabase.from('nutrition_templates').insert(payload))
    }
    setSaving(false)

    if (error) {
      toast('Erreur: ' + error.message, 'error')
      return
    }
    toast(editing ? 'Template modifie' : 'Template cree')
    cancelEdit()
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce template ?')) return
    const { error } = await supabase.from('nutrition_templates').delete().eq('id', id)
    if (error) {
      toast('Erreur: ' + error.message, 'error')
      return
    }
    toast('Template supprime')
    onRefresh()
  }

  const subTabLabel = subTab === 'diete' ? 'Nouvelle diete' : subTab === 'jour' ? 'Nouveau jour' : 'Nouveau repas'

  if (editing || creating) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{editing ? 'Modifier' : 'Nouveau'} template {subTab}</h2>
          <Button variant="outline" onClick={cancelEdit}><i className="fas fa-arrow-left" /> Retour</Button>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <FormGroup label="Nom *">
            <input type="text" className="form-control" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="ex: Seche 2000kcal" />
          </FormGroup>
          <FormGroup label="Categorie">
            <select className="form-control" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
              <option value="">Sans categorie</option>
              {existingCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormGroup>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginTop: 12 }}>
            <FormGroup label="Calories (kcal)">
              <input type="number" className="form-control" value={editCalories} onChange={(e) => setEditCalories(Number(e.target.value))} />
            </FormGroup>
            <FormGroup label="Proteines (g)">
              <input type="number" className="form-control" value={editProteines} onChange={(e) => setEditProteines(Number(e.target.value))} />
            </FormGroup>
            <FormGroup label="Glucides (g)">
              <input type="number" className="form-control" value={editGlucides} onChange={(e) => setEditGlucides(Number(e.target.value))} />
            </FormGroup>
            <FormGroup label="Lipides (g)">
              <input type="number" className="form-control" value={editLipides} onChange={(e) => setEditLipides(Number(e.target.value))} />
            </FormGroup>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <Button variant="red" onClick={handleSave} loading={saving}>
              <i className="fas fa-save" /> Sauvegarder
            </Button>
            <Button variant="outline" onClick={cancelEdit}>Annuler</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div className="athlete-tabs" style={{ marginBottom: 16 }}>
        <button className={`athlete-tab-btn${subTab === 'diete' ? ' active' : ''}`} onClick={() => setSubTab('diete')}>
          <i className="fas fa-utensils" /> Diete
        </button>
        <button className={`athlete-tab-btn${subTab === 'jour' ? ' active' : ''}`} onClick={() => setSubTab('jour')}>
          <i className="fas fa-calendar-day" /> Jour
        </button>
        <button className={`athlete-tab-btn${subTab === 'repas' ? ' active' : ''}`} onClick={() => setSubTab('repas')}>
          <i className="fas fa-drumstick-bite" /> Repas
        </button>
      </div>

      {/* Search + create */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 13 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            style={{ width: '100%', padding: '8px 12px 8px 34px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>
        <Button variant="red" onClick={startCreate}>
          <i className="fas fa-plus" /> {subTabLabel}
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="fas fa-utensils"
          message={search ? 'Aucun resultat' : `Aucun template ${subTab}`}
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
                  {items.map((t) => {
                    const mc = mealCount(t)
                    const subtitle = `${t.calories_objectif || 0} kcal · P:${t.proteines || 0}g G:${t.glucides || 0}g L:${t.lipides || 0}g${subTab === 'jour' && mc ? ` · ${mc} repas` : ''}`
                    return (
                      <div key={t.id} className="card" style={{ margin: 0 }}>
                        <div className="card-header">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="card-title" style={{ fontSize: 14 }}>{t.nom}</div>
                            <div style={{ color: 'var(--text2)', fontSize: 11, marginTop: 3 }}>{subtitle}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <Button variant="outline" size="sm" onClick={() => startEdit(t)}>
                              <i className="fas fa-pen" />
                            </Button>
                            <Button variant="outline" size="sm" className="btn-danger" onClick={() => handleDelete(t.id)}>
                              <i className="fas fa-trash" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
