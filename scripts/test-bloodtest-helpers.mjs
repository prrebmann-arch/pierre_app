// COACH/scripts/test-bloodtest-helpers.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'

function classifyValue(marker, value, ctx) {
  const z = marker.zones
  let zone
  if (z.direction) { zone = z }
  else {
    const ss = z.sex_specific
    if (ctx?.sex === 'M' && ss.male) zone = ss.male
    else if (ctx?.sex === 'F') {
      if (ss.female_by_phase) {
        if (!ctx.phase) return { ok: false, error: 'missing_phase' }
        zone = ss.female_by_phase[ctx.phase]
        if (!zone) return { ok: false, error: 'no_zones_for_context' }
      } else if (ss.female) zone = ss.female
    }
    if (!zone) return { ok: false, error: 'missing_sex' }
  }
  const band = zone.bands.find((b) => (b.min === undefined || value >= b.min) && (b.max === undefined || value < b.max))
  if (!band) return { ok: false, error: 'value_outside_bands' }
  return { ok: true, band, zone_config: zone }
}

const VIT_D = {
  zones: { direction: 'higher_is_better', bands: [
    { label: 'optimal', severity: 1, min: 30 },
    { label: 'deficience', severity: 2, min: 20, max: 30 },
    { label: 'carence', severity: 3, min: 10, max: 20 },
    { label: 'avitaminose', severity: 4, max: 10 },
  ]}
}

test('vit D 35 -> optimal', () => {
  const r = classifyValue(VIT_D, 35)
  assert.ok(r.ok); assert.equal(r.band.label, 'optimal')
})
test('vit D 25 -> deficience', () => {
  const r = classifyValue(VIT_D, 25)
  assert.ok(r.ok); assert.equal(r.band.label, 'deficience')
})
test('vit D 8 -> avitaminose', () => {
  const r = classifyValue(VIT_D, 8)
  assert.ok(r.ok); assert.equal(r.band.label, 'avitaminose')
})

const E2 = {
  zones: { sex_specific: {
    male: { direction: 'range_is_normal', bands: [
      { label: 'low', severity: 3, max: 10 },
      { label: 'normal', severity: 1, min: 10, max: 40 },
      { label: 'high', severity: 3, min: 40 },
    ]},
    female_by_phase: {
      folliculaire: { direction: 'range_is_normal', bands: [
        { label: 'low', severity: 3, max: 30 },
        { label: 'normal', severity: 1, min: 30, max: 120 },
        { label: 'high', severity: 3, min: 120 },
      ]}
    }
  }}
}

test('E2 missing sex -> error', () => {
  const r = classifyValue(E2, 25, {})
  assert.equal(r.ok, false); assert.equal(r.error, 'missing_sex')
})
test('E2 female missing phase -> error', () => {
  const r = classifyValue(E2, 25, { sex: 'F' })
  assert.equal(r.ok, false); assert.equal(r.error, 'missing_phase')
})
test('E2 female folliculaire 50 -> normal', () => {
  const r = classifyValue(E2, 50, { sex: 'F', phase: 'folliculaire' })
  assert.ok(r.ok); assert.equal(r.band.label, 'normal')
})
