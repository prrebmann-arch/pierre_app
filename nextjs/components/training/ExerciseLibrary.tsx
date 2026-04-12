'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from '@/styles/training.module.css'

interface ExerciseDB {
  id: string
  nom: string
  muscle_principal: string | null
  categorie: string | null
}

interface ExerciseLibraryProps {
  onAdd: (id: string, nom: string, muscle: string) => void
}

export default function ExerciseLibrary({ onAdd }: ExerciseLibraryProps) {
  const [exercises, setExercises] = useState<ExerciseDB[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [loaded, setLoaded] = useState(false)
  const supabase = createClient()
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('exercices')
        .select('id, nom, muscle_principal, categorie')
        .order('nom')
        .limit(500)
      setExercises(data || [])
      setLoaded(true)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setDebouncedSearch(value), 200)
  }, [])

  const muscleGroups = [...new Set(exercises.map((e) => e.muscle_principal).filter(Boolean) as string[])].sort()

  const query = debouncedSearch.toLowerCase()
  const results = exercises
    .filter((ex) => {
      if (filter && ex.muscle_principal !== filter) return false
      if (query && !ex.nom.toLowerCase().includes(query) && !(ex.muscle_principal || '').toLowerCase().includes(query)) return false
      return true
    })
    .slice(0, 30)

  if (!loaded) {
    return (
      <div className={styles.trLibrary}>
        <div className={styles.trLibraryHeader}>
          <i className="fa-solid fa-book-open" style={{ color: 'var(--text3)' }} />
          <span className={styles.trLibraryTitle}>Bibliotheque d&apos;exercices</span>
        </div>
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>
          <i className="fa-solid fa-spinner fa-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.trLibrary}>
      <div className={styles.trLibraryHeader}>
        <i className="fa-solid fa-book-open" style={{ color: 'var(--text3)' }} />
        <span className={styles.trLibraryTitle}>Bibliotheque d&apos;exercices</span>
      </div>
      <div className={styles.trLibrarySearch}>
        <i className={`fa-solid fa-search ${styles.trLibrarySearchIcon}`} />
        <input
          type="text"
          placeholder="Rechercher un exercice..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>
      <div className={styles.trLibraryFilters}>
        <button
          className={`${styles.trLibraryFilter} ${filter === '' ? styles.trLibraryFilterActive : ''}`}
          onClick={() => setFilter('')}
        >
          Tous
        </button>
        {muscleGroups.map((m) => (
          <button
            key={m}
            className={`${styles.trLibraryFilter} ${filter === m ? styles.trLibraryFilterActive : ''}`}
            onClick={() => setFilter(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <div className={styles.trLibraryResults}>
        <div className={styles.trLibraryResultsTitle}>Resultats ({results.length})</div>
        {results.length > 0 ? (
          results.map((ex) => (
            <div
              key={ex.id}
              className={styles.trLibItem}
              onClick={() => onAdd(ex.id, ex.nom, ex.muscle_principal || '')}
            >
              <div className={styles.trLibIcon}>
                <i className="fa-solid fa-dumbbell" />
              </div>
              <div>
                <div className={styles.trLibName}>{ex.nom}</div>
                {ex.muscle_principal && <div className={styles.trLibMuscle}>{ex.muscle_principal}</div>}
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            <i className="fa-solid fa-search" style={{ display: 'block', fontSize: 20, marginBottom: 8, opacity: 0.3 }} />
            Aucun resultat
          </div>
        )}
      </div>
    </div>
  )
}
