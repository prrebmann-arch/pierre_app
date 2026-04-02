'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toDateStr } from '@/lib/utils'
import { DEFAULT_STEPS_GOAL, DEFAULT_WATER_GOAL, PROG_PHASES, MS_PER_DAY } from '@/lib/constants'
import type { ProgPhaseKey } from '@/lib/constants'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip as ChartTooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function ApercuPage() {
  const params = useParams<{ id: string }>()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [athlete, setAthlete] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [activePhase, setActivePhase] = useState<any>(null)
  const [activeProg, setActiveProg] = useState<any>(null)
  const [nutritionPlans, setNutritionPlans] = useState<any[]>([])
  const [trackingRows, setTrackingRows] = useState<any[]>([])

  useEffect(() => {
    if (!params.id) return
    loadData()
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    const { data: ath } = await supabase.from('athletes').select('*').eq('id', params.id).single()
    const userId = ath?.user_id

    const [reportsRes, phasesRes, progsRes, nutriRes, trackRes] = await Promise.all([
      userId
        ? supabase.from('daily_reports').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(60)
        : Promise.resolve({ data: [] }),
      supabase.from('roadmap_phases').select('*').eq('athlete_id', params.id).eq('status', 'en_cours').order('position').limit(1),
      supabase.from('workout_programs').select('id, nom, actif, workout_sessions(id, nom, exercices)').eq('athlete_id', params.id).eq('actif', true).limit(1),
      supabase.from('nutrition_plans').select('*').eq('athlete_id', params.id).eq('actif', true),
      supabase.from('daily_tracking').select('date, water_ml, steps').eq('athlete_id', params.id).order('date', { ascending: false }).limit(7),
    ])

    setAthlete(ath)
    setReports(reportsRes.data || [])
    setActivePhase(phasesRes.data?.[0] || null)
    setActiveProg(progsRes.data?.[0] || null)
    setNutritionPlans(nutriRes.data || [])
    setTrackingRows(trackRes.data || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={140} borderRadius={20} />)}
        </div>
        <Skeleton height={200} borderRadius={20} />
      </div>
    )
  }

  const today = new Date()

  // -- Last 7 days --
  const last7: { date: string; day: string; report: any }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const ds = toDateStr(d)
    last7.push({ date: ds, day: d.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3), report: reports.find((r: any) => r.date === ds) })
  }

  // -- Weight (30 days) --
  const last30: { label: string; weight: number | null }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const ds = toDateStr(d)
    const r = reports.find((rep: any) => rep.date === ds)
    last30.push({ label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), weight: r?.weight ?? null })
  }
  const validWeights = last30.filter((d) => d.weight != null)
  const lastWeight = validWeights.length ? validWeights[validWeights.length - 1].weight : null
  const weightDiff = validWeights.length >= 2 ? ((validWeights[validWeights.length - 1].weight ?? 0) - (validWeights[0].weight ?? 0)).toFixed(1) : null

  // -- Tracking map --
  const trackingMap: Record<string, any> = {}
  trackingRows.forEach((t: any) => { trackingMap[t.date] = t })
  const todayStr = toDateStr(today)

  // -- Steps --
  const stepsTarget = athlete?.pas_journalier || DEFAULT_STEPS_GOAL
  const todaySteps = trackingMap[todayStr]?.steps || last7[6]?.report?.steps || 0
  const stepsPct = Math.min(100, Math.round((todaySteps / stepsTarget) * 100))
  const stepsValues = last7.map((d) => trackingMap[d.date]?.steps || d.report?.steps || 0)
  const stepsMax = Math.max(...stepsValues, stepsTarget, 1)
  const daysReached = stepsValues.filter((v: number) => v >= stepsTarget).length
  const avgSteps = Math.round(stepsValues.reduce((a: number, b: number) => a + b, 0) / 7)

  // -- Sleep --
  const sleepValues = last7.map((d) => d.report?.sleep_quality).filter((v: any) => v != null) as number[]
  const avgSleep = sleepValues.length ? (sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length).toFixed(1) : null
  const sleepColor = avgSleep && parseFloat(avgSleep) >= 7 ? '#22c55e' : avgSleep && parseFloat(avgSleep) >= 5 ? '#f59e0b' : '#ef4444'

  // -- Water --
  const waterGoal = athlete?.water_goal_ml || DEFAULT_WATER_GOAL
  const daysWaterReached = last7.filter((d) => (trackingMap[d.date]?.water_ml || 0) >= waterGoal).length

  // -- Bilan status --
  const mondayDate = new Date(today)
  const dayOff = mondayDate.getDay() === 0 ? 6 : mondayDate.getDay() - 1
  mondayDate.setDate(mondayDate.getDate() - dayOff)
  const bilanCount = reports.filter((r: any) => r.date >= toDateStr(mondayDate)).length
  const lastBilan = reports[0]

  // -- Roadmap --
  let phaseColor = 'var(--primary)'
  let phaseDays = '?'
  if (activePhase) {
    const pi = PROG_PHASES[activePhase.phase as ProgPhaseKey]
    if (pi) phaseColor = pi.color
    const end = activePhase.end_date ? new Date(activePhase.end_date + 'T00:00:00') : null
    phaseDays = end ? String(Math.max(0, Math.ceil((end.getTime() - today.getTime()) / MS_PER_DAY))) : '?'
  }

  // -- Active program --
  let progSessions = 0, progExercises = 0, progSeries = 0
  if (activeProg) {
    const sessions = activeProg.workout_sessions || []
    progSessions = sessions.length
    sessions.forEach((s: any) => {
      let exs: any[] = []
      try { exs = typeof s.exercices === 'string' ? JSON.parse(s.exercices) : (s.exercices || []) } catch { /* */ }
      exs.forEach((ex: any) => { progExercises++; progSeries += parseInt(ex.series) || 0 })
    })
  }

  // -- Nutrition --
  const trainingPlan = nutritionPlans.find((p: any) => p.meal_type === 'training' || p.meal_type === 'entrainement')
  const restPlan = nutritionPlans.find((p: any) => p.meal_type === 'rest' || p.meal_type === 'repos')

  // -- Activity feed --
  const activityItems = reports.slice(0, 15).map((r: any) => {
    const d = new Date(r.date + 'T00:00:00')
    const daysAgo = Math.floor((today.getTime() - d.getTime()) / MS_PER_DAY)
    const timeAgo = daysAgo === 0 ? "Aujourd'hui" : daysAgo === 1 ? 'Hier' : `Il y a ${daysAgo}j`
    const items: string[] = []
    if (r.weight) items.push(`${r.weight} kg`)
    if (r.sessions_executed) items.push(r.sessions_executed)
    if (r.steps) items.push(`${Number(r.steps).toLocaleString('fr-FR')} pas`)
    if (!items.length) return null
    return { timeAgo, items }
  }).filter(Boolean)

  // -- Chart data --
  const weightChartData = {
    labels: last30.map((d) => d.label),
    datasets: [{
      data: last30.map((d) => d.weight),
      borderColor: '#B30808',
      backgroundColor: 'rgba(179,8,8,0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointBackgroundColor: '#B30808',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      spanGaps: true,
    }],
  }

  const weightChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        cornerRadius: 8,
        padding: 10,
        displayColors: false,
        callbacks: { label: (item: any) => item.parsed.y != null ? item.parsed.y + ' kg' : 'Pas de donnees' },
      },
    },
    scales: {
      x: { display: true, grid: { display: false }, ticks: { color: '#55555e', font: { size: 10 }, maxTicksLimit: 5, maxRotation: 0 } },
      y: { display: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#55555e', font: { size: 10 }, callback: (v: any) => v + ' kg', maxTicksLimit: 4 } },
    },
    interaction: { mode: 'index' as const, intersect: false },
  }

  const dayLabels = last7.map((d) => d.day)

  function renderMiniBar(values: number[], maxVal: number, colorFn: (v: number) => string) {
    return (
      <div className={styles.miniBar}>
        {values.map((val, i) => {
          const h = Math.max(4, (val / Math.max(maxVal, 1)) * 60)
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
              <div style={{ height: 60, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                <div style={{ width: '100%', height: h, background: colorFn(val), borderRadius: '3px 3px 0 0', opacity: val ? 1 : 0.2 }} />
              </div>
              <span style={{ fontSize: 9, color: 'var(--text3)' }}>{dayLabels[i]}</span>
            </div>
          )
        })}
      </div>
    )
  }

  function renderMiniNutri(plan: any, label: string) {
    if (!plan) return null
    return (
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{plan.calories_objectif || 0} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>kcal</span></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text2)' }}><span style={{ color: 'var(--success)' }}>P</span> {plan.proteines || 0}g</span>
          <span style={{ fontSize: 10, color: 'var(--text2)' }}><span style={{ color: '#3b82f6' }}>G</span> {plan.glucides || 0}g</span>
          <span style={{ fontSize: 10, color: 'var(--text2)' }}><span style={{ color: 'var(--warning)' }}>L</span> {plan.lipides || 0}g</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.apLayout}>
      <div className={styles.apMain}>
        {/* Top stats */}
        <div className={styles.statsGrid}>
          <StatCard icon="fa-weight" iconColor="#B30808" iconBg="rgba(179,8,8,0.1)" barGrad="linear-gradient(90deg,#B30808,#d41a1a)" label="Poids" value={lastWeight != null ? String(lastWeight) : '\u2014'} unit="kg" sub={weightDiff ? `${parseFloat(weightDiff) > 0 ? '+' : ''}${weightDiff} kg sur 30j` : '\u2014'} />
          <StatCard icon="fa-clipboard-check" iconColor="#22c55e" iconBg="rgba(34,197,94,0.1)" barGrad="linear-gradient(90deg,#22c55e,#4ade80)" label="Bilans" value={String(bilanCount)} sub={`cette semaine${lastBilan ? ' \u00b7 dernier ' + new Date(lastBilan.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}`} />
          <StatCard icon="fa-moon" iconColor={sleepColor} iconBg={parseFloat(avgSleep || '0') >= 7 ? 'rgba(34,197,94,0.1)' : parseFloat(avgSleep || '0') >= 5 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'} barGrad={`linear-gradient(90deg,${sleepColor},${sleepColor}88)`} label="Sommeil" value={avgSleep ?? '\u2014'} unit="/10" sub="moyenne 7 derniers jours" />
          <div className={styles.statCard}>
            <div className={styles.statCardBar} style={{ background: 'linear-gradient(90deg,#3b82f6,#60a5fa)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div className={styles.statIconWrap} style={{ background: 'rgba(59,130,246,0.1)' }}><i className="fas fa-shoe-prints" style={{ color: '#3b82f6', fontSize: 15 }} /></div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pas</div>
            </div>
            <div className={styles.statValue}>{todaySteps ? todaySteps.toLocaleString('fr-FR') : '\u2014'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${stepsPct}%`, background: stepsPct >= 100 ? '#22c55e' : '#3b82f6' }} /></div>
              <span style={{ fontSize: 11, fontWeight: 600, color: stepsPct >= 100 ? '#22c55e' : 'var(--text2)' }}>{stepsPct}%</span>
            </div>
          </div>
        </div>

        {/* Weight chart */}
        <div className={styles.chartCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}><i className="fas fa-chart-line" style={{ color: '#B30808', opacity: 0.7 }} /> Evolution du poids</div>
            <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', padding: '3px 10px', borderRadius: 8 }}>30 jours</span>
          </div>
          {validWeights.length > 1 ? (
            <div style={{ position: 'relative', height: 160 }}>
              <Line data={weightChartData} options={weightChartOptions} />
            </div>
          ) : (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>Pas assez de donnees</div>
          )}
        </div>

        {/* Charts row */}
        <div className={styles.chartsRow}>
          <div className={styles.chartCard}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><i className="fas fa-shoe-prints" style={{ color: '#3b82f6', fontSize: 11 }} /> PAS (7J)</div>
            {renderMiniBar(stepsValues, stepsMax, (v) => v >= stepsTarget ? 'var(--success)' : 'var(--primary)')}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginTop: 8 }}>
              <span>{daysReached}/7 objectifs</span><span>Moy: {avgSteps.toLocaleString('fr-FR')}</span>
            </div>
          </div>
          <div className={styles.chartCard}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><i className="fas fa-moon" style={{ color: sleepColor, fontSize: 11 }} /> SOMMEIL (7J)</div>
            {renderMiniBar(last7.map((d) => d.report?.sleep_quality ?? 0), 10, (v) => v >= 7 ? 'var(--success)' : v >= 5 ? 'var(--warning)' : v > 0 ? 'var(--danger)' : 'var(--bg4)')}
          </div>
          <div className={styles.chartCard}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><i className="fas fa-tint" style={{ color: '#3b82f6', fontSize: 11 }} /> EAU (7J)</div>
            {renderMiniBar(last7.map((d) => trackingMap[d.date]?.water_ml ?? 0), waterGoal, (v) => v >= waterGoal ? 'var(--success)' : '#3b82f6')}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginTop: 8 }}>
              <span>{daysWaterReached}/7 objectifs</span><span>Obj: {(waterGoal / 1000).toFixed(1)}L</span>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className={styles.bottomRow}>
          <div className={styles.chartCard}>
            <SectionHeader icon="fa-road" color="#8b5cf6" bg="rgba(139,92,246,0.1)" label="Roadmap" />
            {activePhase ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: phaseColor, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{activePhase.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{phaseDays}j restants</div>
                </div>
              </div>
            ) : <div style={{ color: 'var(--text3)', fontSize: 13 }}>Aucune phase en cours</div>}
          </div>
          <div className={styles.chartCard}>
            <SectionHeader icon="fa-dumbbell" color="#f59e0b" bg="rgba(245,158,11,0.1)" label="Programme" />
            {activeProg ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{activeProg.nom}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{progSessions} seances &middot; {progExercises} exercices &middot; {progSeries} series</div>
              </>
            ) : <div style={{ color: 'var(--text3)', fontSize: 13 }}>Aucun programme actif</div>}
          </div>
          <div className={styles.chartCard}>
            <SectionHeader icon="fa-utensils" color="#22c55e" bg="rgba(34,197,94,0.1)" label="Nutrition" />
            {trainingPlan || restPlan ? <>{renderMiniNutri(trainingPlan, 'Jour entrainement')}{renderMiniNutri(restPlan, 'Jour repos')}</> : <div style={{ color: 'var(--text3)', fontSize: 13 }}>Aucun plan actif</div>}
          </div>
        </div>
      </div>

      {/* Activity sidebar */}
      <div className={styles.activitySidebar}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(179,8,8,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fas fa-bolt" style={{ color: '#B30808', fontSize: 11 }} /></div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Activite</span>
        </div>
        <div className={styles.activityScroll}>
          {activityItems.length ? activityItems.map((item: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: 'var(--text2)' }}>{item.items.map((t: string, j: number) => <span key={j}>{t}</span>)}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{item.timeAgo}</div>
              </div>
            </div>
          )) : <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', padding: 20 }}>Aucune activite</div>}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, iconColor, iconBg, barGrad, label, value, unit, sub }: { icon: string; iconColor: string; iconBg: string; barGrad: string; label: string; value: string; unit?: string; sub: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statCardBar} style={{ background: barGrad }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div className={styles.statIconWrap} style={{ background: iconBg }}><i className={`fas ${icon}`} style={{ color: iconColor, fontSize: 15 }} /></div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      </div>
      <div className={styles.statValue}>{value}{unit && <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text2)', marginLeft: 4 }}>{unit}</span>}</div>
      <div className={styles.statSub}>{sub}</div>
    </div>
  )
}

function SectionHeader({ icon, color, bg, label }: { icon: string; color: string; bg: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className={`fas ${icon}`} style={{ color, fontSize: 13 }} /></div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    </div>
  )
}
