'use client'

import { useEffect, useRef, useState } from 'react'

const STEPS = [
  'Lecture du PDF',
  'Extraction des marqueurs',
  'Mapping vers le catalogue',
  'Finalisation',
] as const

const STEP_INTERVAL_MS = 3000
const STALE_LABEL = 'Toujours en cours, ça arrive…'
const TIMEOUT_MS = 65_000

type Status = 'running' | 'done' | 'stale' | 'error'

export default function BloodtestAnalysisProgress({
  etaMs,
  onRetry,
  status,
  errorMessage,
}: {
  etaMs: number
  status: Status
  onRetry?: () => void
  errorMessage?: string
}) {
  const [pct, setPct] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const startRef = useRef<number>(Date.now())

  useEffect(() => {
    if (status === 'done') { setPct(100); return }
    if (status === 'error') return
    if (status === 'stale') return

    startRef.current = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const ratio = Math.min(elapsed / etaMs, 1)
      // 0 → 90% sur la durée ETA, ensuite plafond 90%
      setPct(Math.min(ratio * 90, 90))
    }
    const animId = setInterval(tick, 100)
    const stepId = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
    }, STEP_INTERVAL_MS)
    return () => { clearInterval(animId); clearInterval(stepId) }
  }, [etaMs, status])

  const isError = status === 'error'
  const isStale = status === 'stale'
  const isDone = status === 'done'

  const label = isError
    ? `Échec de l'analyse${errorMessage ? ` : ${errorMessage}` : ''}`
    : isStale
      ? STALE_LABEL
      : isDone
        ? 'Analyse terminée'
        : STEPS[stepIdx]

  return (
    <div style={{ padding: 12, background: 'var(--bg2)', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <i
          className={`fas ${isError ? 'fa-circle-exclamation' : isDone ? 'fa-check-circle' : 'fa-wand-magic-sparkles'}`}
          style={{ color: isError ? 'var(--red)' : isDone ? 'var(--green)' : 'var(--primary)' }}
        />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: isError ? 'var(--red)' : 'var(--primary)',
            transition: 'width 200ms linear',
          }}
        />
      </div>
      {isError && onRetry && (
        <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={onRetry}>
          <i className="fas fa-rotate" /> Réessayer l'analyse IA
        </button>
      )}
    </div>
  )
}

export { TIMEOUT_MS as ANALYSIS_TIMEOUT_MS }
