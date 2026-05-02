// COACH/lib/bloodtest.ts

import { type BloodtestMarker, type SexSpecificZones, type ZoneBand, type ZoneConfig, type ZoneSeverity } from './bloodtestCatalog'

// Coach-level zone overrides format (stored in coach_profiles.bloodtest_zone_overrides JSONB).
// Maps catalog marker_key → either a flat ZoneConfig, or sex-specific zones.
export type ZoneOverride = ZoneConfig | { sex_specific: SexSpecificZones }
export type ZoneOverrides = Record<string, ZoneOverride>

/**
 * Returns a marker with effective zones (override applied if present).
 * For custom markers (coach_custom_markers), pass the marker as-is — its zones
 * are already coach-edited and shouldn't be overridden by this map.
 */
export function applyZoneOverride(marker: BloodtestMarker, overrides?: ZoneOverrides | null): BloodtestMarker {
  if (!overrides) return marker
  const ov = overrides[marker.key]
  if (!ov) return marker
  return { ...marker, zones: ov as BloodtestMarker['zones'] }
}

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
  // IA mapping (alimenté par /api/bloodtest/extract, optionnel pour rétro-compat)
  value_canonical?: number | null
  unit_canonical?: string | null
  matched_by_ai?: boolean
  confirmed_by_coach?: boolean
  // True si la valeur source était de la forme "<X" ou ">X" (sous/au-dessus du seuil de détection).
  // value contient alors X (ex: "<0.2 mUI/ml" → value=0.2, below_detection=true).
  below_detection?: boolean
  above_detection?: boolean
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

export type SplitMarkersResult = {
  expected: { tracked_key: string; marker?: ExtractedMarker }[]
  extras: ExtractedMarker[]
  unidentified: ExtractedMarker[]
}

export function splitMarkers(markers: ExtractedMarker[], tracked: string[]): SplitMarkersResult {
  const trackedSet = new Set(tracked)
  const byKey = new Map<string, ExtractedMarker[]>()
  for (const m of markers) {
    if (m.marker_key) {
      const arr = byKey.get(m.marker_key) || []
      arr.push(m)
      byKey.set(m.marker_key, arr)
    }
  }
  const expected = tracked.map((key) => {
    const matches = byKey.get(key) || []
    return { tracked_key: key, marker: matches[0] }
  })
  const extras: ExtractedMarker[] = []
  for (const [key, ms] of byKey) {
    if (!trackedSet.has(key)) extras.push(...ms)
  }
  const unidentified = markers.filter((m) => !m.marker_key)
  return { expected, extras, unidentified }
}
