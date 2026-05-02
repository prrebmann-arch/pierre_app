// COACH/scripts/test-bloodtest-split-markers.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Inline copy of splitMarkers (the test runs in pure node:test, no TS).
// Keep this in sync with lib/bloodtest.ts. Parity is verified manually.
function splitMarkers(markers, tracked) {
  const trackedSet = new Set(tracked)
  const byKey = new Map()
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
  const extras = []
  for (const [key, ms] of byKey) {
    if (!trackedSet.has(key)) extras.push(...ms)
  }
  const unidentified = markers.filter((m) => !m.marker_key)
  return { expected, extras, unidentified }
}

test('splits expected/extras/unidentified correctly', () => {
  const markers = [
    { marker_key: 'ferritine', raw_label: 'Ferritine', value: 45, unit: 'µg/L' },
    { marker_key: 'vitamine_d', raw_label: 'Vit D', value: 28, unit: 'ng/mL' },
    { marker_key: 'b12', raw_label: 'B12', value: 420, unit: 'pg/mL' },
    { marker_key: null, raw_label: 'Truc bizarre', value: 1, unit: 'x' },
  ]
  const tracked = ['ferritine', 'vitamine_d', 'testosterone']
  const r = splitMarkers(markers, tracked)
  assert.equal(r.expected.length, 3)
  assert.equal(r.expected[0].tracked_key, 'ferritine')
  assert.equal(r.expected[0].marker?.value, 45)
  assert.equal(r.expected[2].tracked_key, 'testosterone')
  assert.equal(r.expected[2].marker, undefined, 'testosterone non trouvé dans le PDF')
  assert.equal(r.extras.length, 1)
  assert.equal(r.extras[0].marker_key, 'b12')
  assert.equal(r.unidentified.length, 1)
  assert.equal(r.unidentified[0].raw_label, 'Truc bizarre')
})

test('legacy markers without marker_key all go to unidentified', () => {
  const markers = [
    { marker_key: null, raw_label: 'Ferritine', value: 45 },
    { marker_key: null, raw_label: 'Vit D', value: 28 },
  ]
  const r = splitMarkers(markers, ['ferritine'])
  assert.equal(r.unidentified.length, 2)
  assert.equal(r.expected[0].marker, undefined)
})

test('duplicate marker_key only first wins in expected', () => {
  const markers = [
    { marker_key: 'ferritine', raw_label: 'Ferritine 1', value: 45 },
    { marker_key: 'ferritine', raw_label: 'Ferritine 2', value: 50 },
  ]
  const r = splitMarkers(markers, ['ferritine'])
  assert.equal(r.expected[0].marker?.value, 45)
})

test('empty tracked → all matched markers become extras', () => {
  const markers = [
    { marker_key: 'ferritine', value: 45 },
    { marker_key: null, value: null },
  ]
  const r = splitMarkers(markers, [])
  assert.equal(r.expected.length, 0)
  assert.equal(r.extras.length, 1)
  assert.equal(r.unidentified.length, 1)
})
