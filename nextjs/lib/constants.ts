export const JOURS_SEMAINE = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
export const MS_PER_DAY = 86400000
export const MAX_VIDEOS_LOAD = 200
export const VIDEO_RETENTION_MONTHS = 3
export const DEFAULT_STEPS_GOAL = 10000
export const DEFAULT_WATER_GOAL = 2500
export const DEFAULT_NOTIF_TIME = '08:00'

export const PROG_PHASES = {
  seche:          { label: 'SECHE',          short: 'SECHE', color: '#c0392b' },
  reverse:        { label: 'REVERSE',        short: 'REV',   color: '#2471a3' },
  prise_de_masse: { label: 'PRISE DE MASSE', short: 'MASS',  color: '#1e8449' },
  mini_cut:       { label: 'MINI CUT',       short: 'MCUT',  color: '#e67e22' },
} as const

export type ProgPhaseKey = keyof typeof PROG_PHASES
