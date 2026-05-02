'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import Modal from '@/components/ui/Modal'
import styles from '@/styles/aliments.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Aliment {
  id: string
  nom: string
  calories: number
  proteines: number
  glucides: number
  lipides: number
  coach_id: string
}

interface OffAliment {
  nom: string
  calories: number
  proteines: number
  glucides: number
  lipides: number
}

type Source = 'momentum' | 'off' | 'ciqual' | 'perso'

// Ciqual local database (same as ATHLETE)
const CIQUAL_DB: { nom: string; calories: number; proteines: number; glucides: number; lipides: number }[] = [
  { nom: 'Agneau, épaule, cuit', calories: 2.36, proteines: 0.26, glucides: 0, lipides: 0.15 },
  { nom: 'Agneau, gigot, rôti', calories: 2.06, proteines: 0.28, glucides: 0, lipides: 0.105 },
  { nom: 'Bœuf, steak haché 5%, cuit', calories: 1.46, proteines: 0.26, glucides: 0, lipides: 0.05 },
  { nom: 'Bœuf, steak haché 15%, cuit', calories: 2.18, proteines: 0.25, glucides: 0, lipides: 0.135 },
  { nom: 'Bœuf, faux-filet, grillé', calories: 1.86, proteines: 0.27, glucides: 0, lipides: 0.087 },
  { nom: 'Poulet, blanc, cuit', calories: 1.21, proteines: 0.262, glucides: 0, lipides: 0.018 },
  { nom: 'Poulet, cuisse, cuit', calories: 1.77, proteines: 0.24, glucides: 0, lipides: 0.092 },
  { nom: 'Dinde, escalope, cuite', calories: 1.15, proteines: 0.26, glucides: 0, lipides: 0.013 },
  { nom: 'Porc, filet, rôti', calories: 1.59, proteines: 0.285, glucides: 0, lipides: 0.05 },
  { nom: 'Porc, jambon cuit', calories: 1.15, proteines: 0.21, glucides: 0.005, lipides: 0.03 },
  { nom: 'Saumon, cuit', calories: 2.06, proteines: 0.22, glucides: 0, lipides: 0.13 },
  { nom: 'Thon, cuit', calories: 1.44, proteines: 0.3, glucides: 0, lipides: 0.02 },
  { nom: 'Cabillaud, cuit', calories: 0.82, proteines: 0.19, glucides: 0, lipides: 0.007 },
  { nom: 'Crevettes, cuites', calories: 0.99, proteines: 0.21, glucides: 0, lipides: 0.012 },
  { nom: 'Œuf entier, cuit', calories: 1.55, proteines: 0.127, glucides: 0.011, lipides: 0.108 },
  { nom: 'Riz blanc, cuit', calories: 1.3, proteines: 0.027, glucides: 0.284, lipides: 0.003 },
  { nom: 'Pâtes, cuites', calories: 1.31, proteines: 0.05, glucides: 0.253, lipides: 0.019 },
  { nom: 'Pommes de terre, cuites', calories: 0.8, proteines: 0.02, glucides: 0.171, lipides: 0.001 },
  { nom: 'Patate douce, cuite', calories: 0.86, proteines: 0.016, glucides: 0.201, lipides: 0.001 },
  { nom: 'Flocons d\'avoine', calories: 3.79, proteines: 0.135, glucides: 0.586, lipides: 0.075 },
  { nom: 'Pain complet', calories: 2.47, proteines: 0.09, glucides: 0.413, lipides: 0.034 },
  { nom: 'Quinoa, cuit', calories: 1.2, proteines: 0.044, glucides: 0.214, lipides: 0.019 },
  { nom: 'Lentilles, cuites', calories: 1.16, proteines: 0.09, glucides: 0.201, lipides: 0.004 },
  { nom: 'Brocoli, cuit', calories: 0.35, proteines: 0.024, glucides: 0.072, lipides: 0.004 },
  { nom: 'Épinards, cuits', calories: 0.23, proteines: 0.029, glucides: 0.036, lipides: 0.003 },
  { nom: 'Avocat', calories: 1.69, proteines: 0.02, glucides: 0.085, lipides: 0.147 },
  { nom: 'Banane', calories: 0.89, proteines: 0.011, glucides: 0.228, lipides: 0.003 },
  { nom: 'Pomme', calories: 0.52, proteines: 0.003, glucides: 0.138, lipides: 0.002 },
  { nom: 'Fromage blanc 0%', calories: 0.46, proteines: 0.075, glucides: 0.039, lipides: 0.001 },
  { nom: 'Yaourt nature', calories: 0.61, proteines: 0.035, glucides: 0.047, lipides: 0.033 },
  { nom: 'Lait demi-écrémé', calories: 0.46, proteines: 0.032, glucides: 0.048, lipides: 0.015 },
  { nom: 'Beurre de cacahuète', calories: 5.88, proteines: 0.252, glucides: 0.2, lipides: 0.502 },
  { nom: 'Amandes', calories: 5.78, proteines: 0.212, glucides: 0.217, lipides: 0.494 },
  { nom: 'Huile d\'olive', calories: 8.84, proteines: 0, glucides: 0, lipides: 1 },
  { nom: 'Miel', calories: 3.04, proteines: 0.003, glucides: 0.824, lipides: 0 },
  { nom: 'Chocolat noir 70%', calories: 5.46, proteines: 0.079, glucides: 0.337, lipides: 0.41 },
]

