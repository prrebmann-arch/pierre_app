export interface CoachProfile {
  id: string
  user_id: string
  email: string
  display_name: string
  plan: 'athlete' | 'business' | 'free'
  trial_ends_at: string | null
  has_payment_method: boolean
  stripe_account_id?: string
  stripe_secret_key_encrypted?: string
  stripe_publishable_key?: string
  stripe_webhook_secret_encrypted?: string
  stripe_onboarding_complete?: boolean
  stripe_charges_enabled?: boolean
  allow_prorata?: boolean
  currency?: string
}

export interface PlatformInvoice {
  id: string
  coach_id: string
  month: number
  year: number
  athlete_count: number
  total_amount: number
  status: string
  created_at: string
}

export interface Athlete {
  id: string
  user_id: string | null
  coach_id: string
  prenom: string
  nom: string
  email: string
  avatar_url?: string
  date_naissance?: string | null
  genre?: string | null
  telephone?: string | null
  objectif?: string | null
  poids_actuel?: number | null
  poids_objectif?: number | null
  bilan_frequency?: string
  bilan_interval?: number
  bilan_day?: number | number[]
  bilan_anchor_date?: string
  bilan_month_day?: number
  bilan_notif_time?: string
  complete_bilan_frequency?: string
  complete_bilan_interval?: number
  complete_bilan_day?: number | number[]
  complete_bilan_anchor_date?: string
  complete_bilan_month_day?: number
  complete_bilan_notif_time?: string
  access_mode?: string | null
  pas_journalier?: number | null
  water_goal_ml?: number | null
  blessures?: string | null
  allergies?: string | null
  medicaments?: string | null
  notes_sante?: string | null
  onboarding_workflow_id?: string | null
  created_at: string
  /** Transient: attached from roadmap_phases query */
  _phase?: { athlete_id: string; phase: string; name: string } | null
}

export interface User {
  id: string
  email: string
}
