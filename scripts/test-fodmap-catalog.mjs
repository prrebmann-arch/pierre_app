import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const COACH_PATH  = path.resolve('lib/fodmapCatalog.ts')
const ATHLETE_PATH = path.resolve('../ATHLETE/src/utils/fodmapCatalog.js')

async function extractArrays(file) {
  const src = await readFile(file, 'utf8')
  const grab = (name) => {
    const re = new RegExp(`export const ${name}[^=]*=\\s*(\\[[\\s\\S]*?\\n\\])`)
    const m = src.match(re)
    if (!m) throw new Error(`Could not find export const ${name} in ${file}`)
    const cleaned = m[1].replace(/\/\/[^\n]*/g, '').replace(/,(\s*[\]\}])/g, '$1')
    const json = cleaned.replace(/([\{,]\s*)(\w+)\s*:/g, '$1"$2":').replace(/'/g, '"')
    return JSON.parse(json)
  }
  return { GROUPS: grab('GROUPS'), FOODS: grab('FOODS'), PORTIONS: grab('PORTIONS') }
}

test('catalogue COACH a la bonne forme', async () => {
  const c = await extractArrays(COACH_PATH)
  assert.equal(c.GROUPS.length, 8, '8 groups attendus')
  assert.equal(c.FOODS.length, 24, '24 foods attendus (3 par groupe)')
  assert.equal(c.PORTIONS.length, 72, '72 portions attendues (3 par food)')
})

test('catalogue ATHLETE = catalogue COACH', async () => {
  const c = await extractArrays(COACH_PATH)
  const a = await extractArrays(ATHLETE_PATH)
  assert.deepEqual(a.GROUPS, c.GROUPS)
  assert.deepEqual(a.FOODS, c.FOODS)
  assert.deepEqual(a.PORTIONS, c.PORTIONS)
})

test('coherence interne : tous les food.group_key existent', async () => {
  const c = await extractArrays(COACH_PATH)
  const groupKeys = new Set(c.GROUPS.map((g) => g.key))
  for (const f of c.FOODS) assert.ok(groupKeys.has(f.group_key), `group_key inconnu: ${f.group_key}`)
})

test('coherence interne : toutes les portions.food_key existent', async () => {
  const c = await extractArrays(COACH_PATH)
  const foodKeys = new Set(c.FOODS.map((f) => f.key))
  for (const p of c.PORTIONS) assert.ok(foodKeys.has(p.food_key), `food_key inconnu: ${p.food_key}`)
})
