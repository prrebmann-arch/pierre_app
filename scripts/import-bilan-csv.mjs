#!/usr/bin/env node
// Import un Google Sheets "Semainier de suivi" exporté en CSV vers daily_reports.
//
// Usage:
//   node scripts/import-bilan-csv.mjs --athlete-name "Anthony" --csv "/path/to/file.csv"
//   node scripts/import-bilan-csv.mjs --athlete-id <uuid> --csv "/path/file.csv" --apply
//
// Par défaut: dry-run (preview seulement). --apply pour vraiment INSERT/UPSERT.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ---------- Load .env.local ----------
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) throw new Error(`.env.local introuvable (${envPath})`)
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Erreur: SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant.')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ---------- CLI args ----------
function parseArgs() {
  const args = { apply: false }
  const av = process.argv.slice(2)
  for (let i = 0; i < av.length; i++) {
    const a = av[i]
    if (a === '--apply') args.apply = true
    else if (a === '--athlete-name') args.athleteName = av[++i]
    else if (a === '--athlete-id') args.athleteId = av[++i]
    else if (a === '--csv') args.csv = av[++i]
    else if (a === '--limit-rows') args.limitRows = parseInt(av[++i])
  }
  return args
}

// ---------- CSV parser (RFC 4180-ish, gère quotes & multiline) ----------
function parseCSV(text) {
  const rows = []
  let row = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') { inQuotes = false }
      else { cur += c }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(cur); cur = '' }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
      else cur += c
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row) }
  return rows
}

