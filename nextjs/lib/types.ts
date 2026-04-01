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
  complete_bilan_frequency?: string
  complete_bilan_interval?: number
  complete_bilan_day?: number | number[]
  complete_bilan_anchor_date?: string
  complete_bilan_month_day?: number
  created_at: string
}

export interface User {
  id: string
  email: string
}
