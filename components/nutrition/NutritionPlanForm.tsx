'use client'

import { useState } from 'react'
import styles from '@/styles/nutrition.module.css'

interface NutritionPlanFormProps {
  /** Initial values for editing */
  initialValues?: {
    name: string
    calories: number
    proteines: number
    glucides: number
    lipides: number
  }
  /** Called when form is submitted */
  onSubmit: (values: {
    name: string
    calories: number
    proteines: number
    glucides: number
    lipides: number
  }) => void
  /** Called on cancel */
  onCancel: () => void
  /** Button label */
  submitLabel?: string
}

export default function NutritionPlanForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Creer le plan',
}: NutritionPlanFormProps) {
  const [name, setName] = useState(initialValues?.name || '')
  const [calories, setCalories] = useState(initialValues?.calories || 0)
  const [proteines, setProteines] = useState(initialValues?.proteines || 0)
  const [glucides, setGlucides] = useState(initialValues?.glucides || 0)
  const [lipides, setLipides] = useState(initialValues?.lipides || 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ name, calories, proteines, glucides, lipides })
  }

  // Auto-calculate calories from macros
  const calculatedCal = proteines * 4 + glucides * 4 + lipides * 9

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Nom du plan</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="ex: Seche S1" />
      </div>

      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div className="form-group">
          <label>Calories objectif</label>
          <input type="number" value={calories || ''} onChange={(e) => setCalories(parseInt(e.target.value) || 0)} step="1" />
        </div>
        <div className="form-group">
          <label>Proteines (g)</label>
          <input type="number" value={proteines || ''} onChange={(e) => setProteines(parseFloat(e.target.value) || 0)} step="0.1" />
        </div>
        <div className="form-group">
          <label>Glucides (g)</label>
          <input type="number" value={glucides || ''} onChange={(e) => setGlucides(parseFloat(e.target.value) || 0)} step="0.1" />
        </div>
        <div className="form-group">
          <label>Lipides (g)</label>
          <input type="number" value={lipides || ''} onChange={(e) => setLipides(parseFloat(e.target.value) || 0)} step="0.1" />
        </div>
      </div>

      {proteines > 0 || glucides > 0 || lipides > 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
          Calcul macros: {calculatedCal} kcal (P{proteines}*4 + G{glucides}*4 + L{lipides}*9)
        </div>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-red">{submitLabel}</button>
      </div>
    </form>
  )
}
