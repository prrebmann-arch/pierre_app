// COACH/lib/bloodtest.ts

import { type BloodtestMarker, type ZoneBand, type ZoneConfig, type ZoneSeverity } from './bloodtestCatalog'

export type ClassifyContext = {
  sex?: 'M' | 'F'
  phase?: 'folliculaire' | 'ovulatoire' | 'luteale' | 'menopause'
}

export type ClassifyResult =
  | { ok: true; band: ZoneBand; zone_config: ZoneConfig }
  | { ok: false; error: 'missing_phase' | 'missing_sex' | 'no_zones_for_context' | 'value_outside_bands' }

export function classifyValue(marker: BloodtestMarker, value: number, ctx?: ClassifyContext): ClassifyResult {
  const config = resolveZoneConfig(marker, ctx)
  if (!config.ok) return config
  const band = config.zone.bands.find((b) => valueInBand(b, value))
  if (!band) return { ok: false, error: 'value_outside_bands' }
  return { ok: true, band, zone_config: config.zone }
}

function resolveZoneConfig(
  marker: BloodtestMarker,
  ctx?: ClassifyContext,
): { ok: true; zone: ZoneConfig } | { ok: false; error: 'missing_phase' | 'missing_sex' | 'no_zones_for_context' } {
  const z = marker.zones
  if ('direction' in z) return { ok: true, zone: z }
  const ss = z.sex_specific
  if (ctx?.sex === 'M' && ss.male) return { ok: true, zone: ss.male }
  if (ctx?.sex === 'F') {
    if (ss.female_by_phase) {
      if (!ctx.phase) return { ok: false, error: 'missing_phase' }
      const phaseZone = ss.female_by_phase[ctx.phase]
      if (!phaseZone) return { ok: false, error: 'no_zones_for_context' }
      return { ok: true, zone: phaseZone }
    }
    if (ss.female) return { ok: true, zone: ss.female }
  }
  return { ok: false, error: 'missing_sex' }
}

function valueInBand(b: ZoneBand, v: number): boolean {
  if (b.min !== undefined && v < b.min) return false
  if (b.max !== undefined && v >= b.max) return false
  return true
}

export function severityColor(severity: ZoneSeverity): string {
  switch (severity) {
    case 1: return '#22c55e'
    case 2: return '#eab308'
    case 3: return '#f97316'
    case 4: return '#ef4444'
  }
}

// Shared types used by API + UI

export type ExtractedMarker = {
  marker_key: string | null
  raw_label: string
  value: number | null
  unit: string | null
  lab_reference_range?: string
  ignored?: boolean
  notes?: string
}

export type ExtractedData = {
  markers: ExtractedMarker[]
  detected_dated_at?: string
}

export type AiMeta = {
  model: string
  input_tokens: number
  output_tokens: number
  duration_ms: number
  error?: string
}

export type BloodtestUploadRow = {
  id: string
  athlete_id: string
  uploaded_by: 'athlete' | 'coach'
  uploader_user_id: string
  file_path: string
  dated_at: string | null
  uploaded_at: string
  validated_at: string | null
  validated_by: string | null
  extracted_data: ExtractedData | null
  validated_data: ExtractedData | null
  ai_extraction_meta: AiMeta | null
  archived_at: string | null
  created_at: string
}
