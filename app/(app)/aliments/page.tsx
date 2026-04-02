'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
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

type Source = 'local' | 'off' | 'both'

export default function AlimentsPage() {
  const supabase = createClient()
  const { user } = useAuth()
  const { toast } = useToast()

  const [aliments, setAliments] = useState<Aliment[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<Source>('local')

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
      .select('*')
      .order('nom', { ascending: true })
    if (error) { toast('Erreur chargement aliments', 'error'); return }
    setAliments((data || []) as Aliment[])
    setLoading(false)
  }, [supabase, toast])

  useEffect(() => { loadAliments() }, [loadAliments])

  // OFF debounced search
  useEffect(() => {
    if ((source === 'off' || source === 'both') && query.length >= 2) {
      if (offTimerRef.current) clearTimeout(offTimerRef.current)
      setOffLoading(true)
      offTimerRef.current = setTimeout(async () => {
        try {
          const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=20&fields=product_name,nutriments,brands&lc=fr&cc=fr`
          const resp = await fetch(url)
          const data = await resp.json()
          const results: OffAliment[] = (data.products || [])
            .filter((p: any) => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
            .map((p: any) => ({
              nom: p.product_name + (p.brands ? ` — ${p.brands}` : ''),
              calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
              proteines: Math.round(p.nutriments['proteins_100g'] || 0),
              glucides: Math.round(p.nutriments['carbohydrates_100g'] || 0),
              lipides: Math.round(p.nutriments['fat_100g'] || 0),
            }))
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
            {(['local', 'off', 'both'] as Source[]).map((s) => (
              <button
                key={s}
                className={`${styles.srcBtn} ${source === s ? styles.srcBtnActive : ''}`}
                onClick={() => setSource(s)}
              >
                {s === 'local' ? 'Ma base' : s === 'off' ? 'Open Food Facts' : 'Les deux'}
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
        {/* Local results */}
        {(source === 'local' || source === 'both') && (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                <i className="fa-solid fa-spinner fa-spin" />
              </div>
            ) : filteredLocal.length === 0 && source === 'local' ? (
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

        {/* OFF divider */}
        {source === 'both' && offResults.length > 0 && (
          <div className={styles.offDivider}>-- Open Food Facts --</div>
        )}

        {/* OFF results */}
        {(source === 'off' || source === 'both') && (
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