// ---------- Normalisation valeurs ----------
const FR_MONTHS = {
  'janv': 1, 'janvier': 1,
  'févr': 2, 'fevr': 2, 'février': 2, 'fevrier': 2,
  'mars': 3,
  'avr': 4, 'avril': 4,
  'mai': 5,
  'juin': 6,
  'juil': 7, 'juillet': 7,
  'août': 8, 'aout': 8,
  'sept': 9, 'septembre': 9,
  'oct': 10, 'octobre': 10,
  'nov': 11, 'novembre': 11,
  'déc': 12, 'dec': 12, 'décembre': 12, 'decembre': 12,
}
function parseFrenchDate(s) {
  if (!s) return null
  s = s.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, '-')
  // Formats observés: "16-févr-2026", "2-mars-2026"
  const m = s.match(/^(\d{1,2})-([a-zéèêûôîïëùà]+)-(\d{4})$/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const monthKey = m[2]
  const year = parseInt(m[3], 10)
  const month = FR_MONTHS[monthKey]
  if (!month) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

const NULL_TEXTS = new Set(['', '/', '-', 'non tracké', 'non trackée', 'non tracke', 'n/a', 'na'])
function cleanText(s) {
  if (s == null) return null
  const t = String(s).trim().replace(/\s+/g, ' ')
  if (NULL_TEXTS.has(t.toLowerCase())) return null
  return t
}
function parseNum(s) {
  const t = cleanText(s)
  if (!t) return null
  const n = parseFloat(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
function parseInt5(s) {
  const n = parseNum(s)
  if (n == null) return null
  return Math.max(0, Math.min(5, Math.round(n)))
}
// Le CSV note adhérence/énergie/plaisir/sommeil sur 5. Momentum stocke sur 10.
function parseScale5to10(s) {
  const v = parseInt5(s)
  return v == null ? null : v * 2
}
function parseSteps(s) {
  const n = parseNum(s)
  if (n == null) return null
  return Math.max(0, Math.round(n))
}
function parseSickSigns(s) {
  const t = cleanText(s)
  if (!t) return null
  const low = t.toLowerCase()
  if (low === 'aucun' || low === 'aucune' || low === 'non' || low === 'rien') return false
  return true
}
function parseCardioMinutes(s) {
  const t = cleanText(s)
  if (!t) return null
  const m = t.match(/(\d+)\s*min/i)
  if (m) return parseInt(m[1], 10)
  return null
}
function parseTime(s) {
  const t = cleanText(s)
  if (!t) return null
  // Rejette les multi-valeurs ("23h / 00h")
  if (t.includes('/')) return null
  // Formats: "23:00", "23h00", "7h45", "23h", "23H45", "00:30"
  const m = t.match(/^(\d{1,2})\s*[h:H]\s*(\d{0,2})$/)
  if (!m) return null
  const hh = parseInt(m[1], 10)
  const mm = m[2] ? parseInt(m[2], 10) : 0
  if (hh > 23 || mm > 59) return null
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

// ---------- Détection des blocs hebdo ----------
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

function isDateUpdateRow(row) {
  return row.some(c => /DATE DE L['’]UPDATE/i.test(c || ''))
}
function getDateFromUpdateRow(row) {
  for (const c of row) {
    const dt = parseFrenchDate(c)
    if (dt) return dt
  }
  return null
}
function getDayName(row) {
  // Le jour est en colonne 2 (index)
  const c = (row[2] || '').toLowerCase().trim()
  // "Lundi bilan" → "lundi", "Lundi" → "lundi"
  for (const d of DAYS) if (c.startsWith(d)) return d
  return null
}

// ---------- Extraction d'une ligne jour → daily_reports row ----------
// Indices colonnes (0-based) selon entêtes observées:
//   2: jour, 3: poids, 4: adhérence, 5: séance, 6: performance,
//   7: plaisir, 8: cardio machine, 9: pas/NEAT,
//   10: courbatures, 11: stress, 12: énergie, 13: signes maladie,
//   14: coucher, 15: réveil, 16: efficacité sommeil, 17: qualité sommeil,
//   18: positif (lundi), 21: négatif (lundi), 24: sommaire (lundi)
function extractDayRow(row, isoDate, weekContext) {
  const sessionsExec = cleanText(row[5])
  const cardio = cleanText(row[8])
  // Compose sessions_executed avec cardio en suffix si présent
  let sessions = sessionsExec
  if (cardio && cardio !== sessionsExec) {
    sessions = sessions ? `${sessions} | Cardio: ${cardio}` : `Cardio: ${cardio}`
  }

  const out = {
    date: isoDate,
    weight: parseNum(row[3]),
    adherence: parseScale5to10(row[4]),
    sessions_executed: sessions,
    session_performance: cleanText(row[6]),
    session_enjoyment: parseScale5to10(row[7]),
    steps: parseSteps(row[9]),
    soreness: parseScale5to10(row[10]),
    stress: parseScale5to10(row[11]),
    energy: parseScale5to10(row[12]),
    sick_signs: parseSickSigns(row[13]),
    cardio_minutes: parseCardioMinutes(row[8]),
    bedtime: parseTime(row[14]),
    wakeup: parseTime(row[15]),
    sleep_quality: parseScale5to10(row[17]),
  }
  // Auto-feedback hebdo : seulement sur le lundi
  if (weekContext.dayName === 'lundi') {
    const positive = cleanText(row[18])
    const negative = cleanText(row[21])
    const summary = cleanText(row[24])
    if (positive) out.positive_week = positive
    if (negative) out.negative_week = negative
    if (summary) out.general_notes = summary
  }
  return out
}

function isAllNull(rec) {
  const skip = new Set(['date'])
  for (const [k, v] of Object.entries(rec)) {
    if (skip.has(k)) continue
    if (v != null && v !== '') return false
  }
  return true
}

// ---------- Pipeline principal ----------
async function findAthlete({ athleteName, athleteId }) {
  if (athleteId) {
    const { data, error } = await supabase
      .from('athletes')
      .select('id, user_id, prenom, nom')
      .eq('id', athleteId)
      .single()
    if (error) throw new Error(`Athlète ${athleteId} introuvable: ${error.message}`)
    return data
  }
  if (!athleteName) throw new Error('Préciser --athlete-name ou --athlete-id')
  const { data, error } = await supabase
    .from('athletes')
    .select('id, user_id, prenom, nom')
    .or(`prenom.ilike.%${athleteName}%,nom.ilike.%${athleteName}%`)
    .limit(10)
  if (error) throw new Error(`Recherche athlète: ${error.message}`)
  if (!data?.length) throw new Error(`Aucun athlète trouvé pour "${athleteName}"`)
  if (data.length > 1) {
    console.error('Plusieurs athlètes trouvés, préciser --athlete-id parmi:')
    for (const a of data) console.error(`  ${a.id}  ${a.prenom} ${a.nom}`)
    process.exit(1)
  }
  return data[0]
}

function extractAllRows(csvRows) {
  const out = []
  let mondayIso = null
  for (let i = 0; i < csvRows.length; i++) {
    const row = csvRows[i]
    if (isDateUpdateRow(row)) {
      mondayIso = getDateFromUpdateRow(row)
      continue
    }
    if (!mondayIso) continue
    const dayName = getDayName(row)
    if (!dayName) continue
    const offset = DAYS.indexOf(dayName)
    const isoDate = addDays(mondayIso, offset)
    const rec = extractDayRow(row, isoDate, { dayName })
    if (isAllNull(rec)) continue
    out.push(rec)
  }
  return out
}

async function main() {
  const args = parseArgs()
  if (!args.csv) {
    console.error('Usage: --csv "/path/file.csv" --athlete-name "Anthony" [--apply]')
    process.exit(1)
  }
  const csvPath = path.resolve(args.csv)
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV introuvable: ${csvPath}`)
    process.exit(1)
  }

  const athlete = await findAthlete(args)
  console.log(`\n→ Athlète: ${athlete.prenom} ${athlete.nom}  (athletes.id=${athlete.id}, user_id=${athlete.user_id})`)

  const text = fs.readFileSync(csvPath, 'utf8')
  const csvRows = parseCSV(text)
  console.log(`→ CSV: ${csvRows.length} lignes brutes`)

  let records = extractAllRows(csvRows)
  if (args.limitRows) records = records.slice(0, args.limitRows)
  console.log(`→ Bilans extraits: ${records.length}`)

  if (records.length === 0) {
    console.log('Rien à importer.')
    return
  }

  // Preview
  console.log('\n--- Preview (5 premiers + 2 derniers) ---')
  const preview = [...records.slice(0, 5), ...records.slice(-2)]
  for (const r of preview) {
    const sleepQ = r.sleep_quality
    const w = r.weight
    const sess = (r.sessions_executed || '').slice(0, 50)
    const pos = r.positive_week ? ' [+POS]' : ''
    const neg = r.negative_week ? ' [+NEG]' : ''
    const sum = r.general_notes ? ' [+SUM]' : ''
    console.log(`  ${r.date}  poids=${w ?? '—'}  adh=${r.adherence ?? '—'}  sleep=${sleepQ ?? '—'}  steps=${r.steps ?? '—'}  séance="${sess}"${pos}${neg}${sum}`)
  }

  // Range
  const dates = records.map(r => r.date).sort()
  console.log(`\n→ Plage: ${dates[0]} → ${dates[dates.length - 1]}`)

  if (!args.apply) {
    console.log('\n[DRY-RUN] Aucune écriture en DB. Relancer avec --apply pour insérer.')
    return
  }

  // Inject user_id et upsert
  const payload = records.map(r => ({ user_id: athlete.user_id, ...r }))

  console.log('\n→ Upsert via service role...')
  // Upsert sur (user_id, date) — doit avoir un index unique côté DB.
  // Si pas d'unique, on fait DELETE + INSERT pour la plage couverte.
  const fromDate = dates[0]
  const toDate = dates[dates.length - 1]

  // Stratégie sécuritaire: vérifier les doublons existants
  const { data: existing, error: exErr } = await supabase
    .from('daily_reports')
    .select('id, date')
    .eq('user_id', athlete.user_id)
    .gte('date', fromDate)
    .lte('date', toDate)
  if (exErr) throw exErr
  if (existing && existing.length > 0) {
    const dupDates = new Set(existing.map(e => e.date))
    const toUpdate = payload.filter(p => dupDates.has(p.date))
    const toInsert = payload.filter(p => !dupDates.has(p.date))
    console.log(`  ${existing.length} bilan(s) déjà en DB sur cette plage. INSERT ${toInsert.length}, SKIP ${toUpdate.length} doublons (utilise --force pour overwrite).`)
    if (toInsert.length === 0) {
      console.log('  Rien à insérer (tous les jours existent déjà).')
      return
    }
    const { data, error } = await supabase.from('daily_reports').insert(toInsert).select('id, date')
    if (error) {
      console.error('Insert error:', error)
      process.exit(1)
    }
    console.log(`✓ Inséré ${data.length} bilans.`)
  } else {
    const { data, error } = await supabase.from('daily_reports').insert(payload).select('id, date')
    if (error) {
      console.error('Insert error:', error)
      process.exit(1)
    }
    console.log(`✓ Inséré ${data.length} bilans.`)
  }
}

main().catch(err => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
