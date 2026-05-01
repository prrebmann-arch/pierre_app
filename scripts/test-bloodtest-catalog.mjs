// COACH/scripts/test-bloodtest-catalog.mjs
// Parity + integrity tests for the blood test marker catalog.
// Run: node --test scripts/test-bloodtest-catalog.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const COACH_PATH   = path.resolve('lib/bloodtestCatalog.ts')
const ATHLETE_PATH = path.resolve('../ATHLETE/src/utils/bloodtestCatalog.js')

/**
 * Parse the MARKERS array from a catalog source file.
 * Strategy: locate the array literal, strip TS annotations and comments,
 * normalise to valid JSON, then parse.
 */
async function extractMarkers(file) {
  const src = await readFile(file, 'utf8')

  // Find the start of `export const MARKERS` up to the closing `]`
  // We match the block by counting brackets.
  const startMatch = src.match(/export const MARKERS[^=]*=\s*\[/)
  if (!startMatch) throw new Error(`Could not find export const MARKERS in ${file}`)

  const startIdx = startMatch.index + startMatch[0].length - 1 // points at '['
  let depth = 0
  let endIdx = startIdx
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') {
      depth--
      if (depth === 0) { endIdx = i; break }
    }
  }

  let block = src.slice(startIdx, endIdx + 1)

  // Strip single-line comments (// ...)
  block = block.replace(/\/\/[^\n]*/g, '')

  // Strip TypeScript type annotations: `: TypeName` before `,` or `{` or `[` or `=` or end-of-line
  // Also strip `as const` and `BloodtestMarker[]` etc.
  block = block
    .replace(/:\s*BloodtestMarker\[\]/g, '')
    .replace(/\bas const\b/g, '')

  // Remove trailing commas before `]` or `}` (JSON doesn't allow them)
  block = block.replace(/,(\s*[\]\}])/g, '$1')

  // Quote unquoted object keys (identifiers before `:`)
  block = block.replace(/([\{,\[]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')

  // Replace single-quoted strings with double-quoted
  // Simple approach: replace 'x' → "x" (handles most cases in catalog data)
  block = block.replace(/'([^'\\]*)'/g, '"$1"')

  let markers
  try {
    markers = JSON.parse(block)
  } catch (e) {
    throw new Error(`JSON.parse failed for ${path.basename(file)}: ${e.message}\n\nBlock start:\n${block.slice(0, 500)}`)
  }
  return markers
}

test('catalog has 30+ markers, no duplicate keys', async () => {
  const markers = await extractMarkers(COACH_PATH)
  assert.ok(markers.length >= 30, `expected at least 30 markers, got ${markers.length}`)
  const keys = new Set(markers.map((m) => m.key))
  assert.equal(keys.size, markers.length, 'duplicate marker keys detected')
})

test('catalog ATHLETE matches COACH (keys + labels + presets)', async () => {
  const c = await extractMarkers(COACH_PATH)
  const a = await extractMarkers(ATHLETE_PATH)
  const cByKey = Object.fromEntries(c.map((m) => [m.key, m]))
  const aByKey = Object.fromEntries(a.map((m) => [m.key, m]))
  const cKeys = Object.keys(cByKey).sort()
  const aKeys = Object.keys(aByKey).sort()
  assert.deepEqual(aKeys, cKeys, 'key set differs between ATHLETE and COACH')
  for (const k of cKeys) {
    assert.equal(aByKey[k].label, cByKey[k].label, `label drift on ${k}`)
    assert.equal(aByKey[k].unit_canonical, cByKey[k].unit_canonical, `unit_canonical drift on ${k}`)
    assert.deepEqual(aByKey[k].presets, cByKey[k].presets, `presets drift on ${k}`)
  }
})

test('every marker has zones and non-empty presets', async () => {
  const c = await extractMarkers(COACH_PATH)
  for (const m of c) {
    assert.ok(m.zones, `${m.key} missing zones`)
    assert.ok(Array.isArray(m.presets) && m.presets.length > 0, `${m.key} has empty presets`)
  }
})

test('basic preset has at least 8 markers', async () => {
  const c = await extractMarkers(COACH_PATH)
  const basic = c.filter((m) => m.presets.includes('basic'))
  assert.ok(basic.length >= 8, `basic preset has ${basic.length}, expected >= 8`)
})
