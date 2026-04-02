'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import styles from '@/styles/nutrition.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Aliment {
  id?: string
  nom: string
  calories: number
  proteines: number
  glucides: number
  lipides: number
  coach_id?: string
  source?: 'local' | 'openfoodfacts'
}

interface FoodSearchProps {
  /** Called when user clicks an aliment to add it */
  onSelect: (aliment: Aliment) => void
  /** Refresh trigger — increment to reload local DB */
  refreshKey?: number
}

type Source = 'local' | 'off' | 'both'

export default function FoodSearch({ onSelect, refreshKey }: FoodSearchProps) {
  const supabase = createClient()
  const { user } = useAuth()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [source, setSource] = useState<Source>('both')
  const [localAliments, setLocalAliments] = useState<Aliment[]>([])
  const [offResults, setOffResults] = useState<Aliment[]>([])
  const [offLoading, setOffLoading] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const offTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load local aliments
  const loadLocal = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('aliments_db')
      .select('*')
      .order('nom', { ascending: true })
    setLocalAliments((data || []).map((a: any) => ({ ...a, source: 'local' as const })))
  }, [user, supabase])

  useEffect(() => { loadLocal() }, [loadLocal, refreshKey])

  // OFF search with debounce
  useEffect(() => {
    if ((source === 'off' || source === 'both') && query.length >= 2) {
      if (offTimerRef.current) clearTimeout(offTimerRef.current)
      setOffLoading(true)
      offTimerRef.current = setTimeout(async () => {
        try {
          const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=20&fields=product_name,nutriments,brands&lc=fr&cc=fr`
          const resp = await fetch(url)
          const data = await resp.json()
          const results: Aliment[] = (data.products || [])
            .filter((p: any) => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
            .map((p: any) => ({
              nom: p.product_name + (p.brands ? ` — ${p.brands}` : ''),
              calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
              proteines: Math.round(p.nutriments['proteins_100g'] || 0),
              glucides: Math.round(p.nutriments['carbohydrates_100g'] || 0),
              lipides: Math.round(p.nutriments['fat_100g'] || 0),
              source: 'openfoodfacts' as const,
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

  // Filter local results
  const q = query.toLowerCase()
  const maxLocal = source === 'both' ? 20 : 40
  const filteredLocal = q
    ? localAliments.filter((a) => a.nom.toLowerCase().includes(q)).slice(0, maxLocal)
    : localAliments.slice(0, maxLocal)

  // Quick add aliment
  async function handleQuickAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const nom = (fd.get('nom') as string)?.trim()
    if (!nom) { toast('Nom obligatoire', 'error'); return }
    const calories = parseFloat(fd.get('calories') as string) || 0
    const proteines = parseFloat(fd.get('proteines') as string) || 0
    const glucides = parseFloat(fd.get('glucides') as string) || 0
    const lipides = parseFloat(fd.get('lipides') as string) || 0

    const { error } = await supabase.from('aliments_db').insert({
      nom, calories, proteines, glucides, lipides, coach_id: user!.id,
    })
    if (error) { toast('Erreur: ' + error.message, 'error'); return }
    toast('Aliment ajoute !', 'success')
    setShowQuickAdd(false)
    loadLocal()
  }

  // Import OFF aliment to local DB
  async function importOff(a: Aliment) {
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
    loadLocal()
  }

  return (
    <div className={styles.foodLibrary}>
      <div className={styles.foodLibraryHeader}>
        <i className="fa-solid fa-apple-whole" style={{ color: 'var(--text3)' }} />
        <span className={styles.foodLibraryTitle}>Bibliotheque d&apos;aliments</span>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setShowQuickAdd(!showQuickAdd)}
          title="Ajouter un aliment"
          style={{ marginLeft: 'auto', padding: '4px 8px' }}
        >
          <i className="fa-solid fa-plus" />
        </button>
      </div>

      {/* Source toggle */}
      <div className={styles.sourceToggle}>
        {(['local', 'off', 'both'] as Source[]).map((s) => (
          <button
            key={s}
            className={`${styles.srcBtn} ${source === s ? styles.srcBtnActive : ''}`}
            onClick={() => setSource(s)}
          >
            <i className={`fa-solid ${s === 'local' ? 'fa-database' : s === 'off' ? 'fa-globe' : 'fa-layer-group'}`} style={{ marginRight: 4 }} />
            {s === 'local' ? 'Ma base' : s === 'off' ? 'OFF' : 'Les deux'}
          </button>
        ))}
      </div>

      {/* Quick add form */}
      {showQuickAdd && (
        <form onSubmit={handleQuickAdd} className={styles.quickAdd}>
          <input name="nom" placeholder="Nom de l'aliment" className={styles.qaInput} required />
          <div className={styles.qaRow}>
            <input name="calories" type="number" placeholder="kcal" className={`${styles.qaInput} ${styles.qaSm}`} step="any" />
            <input name="proteines" type="number" placeholder="P (g)" className={`${styles.qaInput} ${styles.qaSm}`} step="any" />
            <input name="glucides" type="number" placeholder="G (g)" className={`${styles.qaInput} ${styles.qaSm}`} step="any" />
            <input name="lipides" type="number" placeholder="L (g)" className={`${styles.qaInput} ${styles.qaSm}`} step="any" />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" className="btn btn-red btn-sm" style={{ flex: 1 }}>
              <i className="fa-solid fa-plus" /> Ajouter
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowQuickAdd(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Search input */}
      <div className={styles.foodLibrarySearch}>
        <i className="fa-solid fa-magnifying-glass" />
        <input
          type="text"
          placeholder="Rechercher un aliment..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Results */}
      <div className={styles.foodLibraryResults}>
        {/* Local */}
        {(source === 'local' || source === 'both') && (
          <>
            {source === 'both' && filteredLocal.length > 0 && (
              <div className={styles.foodLibraryResultsTitle}>Ma base ({filteredLocal.length})</div>
            )}
            {filteredLocal.map((a, i) => (
              <div key={a.id || `local-${i}`} className={styles.libItem} onClick={() => onSelect(a)}>
                <div className={styles.libIcon}>
                  <i className="fa-solid fa-apple-whole" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.libName}>
                    {a.nom}
                    {source === 'both' && <span className={styles.srcBadgeLocal} style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>Local</span>}
                  </div>
                  <div className={styles.libMacros}>
                    {a.calories} kcal / P{a.proteines}g G{a.glucides}g L{a.lipides}g
                  </div>
                </div>
              </div>
            ))}
            {q && filteredLocal.length === 0 && source === 'local' && (
              <div style={{ padding: 12, textAlign: 'center', color: 'var(--text3)', fontSize: 11 }}>Aucun resultat</div>
            )}
          </>
        )}

        {/* OFF */}
        {(source === 'off' || source === 'both') && (
          <>
            {source === 'both' && offResults.length > 0 && (
              <div style={{ margin: '12px 0', textAlign: 'center', fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
                -- Open Food Facts --
              </div>
            )}
            {offLoading && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />
                Recherche Open Food Facts...
              </div>
            )}
            {!offLoading && offResults.map((a, i) => (
              <div key={`off-${i}`} className={styles.libItem} onClick={() => { onSelect(a); importOff(a) }}>
                <div className={styles.libIcon} style={{ background: 'rgba(52,152,219,0.12)', color: '#3498db' }}>
                  <i className="fa-solid fa-globe" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.libName}>
                    {a.nom}
                    <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700, background: 'rgba(52,152,219,0.15)', color: '#3498db' }}>OFF</span>
                  </div>
                  <div className={styles.libMacros}>
                    {a.calories} kcal / P{a.proteines}g G{a.glucides}g L{a.lipides}g
                  </div>
                </div>
              </div>
            ))}
            {!offLoading && source === 'off' && q.length < 2 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                Tapez au moins 2 caracteres
              </div>
            )}
            {!offLoading && q.length >= 2 && offResults.length === 0 && (source === 'off') && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Aucun resultat OFF</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
