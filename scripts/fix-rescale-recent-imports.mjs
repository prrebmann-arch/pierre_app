#!/usr/bin/env node
// Multiplie par 2 les ratings (sur 5 → sur 10) des bilans daily_reports récemment
// importés via import-bilan-csv.mjs. Cible UNIQUEMENT les rows créées dans la
// fenêtre temporelle donnée pour ne pas toucher les bilans saisis manuellement
// par l'athlète.
//
// Usage:
//   node scripts/fix-rescale-recent-imports.mjs --athlete-name "Anthony" --since-minutes 60
//   node scripts/fix-rescale-recent-imports.mjs --athlete-id <uuid> --since-minutes 60 --apply

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function parseArgs() {
  const args = { apply: false, sinceMinutes: 60 }
  const av = process.argv.slice(2)
  for (let i = 0; i < av.length; i++) {
    const a = av[i]
    if (a === '--apply') args.apply = true
    else if (a === '--athlete-name') args.athleteName = av[++i]
    else if (a === '--athlete-id') args.athleteId = av[++i]
    else if (a === '--since-minutes') args.sinceMinutes = parseInt(av[++i])
  }
  return args
}

async function findAthlete({ athleteName, athleteId }) {
  if (athleteId) {
    const { data, error } = await supabase.from('athletes').select('id, user_id, prenom, nom').eq('id', athleteId).single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('athletes').select('id, user_id, prenom, nom')
    .or(`prenom.ilike.%${athleteName}%,nom.ilike.%${athleteName}%`).limit(10)
  if (error) throw error
  if (!data?.length) throw new Error(`Aucun athlète "${athleteName}"`)
  if (data.length > 1) {
    console.error('Plusieurs athlètes:'); for (const a of data) console.error(`  ${a.id}  ${a.prenom} ${a.nom}`); process.exit(1)
  }
  return data[0]
}

const SCALE_COLS = ['adherence', 'energy', 'session_enjoyment', 'sleep_quality', 'stress', 'soreness']

async function main() {
  const args = parseArgs()
  const athlete = await findAthlete(args)
  console.log(`→ Athlète: ${athlete.prenom} ${athlete.nom} (user_id=${athlete.user_id})`)

  const sinceIso = new Date(Date.now() - args.sinceMinutes * 60 * 1000).toISOString()
  console.log(`→ Cible: rows créées depuis ${sinceIso} (${args.sinceMinutes}min)`)

  const { data: rows, error } = await supabase
    .from('daily_reports')
    .select(`id, date, created_at, ${SCALE_COLS.join(', ')}`)
    .eq('user_id', athlete.user_id)
    .gte('created_at', sinceIso)
    .order('date', { ascending: true })
  if (error) throw error

  console.log(`→ ${rows.length} bilans candidats`)
  if (rows.length === 0) return

  // Filtrer les rows déjà sur 10 (au moins une valeur > 5 = déjà rescaled)
  const toFix = []
  const skipped = []
  for (const r of rows) {
    const max = Math.max(...SCALE_COLS.map(c => r[c] ?? 0))
    if (max > 5) skipped.push(r) // déjà sur 10
    else toFix.push(r)
  }
  console.log(`  → À multiplier ×2: ${toFix.length}`)
  console.log(`  → Skip (déjà sur 10 ou null): ${skipped.length}`)

  if (toFix.length === 0) {
    console.log('Rien à corriger.')
    return
  }

  console.log('\n--- Preview (3 premiers + 2 derniers) ---')
  for (const r of [...toFix.slice(0, 3), ...toFix.slice(-2)]) {
    const before = SCALE_COLS.map(c => `${c[0]}=${r[c] ?? '—'}`).join(' ')
    const after = SCALE_COLS.map(c => `${c[0]}=${r[c] == null ? '—' : r[c] * 2}`).join(' ')
    console.log(`  ${r.date}  AVANT [${before}]  →  APRÈS [${after}]`)
  }

  if (!args.apply) {
    console.log('\n[DRY-RUN] --apply pour exécuter.')
    return
  }

  console.log('\n→ UPDATE en cours...')
  let ok = 0, err = 0
  for (const r of toFix) {
    const patch = {}
    for (const c of SCALE_COLS) if (r[c] != null) patch[c] = r[c] * 2
    const { error: upErr } = await supabase.from('daily_reports').update(patch).eq('id', r.id)
    if (upErr) { console.error(`  ✗ ${r.date}: ${upErr.message}`); err++ }
    else { ok++ }
  }
  console.log(`✓ ${ok} bilans corrigés. ${err} erreurs.`)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