function searchCiqual(q: string): { nom: string; calories: number; proteines: number; glucides: number; lipides: number }[] {
  if (!q || q.length < 2) return []
  const normalized = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const words = normalized.split(/\s+/).filter(Boolean)
  return CIQUAL_DB.filter((item) => {
    const name = item.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return words.every((w) => name.includes(w))
  })
}

export default function AlimentsPage() {
  const supabase = createClient()
  const { user } = useAuth()
  const { toast } = useToast()

  const [aliments, setAliments] = useState<Aliment[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<Source>('momentum')

  // OFF search
  const [offResults, setOffResults] = useState<OffAliment[]>([])
  const [offLoading, setOffLoading] = useState(false)
  const offTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editAliment, setEditAliment] = useState<Aliment | null>(null)

  const loadAliments = useCallback(async () => {
    const { data, error } = await supabase
      .from('aliments_db')
      .select('id, nom, calories, proteines, glucides, lipides, coach_id')
      .or(`coach_id.eq.${user?.id},coach_id.is.null`)
      .order('nom', { ascending: true })
      .limit(1000)
    if (error) { toast('Erreur chargement aliments', 'error'); return }
    setAliments((data || []) as Aliment[])
    setLoading(false)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadAliments() }, [loadAliments])

  useRefetchOnResume(loadAliments, loading)

  // OFF debounced search
  useEffect(() => {
    if ((source === 'off' || source === 'both') && query.length >= 2) {
      if (offTimerRef.current) clearTimeout(offTimerRef.current)
      setOffLoading(true)
      offTimerRef.current = setTimeout(async () => {
        try {
          const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&page_size=20&langs=fr&fields=product_name,nutriments,brands,code`
          const resp = await fetch(url, { headers: { 'User-Agent': 'MOMENTUM-Coach/1.0 (web)', Accept: 'application/json' } })
          const data = await resp.json()
          const results: OffAliment[] = (data.hits || [])
            .filter((p: any) => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
            .map((p: any) => {
              const brand = Array.isArray(p.brands) ? p.brands[0] : (p.brands || '')
              return {
                nom: p.product_name + (brand ? ` — ${brand}` : ''),
                calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
                proteines: Math.round(p.nutriments['proteins_100g'] || 0),
                glucides: Math.round(p.nutriments['carbohydrates_100g'] || 0),
                lipides: Math.round(p.nutriments['fat_100g'] || 0),
              }
            })
          setOffResults(results)
        } catch {
          setOffResults([])
        }
        setOffLoading(false)
      }, 300)
    } else {
      setOffResults([])
      setOffLoading(false)
    }
    return () => { if (offTimerRef.current) clearTimeout(offTimerRef.current) }
  }, [query, source])

  // Filter local
  const q = query.toLowerCase()
  const filteredLocal = q
    ? aliments.filter((a) => a.nom.toLowerCase().includes(q))
    : aliments

  // Add aliment
  async function handleAddSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const nom = (fd.get('nom') as string)?.trim()
    if (!nom) { toast('Nom obligatoire', 'error'); return }
    const calories = parseFloat(fd.get('calories') as string) || 0
    const proteines = parseFloat(fd.get('proteines') as string) || 0
    const glucides = parseFloat(fd.get('glucides') as string) || 0
    const lipides = parseFloat(fd.get('lipides') as string) || 0

    // Check duplicate
    const { data: existing } = await supabase
      .from('aliments_db')
      .select('id, nom')
      .eq('coach_id', user!.id)
      .ilike('nom', nom)
      .limit(1)
      .maybeSingle()

    if (existing) {
      if (!confirm(`L'aliment "${existing.nom}" existe deja. Mettre a jour ?`)) return
      const { error } = await supabase.from('aliments_db').update({ calories, proteines, glucides, lipides }).eq('id', existing.id)
      if (error) { toast('Erreur: ' + error.message, 'error'); return }
      toast('Aliment mis a jour !', 'success')
    } else {
      const { error } = await supabase.from('aliments_db').insert({
        nom, calories, proteines, glucides, lipides, coach_id: user!.id,
      })
      if (error) { toast('Erreur: ' + error.message, 'error'); return }
      toast('Aliment ajoute !', 'success')
    }
    setShowAddModal(false)
    loadAliments()
  }

  // Edit aliment
  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editAliment) return
    const fd = new FormData(e.currentTarget)
    const { error } = await supabase.from('aliments_db').update({
      nom: (fd.get('nom') as string)?.trim(),
      calories: parseFloat(fd.get('calories') as string) || 0,
      proteines: parseFloat(fd.get('proteines') as string) || 0,
      glucides: parseFloat(fd.get('glucides') as string) || 0,
      lipides: parseFloat(fd.get('lipides') as string) || 0,
    }).eq('id', editAliment.id)
    if (error) { toast('Erreur: ' + error.message, 'error'); return }
    toast('Aliment modifie !', 'success')
    setEditAliment(null)
    loadAliments()
  }

  // Delete aliment
  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet aliment ?')) return
    const { error } = await supabase.from('aliments_db').delete().eq('id', id)
    if (error) { toast('Erreur: ' + error.message, 'error'); return }
    toast('Aliment supprime !', 'success')
    setEditAliment(null)
    loadAliments()
  }

  // Import OFF aliment
  async function importOff(a: OffAliment) {
    const { data: existing } = await supabase
      .from('aliments_db')
      .select('id, nom')
      .eq('coach_id', user!.id)
      .ilike('nom', a.nom)
      .limit(1)
      .maybeSingle()

    if (existing) {
      if (!confirm(`L'aliment "${existing.nom}" existe deja. Mettre a jour ?`)) return
      const { error } = await supabase.from('aliments_db').update({
        calories: a.calories, proteines: a.proteines, glucides: a.glucides, lipides: a.lipides,
      }).eq('id', existing.id)
      if (error) { toast('Erreur: ' + error.message, 'error'); return }
    } else {
      const { error } = await supabase.from('aliments_db').insert({
        nom: a.nom, calories: a.calories, proteines: a.proteines, glucides: a.glucides, lipides: a.lipides, coach_id: user!.id,
      })
      if (error) { toast('Erreur: ' + error.message, 'error'); return }
    }
    toast('Aliment importe !', 'success')
    loadAliments()
  }

  return (
    <div>
      <h1 className="page-title">Aliments</h1>

      {/* Header: search + source + add */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.searchWrap}>
            <i className={`fa-solid fa-magnifying-glass ${styles.searchIcon}`} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Rechercher un aliment..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.sourceToggle}>
            {(['momentum', 'off', 'ciqual', 'perso'] as Source[]).map((s) => (
              <button
                key={s}
                className={`${styles.srcBtn} ${source === s ? styles.srcBtnActive : ''}`}
                onClick={() => setSource(s)}
              >
                {s === 'momentum' ? 'Momentum' : s === 'off' ? 'Open Food' : s === 'ciqual' ? 'Ciqual' : 'Mes aliments'}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-red" onClick={() => setShowAddModal(true)}>
          <i className="fa-solid fa-plus" /> Ajouter
        </button>
      </div>

      {/* List */}
      <div className={styles.list}>
        {/* Momentum / Mes aliments results */}
        {(source === 'momentum' || source === 'perso') && (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                <i className="fa-solid fa-spinner fa-spin" />
              </div>
            ) : filteredLocal.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                <i className="fa-solid fa-apple-whole" style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
                Aucun aliment
              </div>
            ) : (
              filteredLocal.map((a) => (
                <div key={a.id} className={styles.alimentCard}>
                  <div className={styles.alimentRow}>
                    <div className={styles.alimentInfo}>
                      <div className={styles.alimentName}>{a.nom}</div>
                      <div className={styles.alimentMacros}>
                        {a.calories || 0} kcal/100g | P{a.proteines || 0}g | G{a.glucides || 0}g | L{a.lipides || 0}g
                      </div>
                    </div>
                    <div className={styles.alimentActions}>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditAliment(a)}>
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => handleDelete(a.id)} style={{ color: 'var(--danger)' }}>
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Ciqual results */}
        {source === 'ciqual' && (
          <>
            {query.length < 2 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 12 }}>
                Tapez au moins 2 caracteres pour rechercher dans Ciqual
              </div>
            ) : (() => {
              const results = searchCiqual(query)
              return results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  Aucun resultat Ciqual pour &quot;{query}&quot;
                </div>
              ) : (
                results.map((a, i) => (
                  <div key={`ciq-${i}`} className={styles.alimentCard}>
                    <div className={styles.alimentRow}>
                      <div className={styles.alimentInfo}>
                        <div className={styles.alimentName}>
                          {a.nom}
                          <span style={{ fontSize: 9, marginLeft: 6, padding: '1px 5px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>CIQUAL</span>
                        </div>
                        <div className={styles.alimentMacros}>
                          {Math.round(a.calories * 100)} kcal/100g | P{(a.proteines * 100).toFixed(1)}g | G{(a.glucides * 100).toFixed(1)}g | L{(a.lipides * 100).toFixed(1)}g
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )
            })()}
          </>
        )}

        {/* OFF results */}
        {source === 'off' && (
          <>
            {offLoading && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 12 }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />
                Recherche Open Food Facts...
              </div>
            )}
            {!offLoading && source === 'off' && query.length < 2 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 12 }}>
                Tapez au moins 2 caracteres pour rechercher
              </div>
            )}
            {!offLoading && offResults.map((a, i) => (
              <div key={`off-${i}`} className={styles.alimentCard}>
                <div className={styles.alimentRow}>
                  <div className={styles.alimentInfo}>
                    <div className={styles.alimentName}>
                      {a.nom}
                      <span className={styles.offBadge}>OFF</span>
                    </div>
                    <div className={styles.alimentMacros}>
                      {a.calories} kcal/100g | P{a.proteines}g | G{a.glucides}g | L{a.lipides}g
                    </div>
                  </div>
                  <div className={styles.alimentActions}>
                    <button className="btn btn-outline btn-sm" onClick={() => importOff(a)}>
                      <i className="fa-solid fa-download" /> Importer
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!offLoading && query.length >= 2 && offResults.length === 0 && source === 'off' && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 12 }}>Aucun resultat OFF</div>
            )}
          </>
        )}
      </div>

      {/* Add modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Ajouter un aliment">
        <form onSubmit={handleAddSubmit} style={{ padding: '0 20px 20px' }}>
          <div className="form-group">
            <label>Nom</label>
            <input type="text" name="nom" required placeholder="ex: Poulet grille" />
          </div>
          <div className={styles.formGrid}>
            <div className="form-group">
              <label>Calories/100g</label>
              <input type="number" name="calories" step="any" placeholder="kcal" />
            </div>
            <div className="form-group">
              <label>Proteines/100g</label>
              <input type="number" name="proteines" step="any" placeholder="g" />
            </div>
            <div className="form-group">
              <label>Glucides/100g</label>
              <input type="number" name="glucides" step="any" placeholder="g" />
            </div>
            <div className="form-group">
              <label>Lipides/100g</label>
              <input type="number" name="lipides" step="any" placeholder="g" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Annuler</button>
            <button type="submit" className="btn btn-red">Ajouter</button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editAliment} onClose={() => setEditAliment(null)} title="Modifier l'aliment">
        {editAliment && (
          <form onSubmit={handleEditSubmit} style={{ padding: '0 20px 20px' }}>
            <div className="form-group">
              <label>Nom</label>
              <input type="text" name="nom" defaultValue={editAliment.nom} required />
            </div>
            <div className={styles.formGrid}>
              <div className="form-group">
                <label>Calories/100g</label>
                <input type="number" name="calories" step="any" defaultValue={editAliment.calories} />
              </div>
              <div className="form-group">
                <label>Proteines/100g</label>
                <input type="number" name="proteines" step="any" defaultValue={editAliment.proteines} />
              </div>
              <div className="form-group">
                <label>Glucides/100g</label>
                <input type="number" name="glucides" step="any" defaultValue={editAliment.glucides} />
              </div>
              <div className="form-group">
                <label>Lipides/100g</label>
                <input type="number" name="lipides" step="any" defaultValue={editAliment.lipides} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-outline" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(editAliment.id)}>
                <i className="fa-solid fa-trash" /> Supprimer
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setEditAliment(null)}>Annuler</button>
              <button type="submit" className="btn btn-red">Enregistrer</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
