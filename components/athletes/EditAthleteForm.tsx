'use client'

import { useState, useEffect } from 'react'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/Modal'
import FormGroup from '@/components/ui/FormGroup'
import type { Athlete } from '@/lib/types'

interface EditAthleteFormProps {
  isOpen: boolean
  onClose: () => void
  athlete: Athlete | null
}

const OBJECTIF_OPTIONS = [
  { value: 'prise_de_masse', label: 'Prise de masse' },
  { value: 'perte_de_poids', label: 'Perte de poids' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'recomposition', label: 'Recomposition' },
  { value: 'performance', label: 'Performance' },
]

export default function EditAthleteForm({ isOpen, onClose, athlete }: EditAthleteFormProps) {
  const { refreshAthletes } = useAthleteContext()
  const { toast } = useToast()
  const supabase = createClient()

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [poids, setPoids] = useState('')
  const [poidsObj, setPoidsObj] = useState('')
  const [objectif, setObjectif] = useState('maintenance')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (athlete && isOpen) {
      setPrenom(athlete.prenom || '')
      setNom(athlete.nom || '')
      setEmail(athlete.email || '')
      setPoids(athlete.poids_actuel != null ? String(athlete.poids_actuel) : '')
      setPoidsObj(athlete.poids_objectif != null ? String(athlete.poids_objectif) : '')
      setObjectif(athlete.objectif || 'maintenance')
    }
  }, [athlete, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!athlete || submitting) return

    const trimPrenom = prenom.trim()
    const trimNom = nom.trim()
    const trimEmail = email.trim()

    if (!trimPrenom || !trimNom) {
      toast('Prenom et nom requis', 'error')
      return
    }
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
    if (!emailRegex.test(trimEmail)) {
      toast('Email invalide', 'error')
      return
    }

    setSubmitting(true)

    const updateData = {
      prenom: trimPrenom,
      nom: trimNom,
      email: trimEmail,
      poids_actuel: parseFloat(poids) || null,
      poids_objectif: parseFloat(poidsObj) || null,
      objectif,
    }

    const { error } = await supabase
      .from('athletes')
      .update(updateData)
      .eq('id', athlete.id)

    if (error) {
      toast(error.message, 'error')
      setSubmitting(false)
      return
    }

    toast('Informations mises a jour !', 'success')
    setSubmitting(false)
    onClose()
    await refreshAthletes()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modifier l'athlete">
      <form onSubmit={handleSubmit} style={{ padding: '0 20px 20px' }}>
        <div className="form-row">
          <FormGroup label="Prenom" htmlFor="edit-prenom">
            <input
              id="edit-prenom"
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Nom" htmlFor="edit-nom">
            <input
              id="edit-nom"
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
            />
          </FormGroup>
        </div>

        <FormGroup label="Email" htmlFor="edit-email">
          <input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormGroup>

        <div className="form-row">
          <FormGroup label="Poids actuel (kg)" htmlFor="edit-poids">
            <input
              id="edit-poids"
              type="number"
              step="0.1"
              value={poids}
              onChange={(e) => setPoids(e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Objectif poids (kg)" htmlFor="edit-poids-obj">
            <input
              id="edit-poids-obj"
              type="number"
              step="0.1"
              value={poidsObj}
              onChange={(e) => setPoidsObj(e.target.value)}
            />
          </FormGroup>
        </div>

        <FormGroup label="Objectif" htmlFor="edit-objectif">
          <select
            id="edit-objectif"
            value={objectif}
            onChange={(e) => setObjectif(e.target.value)}
          >
            {OBJECTIF_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormGroup>

        <button type="submit" className="btn btn-red" disabled={submitting} style={{ marginTop: 16 }}>
          {submitting ? (
            <>
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />
              Mise a jour...
            </>
          ) : (
            'Mettre a jour'
          )}
        </button>
      </form>
    </Modal>
  )
}
