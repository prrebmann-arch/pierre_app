'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import { createClient } from '@/lib/supabase/client'
import { MS_PER_DAY } from '@/lib/constants'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/business.module.css'

// ── Types ──
interface BizConfig {
  week_number: number
  start_followers: number
  target_mrr: number
  target_name: string
  target_deadline: string | null
  created_at?: string
}

interface DailyEntry {
  week_number: number
  day_name: string
  dms: number
  rdvs: number
  rdvs_attended: number
  clients_online: number
  clients_offline: number
  reels: number
  followers: number
  meta_ads_budget: number
  clients_lost_online?: number
  clients_lost_offline?: number
}

interface WeeklyObjectives {
  dms_target: number
  rdvs_target: number
  rdvs_attended_target: number
  clients_target: number
  reels_target: number
  followers_target: number
}

interface BizClient {
  id: string
  name: string
  email?: string
  price: number
  client_type: 'online' | 'offline'
  status: 'active' | 'archived'
  billing_day?: string
  start_date: string
  archived_at?: string
  archive_reason?: string
}

interface StripeCustomer {
  athlete_id: string
  stripe_customer_id: string
  subscription_status: string
  stripe_subscription_id?: string
}

interface PaymentRecord {
  id: string
  stripe_customer_id: string
  amount: number
  currency: string
  status: string
  description?: string
  created_at: string
}

interface AthletePaymentPlan {
  id: string
  coach_id: string
  athlete_id: string
  is_free: boolean
  amount: number
  currency: string
  frequency: string
  frequency_interval?: number
  payment_status: string
  stripe_subscription_id?: string
  stripe_customer_id?: string
  engagement_months?: number
  created_at?: string
}

interface AthletePaymentHistory {
  id: string
  coach_id: string
  athlete_id: string
  amount: number
  currency: string
  status: string
  description?: string
  created_at: string
  is_platform_payment?: boolean
}

// ── Constants ──
const BIZ_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const
const BIZ_DAY_LABELS: Record<string, string> = { lundi: 'L', mardi: 'M', mercredi: 'Me', jeudi: 'J', vendredi: 'V', samedi: 'S' }

const DEFAULT_CONFIG: BizConfig = {
  week_number: 1, start_followers: 0, target_mrr: 10000,
  target_name: 'Objectif Business', target_deadline: null,
}
const DEFAULT_OBJ: WeeklyObjectives = {
  dms_target: 200, rdvs_target: 6, rdvs_attended_target: 4,
  clients_target: 2, reels_target: 7, followers_target: 60,
}

// ── Helpers ──
function calcMRR(clients: BizClient[]) {
  const a = clients.filter(c => c.status === 'active')
  return {
    total: a.reduce((s, c) => s + c.price, 0),
    online: a.filter(c => c.client_type === 'online').reduce((s, c) => s + c.price, 0),
    offline: a.filter(c => c.client_type === 'offline').reduce((s, c) => s + c.price, 0),
    onlineCount: a.filter(c => c.client_type === 'online').length,
    offlineCount: a.filter(c => c.client_type === 'offline').length,
    count: a.length,
  }
}
function sumField(entries: DailyEntry[], field: keyof DailyEntry) {
  return entries.reduce((s, e) => s + (Number(e[field]) || 0), 0)
}
function calcProb(cur: number, target: number, daysLeft: number) {
  if (cur >= target) return 100
  if (daysLeft <= 0) return 0
  const needed = (target - cur) / daysLeft
  const avg = target / 6
  let p = Math.min(100, (avg / needed) * 60)
  const prog = cur / target
  if (prog > 0.75) p = Math.min(100, p + 15)
  else if (prog > 0.5) p = Math.min(100, p + 10)
  return Math.round(Math.max(0, p))
}
function probColor(p: number) {
  return p >= 70 ? 'var(--success)' : p >= 40 ? 'var(--warning)' : 'var(--danger)'
}

// ── Sub-components ──
function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={styles.bizKpi}>
      <div className={styles.bizKpiLabel}>{label}</div>
      <div className={styles.bizKpiValue}>{value}</div>
      {sub && <div className={styles.bizKpiSub}>{sub}</div>}
    </div>
  )
}

function FieldRow({ label, field, value, target, step, onChange }: {
  label: string; field: string; value: number; target?: string | number; step?: string
  onChange: (field: string, val: number) => void
}) {
  return (
    <div className={styles.bizDataRow}>
      <span className={styles.bizDataLabel}>{label}</span>
      {target !== undefined && target !== '' ? <span className={styles.bizDataTarget}>obj: {target}</span> : <span />}
      <input
        type="number" value={value} min={0} step={step || '1'}
        className={styles.bizDataInput}
        onChange={(e) => onChange(field, step ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0)}
      />
    </div>
  )
}

function WeekRow({ label, val, target }: { label: string; val: number; target: number }) {
  const ok = val >= target
  const pct = target > 0 ? Math.min(100, Math.round(val / target * 100)) : 0
  return (
    <div className={styles.bizDataRow}>
      <span className={styles.bizDataLabel} style={{ minWidth: 100 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden', margin: '0 12px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: ok ? 'var(--success)' : 'var(--primary)', borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12 }}>
        <strong style={{ color: ok ? 'var(--success)' : 'var(--text)' }}>{val}</strong>
        <span style={{ color: 'var(--text3)' }}> / {target}</span>
      </span>
    </div>
  )
}

function FunnelRow({ icon, name, val, rate }: { icon: string; name: string; val: number; rate: string | null }) {
  return (
    <div className={styles.bizFunnelRow}>
      <span className={styles.bizFunnelIcon}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div className={styles.bizFunnelLabel}>{name}</div>
        <div className={styles.bizFunnelValue}>{val}</div>
      </div>
      {rate && <span className={styles.bizFunnelRate}>{rate}</span>}
    </div>
  )
}

function PredRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div className={styles.bizPredRow}>
      <span style={{ fontSize: 12, color: 'var(--text2)', minWidth: 70 }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden', margin: '0 12px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: probColor(pct), borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 36, textAlign: 'right', color: probColor(pct) }}>{pct}%</span>
    </div>
  )
}

function MetricRow({ label, val }: { label: string; val: string }) {
  return (
    <div className={styles.bizMetricRow}>
      <span className={styles.bizMetricLabel}>{label}</span>
      <span className={styles.bizMetricValue}>{val}</span>
    </div>
  )
}

function ForecastCard({ label, real, forecast, delta, suffix = '' }: {
  label: string; real: number; forecast: number; delta: number; suffix?: string
}) {
  const cls = delta >= 0 ? 'var(--success)' : 'var(--danger)'
  const sign = delta >= 0 ? '+' : ''
  return (
    <div className={styles.bizForecastCard}>
      <div className={styles.bizForecastLabel}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 6 }}>
        <div><div style={{ fontSize: 9, color: 'var(--text3)' }}>Reel</div><div style={{ fontSize: 15, fontWeight: 700 }}>{real.toLocaleString('fr-FR')}{suffix}</div></div>
        <div><div style={{ fontSize: 9, color: 'var(--text3)' }}>Prevu</div><div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text3)' }}>{forecast.toLocaleString('fr-FR')}{suffix}</div></div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: cls }}>{sign}{delta.toLocaleString('fr-FR')}{suffix}</div>
    </div>
  )
}

function ClientRow({ client, stripeData, onEdit, onArchive, onPayLink, onPayHistory }: {
  client: BizClient
  stripeData: Record<string, StripeCustomer>
  onEdit: (id: string) => void
  onArchive: (id: string) => void
  onPayLink: (id: string) => void
  onPayHistory: (id: string) => void
}) {
  const s = stripeData[client.id]
  const statusColors: Record<string, string> = { active: '#22c55e', past_due: '#f59e0b', canceled: '#ef4444' }
  const statusLabels: Record<string, string> = { active: 'Actif', past_due: 'En retard', canceled: 'Annule' }

  return (
    <div className={styles.bizClientRow}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{client.name}</span>
          {s ? (
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${statusColors[s.subscription_status] || '#6b7280'}22`, color: statusColors[s.subscription_status] || '#6b7280', fontWeight: 600 }}>
              {statusLabels[s.subscription_status] || s.subscription_status}
            </span>
          ) : (
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(128,128,128,0.2)', color: 'var(--text3)' }}>Pas de paiement</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
          Depuis {new Date(client.start_date).toLocaleDateString('fr-FR')} &middot; LTV: {client.price * 6}EUR
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)', marginRight: 4 }}>{client.price}EUR</span>
        {s && <Button variant="outline" size="sm" onClick={() => onPayHistory(client.id)} title="Historique paiements"><i className="fas fa-receipt" /></Button>}
        <Button variant="outline" size="sm" onClick={() => onPayLink(client.id)} title="Copier lien de paiement"><i className="fas fa-link" /></Button>
        <Button variant="outline" size="sm" onClick={() => onEdit(client.id)}><i className="fas fa-pen" /></Button>
        <Button variant="outline" size="sm" onClick={() => onArchive(client.id)} style={{ color: 'var(--danger)' }}><i className="fas fa-box-archive" /></Button>
      </div>
    </div>
  )
}

// ── Main Component ──
export default function BusinessDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'dashboard' | 'objectives' | 'clients' | 'payments'>('dashboard')
  const [config, setConfig] = useState<BizConfig>(DEFAULT_CONFIG)
  const [allEntries, setAllEntries] = useState<DailyEntry[]>([])
  const [clients, setClients] = useState<BizClient[]>([])
  const [stripeData, setStripeData] = useState<Record<string, StripeCustomer>>({})
  const [objectives, setObjectives] = useState<WeeklyObjectives>(DEFAULT_OBJ)
  const [week, setWeek] = useState(1)
  const [day, setDay] = useState('lundi')

  // Modals
  const [showObjModal, setShowObjModal] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [editingClient, setEditingClient] = useState<BizClient | null>(null)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveId, setArchiveId] = useState<string | null>(null)
  const [archiveReason, setArchiveReason] = useState('')
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set())
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([])
  const [paymentClientName, setPaymentClientName] = useState('')
  const [loadingPayments, setLoadingPayments] = useState(false)

  // Athlete payment data (from Stripe Connect)
  const [athletePaymentPlans, setAthletePaymentPlans] = useState<AthletePaymentPlan[]>([])
  const [athletePayments, setAthletePayments] = useState<AthletePaymentHistory[]>([])
  const [athletes, setAthletes] = useState<Record<string, { prenom: string; nom: string }>>({})

  // Client form state
  const [cName, setCName] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cPrice, setCPrice] = useState('')
  const [cType, setCType] = useState<'online' | 'offline'>('online')
  const [cBilling, setCBilling] = useState('1')
  const [cStart, setCStart] = useState(new Date().toISOString().split('T')[0])

  // Obj config modal state
  const [objName, setObjName] = useState('')
  const [objMrr, setObjMrr] = useState(10000)
  const [objDeadline, setObjDeadline] = useState('')
  const [objWeek, setObjWeek] = useState(1)
  const [objFollowers, setObjFollowers] = useState(0)

  // Objectives edit state
  const [editObj, setEditObj] = useState<WeeklyObjectives>(DEFAULT_OBJ)

  const loadAll = useCallback(async () => {
    if (!user) return
    if (!clients.length) setLoading(true)
    try {
    // Single parallel batch for all independent queries (was 2 sequential batches)
    const [cfgRes, entriesRes, clientsRes, stripeRes, plansRes, paymentsRes, athletesRes] = await Promise.all([
      supabase.from('project_config').select('user_id, target_name, target_mrr, target_deadline, week_number, start_followers').eq('user_id', user.id).single(),
      supabase.from('daily_entries').select('id, user_id, week_number, day_name, dms, rdvs, rdvs_attended, clients_online, clients_offline, clients_lost_online, clients_lost_offline, reels, followers, meta_ads_budget').eq('user_id', user.id).limit(100),
      supabase.from('biz_clients').select('id, user_id, name, email, price, client_type, billing_day, start_date, status, archived_at, archive_reason, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('stripe_customers').select('id, coach_id, athlete_id, stripe_customer_id').eq('coach_id', user.id).limit(200),
      supabase.from('athlete_payment_plans').select('id, athlete_id, coach_id, payment_status, amount, frequency, is_free').eq('coach_id', user.id).limit(200),
      supabase.from('payment_history').select('id, athlete_id, coach_id, amount, status, stripe_invoice_id, created_at').eq('coach_id', user.id).eq('is_platform_payment', false).order('created_at', { ascending: false }).limit(50),
      supabase.from('athletes').select('id, prenom, nom').eq('coach_id', user.id).limit(200),
    ])

    const cfg = cfgRes.data || DEFAULT_CONFIG
    setConfig(cfg as BizConfig)
    setAllEntries((entriesRes.data || []) as DailyEntry[])
    setClients((clientsRes.data || []) as BizClient[])

    const sMap: Record<string, StripeCustomer> = {}
    ;(stripeRes.data || []).forEach((s: StripeCustomer) => { if (s.athlete_id) sMap[s.athlete_id] = s })
    setStripeData(sMap)

    setAthletePaymentPlans((plansRes.data || []) as AthletePaymentPlan[])
    setAthletePayments((paymentsRes.data || []) as AthletePaymentHistory[])
    const aMap: Record<string, { prenom: string; nom: string }> = {}
    ;(athletesRes.data || []).forEach((a: any) => { aMap[a.id] = { prenom: a.prenom || '', nom: a.nom || '' } })
    setAthletes(aMap)

    const wk = cfg.week_number || 1
    setWeek(wk)

    // Fire objectives query without blocking — data above is enough to render
    supabase.from('weekly_objectives').select('id, user_id, start_week, dms_target, rdvs_target, clients_target, reels_target, followers_target').eq('user_id', user.id).lte('start_week', wk).order('start_week', { ascending: false }).limit(1).single()
      .then(({ data }) => {
        const obj = data || DEFAULT_OBJ
        setObjectives(obj as WeeklyObjectives)
        setEditObj(obj as WeeklyObjectives)
      })

    // Auto-detect day
    const today = new Date().getDay()
    const dayMap: Record<number, string> = { 1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi' }
    if (dayMap[today]) setDay(dayMap[today])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => { loadAll() }, [loadAll])

  useRefetchOnResume(loadAll, loading)

  // Derived data
  const weekEntries = useMemo(() => allEntries.filter(e => e.week_number === week), [allEntries, week])
  const dayEntry = useMemo(() => weekEntries.find(e => e.day_name === day) || {} as DailyEntry, [weekEntries, day])
  const mrr = useMemo(() => calcMRR(clients), [clients])
  const totalFollowers = useMemo(() => (config.start_followers || 0) + sumField(allEntries, 'followers'), [config.start_followers, allEntries])
  const pct = useMemo(() => Math.min(100, Math.round((mrr.total / (config.target_mrr || 10000)) * 100)), [mrr.total, config.target_mrr])

  // Week totals
  const weekTotals = useMemo(() => {
    const wDms = sumField(weekEntries, 'dms')
    const wRdvs = sumField(weekEntries, 'rdvs')
    const wRdvsA = sumField(weekEntries, 'rdvs_attended')
    const wCli = sumField(weekEntries, 'clients_online') + sumField(weekEntries, 'clients_offline')
    const wReels = sumField(weekEntries, 'reels')
    const wFoll = sumField(weekEntries, 'followers')
    const filled = new Set(weekEntries.map(e => e.day_name)).size
    const daysLeft = 6 - filled
    return { wDms, wRdvs, wRdvsA, wCli, wReels, wFoll, filled, daysLeft }
  }, [weekEntries])
  const { wDms, wRdvs, wRdvsA, wCli, wReels, wFoll, daysLeft } = weekTotals

  // All-time
  const allTimeTotals = useMemo(() => {
    const aDms = sumField(allEntries, 'dms')
    const aCli = sumField(allEntries, 'clients_online') + sumField(allEntries, 'clients_offline')
    const aMeta = sumField(allEntries, 'meta_ads_budget')
    const aLost = sumField(allEntries, 'clients_lost_online' as keyof DailyEntry) + sumField(allEntries, 'clients_lost_offline' as keyof DailyEntry)
    return { aDms, aCli, aMeta, aLost }
  }, [allEntries])
  const { aDms, aCli, aMeta, aLost } = allTimeTotals

  // Athlete payment plan stats
  const activePlans = useMemo(() => athletePaymentPlans.filter(p => p.payment_status === 'active'), [athletePaymentPlans])
  const pendingPlans = useMemo(() => athletePaymentPlans.filter(p => p.payment_status === 'pending'), [athletePaymentPlans])
  const stripeMrr = useMemo(() => activePlans.reduce((s, p) => {
    if (p.is_free) return s
    const amt = p.amount || 0
    if (p.frequency === 'week') return s + amt * 4
    if (p.frequency === 'day') return s + amt * 30
    return s + amt // month or default
  }, 0), [activePlans])
  const totalRevenue = useMemo(() => athletePayments.filter(p => p.status === 'succeeded').reduce((s, p) => s + (p.amount || 0), 0), [athletePayments])

  // Probabilities
  const probabilities = useMemo(() => ({
    pDms: calcProb(wDms, objectives.dms_target, daysLeft),
    pRdvs: calcProb(wRdvs, objectives.rdvs_target, daysLeft),
    pCli: calcProb(wCli, objectives.clients_target, daysLeft),
    pReels: calcProb(wReels, objectives.reels_target, daysLeft),
    pFoll: calcProb(wFoll, objectives.followers_target, daysLeft),
  }), [wDms, wRdvs, wCli, wReels, wFoll, objectives, daysLeft])
  const { pDms, pRdvs, pCli, pReels, pFoll } = probabilities

  const dDms = useMemo(() => Math.ceil(objectives.dms_target / 6), [objectives.dms_target])
  const dReels = useMemo(() => Math.ceil(objectives.reels_target / 6), [objectives.reels_target])
  const dFoll = useMemo(() => Math.ceil(objectives.followers_target / 6), [objectives.followers_target])

  // Dynamic forecast
  const targetMrr = config.target_mrr || 10000
  const forecast = useMemo(() => {
    const totalW = config.target_deadline
      ? Math.max(1, Math.ceil((new Date(config.target_deadline + 'T00:00:00').getTime() - new Date(config.created_at || new Date().toISOString()).getTime()) / (7 * MS_PER_DAY)))
      : 16
    const fcMrr = Math.round(targetMrr * (week / totalW))
    const fcClients = Math.round(fcMrr / (mrr.count > 0 ? mrr.total / mrr.count : 150))
    const fcFollowers = Math.round((config.start_followers || 0) + (week / totalW) * 1200)
    const deltaCli = mrr.count - fcClients
    const deltaMrr = mrr.total - fcMrr
    const deltaFoll = totalFollowers - fcFollowers
    const weeksLeft = config.target_deadline ? Math.max(0, Math.ceil((new Date(config.target_deadline + 'T00:00:00').getTime() - Date.now()) / (7 * MS_PER_DAY))) : null
    return { totalW, fcMrr, fcClients, fcFollowers, deltaCli, deltaMrr, deltaFoll, weeksLeft }
  }, [config, targetMrr, week, mrr, totalFollowers])
  const { totalW, fcMrr, fcClients, fcFollowers, deltaCli, deltaMrr, deltaFoll, weeksLeft } = forecast

  // KPIs
  const kpis = useMemo(() => {
    const avgPrice = mrr.count > 0 ? Math.round(mrr.total / mrr.count) : 0
    const dmToClient = aDms > 0 ? (aCli / aDms * 100).toFixed(1) + '%' : '--'
    const cac = aCli > 0 && aMeta > 0 ? Math.round(aMeta / aCli) + 'EUR' : '--'
    const ltv = avgPrice * 6
    const roi = aMeta > 0 && aCli > 0 ? ((aCli * avgPrice * 6 / aMeta - 1) * 100).toFixed(0) + '%' : '--'
    const churn = aLost > 0 && aCli > 0 ? (aLost / (aCli + aLost) * 100).toFixed(1) + '%' : '0%'
    return { avgPrice, dmToClient, cac, ltv, roi, churn }
  }, [mrr, aDms, aCli, aMeta, aLost])
  const { avgPrice, dmToClient, cac, ltv, roi, churn } = kpis

  // ── Actions ──
  const updateField = useCallback(async (field: string, value: number) => {
    if (!user) return
    await supabase.from('daily_entries').upsert(
      { user_id: user.id, week_number: week, day_name: day, [field]: value },
      { onConflict: 'user_id,week_number,day_name' }
    )
    const { data } = await supabase.from('daily_entries').select('id, user_id, week_number, day_name, dms, rdvs, rdvs_attended, clients_online, clients_offline, clients_lost_online, clients_lost_offline, reels, followers, meta_ads_budget').eq('user_id', user.id)
    setAllEntries((data || []) as DailyEntry[])
  }, [user, week, day, supabase])

  const changeWeek = useCallback(async (dir: number) => {
    const nw = week + dir
    if (nw < 1) return
    setWeek(nw)
    await supabase.from('project_config').upsert({ user_id: user!.id, week_number: nw }, { onConflict: 'user_id' })
    const objRes = await supabase.from('weekly_objectives').select('id, user_id, start_week, dms_target, rdvs_target, clients_target, reels_target, followers_target').eq('user_id', user!.id).lte('start_week', nw).order('start_week', { ascending: false }).limit(1).single()
    setObjectives((objRes.data || DEFAULT_OBJ) as WeeklyObjectives)
  }, [week, user, supabase])

  const saveObjectiveConfig = useCallback(async () => {
    if (!user) return
    await supabase.from('project_config').upsert({
      user_id: user.id, target_name: objName, target_mrr: objMrr,
      target_deadline: objDeadline || null, week_number: objWeek, start_followers: objFollowers,
    }, { onConflict: 'user_id' })
    setShowObjModal(false)
    toast('Objectif mis a jour !', 'success')
    loadAll()
  }, [user, objName, objMrr, objDeadline, objWeek, objFollowers, supabase, toast, loadAll])

  const saveWeeklyObj = useCallback(async () => {
    if (!user) return
    await supabase.from('weekly_objectives').upsert({
      user_id: user.id, start_week: week, ...editObj,
    }, { onConflict: 'user_id,start_week' })
    setObjectives(editObj)
    toast('Objectifs sauvegardes !', 'success')
  }, [user, week, editObj, supabase, toast])

  const submitClient = useCallback(async () => {
    if (!user) return
    const name = cName.trim()
    const price = parseInt(cPrice)
    if (!name || !price) { toast('Nom et prix requis', 'error'); return }

    if (editingClient) {
      await supabase.from('biz_clients').update({
        name, email: cEmail.trim() || null, price, client_type: cType,
        billing_day: cBilling, start_date: cStart,
      }).eq('id', editingClient.id)
    } else {
      await supabase.from('biz_clients').insert({
        user_id: user.id, name, email: cEmail.trim() || null, price,
        client_type: cType, billing_day: cBilling, start_date: cStart,
      })
    }
    setShowClientModal(false)
    toast(editingClient ? 'Client mis a jour !' : 'Client ajoute !', 'success')
    const { data } = await supabase.from('biz_clients').select('id, user_id, name, email, price, client_type, billing_day, start_date, status, archived_at, archive_reason, created_at').eq('user_id', user.id).order('created_at', { ascending: false })
    setClients((data || []) as BizClient[])
  }, [user, cName, cEmail, cPrice, cType, cBilling, cStart, editingClient, supabase, toast])

  const archiveClient = useCallback(async () => {
    if (!archiveId) return
    await supabase.from('biz_clients').update({
      status: 'archived', archived_at: new Date().toISOString(), archive_reason: archiveReason,
    }).eq('id', archiveId)
    setShowArchiveModal(false)
    setArchiveReason('')
    toast('Client archive', 'success')
    const { data } = await supabase.from('biz_clients').select('id, user_id, name, email, price, client_type, billing_day, start_date, status, archived_at, archive_reason, created_at').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(200)
    setClients((data || []) as BizClient[])
  }, [archiveId, archiveReason, user, supabase, toast])

  const deleteClient = useCallback(async (id: string) => {
    if (!confirm('Supprimer definitivement ce client ?')) return
    await supabase.from('biz_clients').delete().eq('id', id)
    setShowClientModal(false)
    toast('Client supprime', 'success')
    const { data } = await supabase.from('biz_clients').select('id, user_id, name, email, price, client_type, billing_day, start_date, status, archived_at, archive_reason, created_at').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(200)
    setClients((data || []) as BizClient[])
  }, [user, supabase, toast])

  const openEditClient = useCallback((id: string) => {
    const c = clients.find(cl => cl.id === id)
    if (!c) return
    setEditingClient(c)
    setCName(c.name)
    setCEmail(c.email || '')
    setCPrice(String(c.price))
    setCType(c.client_type)
    setCBilling(c.billing_day || '1')
    setCStart(c.start_date)
    setShowClientModal(true)
  }, [clients])

  const openAddClient = useCallback(() => {
    setEditingClient(null)
    setCName(''); setCEmail(''); setCPrice(''); setCType('online')
    setCBilling('1'); setCStart(new Date().toISOString().split('T')[0])
    setShowClientModal(true)
  }, [])

  const openArchive = useCallback((id: string) => {
    setArchiveId(id)
    setArchiveReason('')
    setShowArchiveModal(true)
  }, [])

  const copyPayLink = useCallback(async (_clientId: string) => {
    toast('Lien de paiement -- fonctionnalite Stripe', 'success')
  }, [toast])

  const openPaymentHistory = useCallback(async (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    const stripe = stripeData[clientId]
    if (!stripe?.stripe_customer_id) {
      toast('Pas de donnees Stripe pour ce client', 'error')
      return
    }
    setPaymentClientName(client?.name || 'Client')
    setLoadingPayments(true)
    setShowPaymentModal(true)
    try {
      const { data } = await supabase
        .from('payment_history')
        .select('id, athlete_id, amount, status, stripe_invoice_id, created_at')
        .eq('stripe_customer_id', stripe.stripe_customer_id)
        .order('created_at', { ascending: false })
        .limit(20)
      setPaymentHistory((data || []) as PaymentRecord[])
    } finally {
      setLoadingPayments(false)
    }
  }, [clients, stripeData, supabase, toast])

  const openObjModal = useCallback(() => {
    setObjName(config.target_name || 'Objectif Business')
    setObjMrr(config.target_mrr || 10000)
    setObjDeadline(config.target_deadline || '')
    setObjWeek(config.week_number || 1)
    setObjFollowers(config.start_followers || 0)
    setShowObjModal(true)
  }, [config])

  if (loading) return <Skeleton />

  // ── Tabs ──
  const tabs: { id: typeof tab; icon: string; label: string }[] = [
    { id: 'dashboard', icon: 'fas fa-chart-line', label: 'Dashboard' },
    { id: 'payments', icon: 'fas fa-credit-card', label: 'Paiements' },
    { id: 'objectives', icon: 'fas fa-bullseye', label: 'Objectifs' },
    { id: 'clients', icon: 'fas fa-users', label: 'Clients' },
  ]

  const kpiBar = (
    <div className={styles.bizHeader}>
      <div className={styles.bizKpiRow}>
        <KpiCard label="MRR" value={`${mrr.total.toLocaleString('fr-FR')}EUR`} sub={`/ ${targetMrr.toLocaleString('fr-FR')}EUR`} />
        <KpiCard label="Online" value={`${mrr.online.toLocaleString('fr-FR')}EUR`} sub={`${mrr.onlineCount} clients`} />
        <KpiCard label="Presentiel" value={`${mrr.offline.toLocaleString('fr-FR')}EUR`} sub={`${mrr.offlineCount} clients`} />
        <KpiCard label="Clients" value={mrr.count} />
        <KpiCard label="Followers" value={totalFollowers.toLocaleString('fr-FR')} />
        <KpiCard label="Semaine" value={`S${week}`} sub={weeksLeft !== null ? `${weeksLeft}j restants` : `/ ${totalW}`} />
      </div>
      <div className={styles.bizProgressWrap}>
        <div className={styles.bizProgressBar}>
          <div className={styles.bizProgressFill} style={{ width: `${pct}%` }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)' }}>{pct}%</span>
        <button className="nd2-btn" onClick={openObjModal} title="Modifier l'objectif"><i className="fas fa-pen" /></button>
      </div>
    </div>
  )

  // ── Motivation ──
  const mPct = mrr.total / (config.target_mrr || 10000) * 100
  let mText = 'Continue comme ca, tu es sur la bonne voie !'
  if (mPct >= 90) mText = `Tu y es presque ! Le ${(config.target_mrr || 10000).toLocaleString('fr-FR')}EUR est a portee de main !`
  else if (mPct >= 70) mText = 'Excellent momentum ! Chaque DM te rapproche du but.'
  else if (mPct >= 40) mText = 'Tu construis ta base. La constance paie toujours.'
  else if (mPct < 20) mText = 'Chaque expert a commence par le debut. Envoie tes DMs !'

  return (
    <>
      {/* Nav */}
      <div className={styles.bizNav}>
        {tabs.map(t => (
          <button
            key={t.id}
            className={`${styles.bizNavBtn} ${tab === t.id ? styles.bizNavBtnActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            <i className={t.icon} /> {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <>
          {kpiBar}
          <div className={styles.bizGrid}>
            {/* COL 1 - Daily entry */}
            <div>
              <Card title="Saisie du jour" headerRight={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button variant="outline" size="sm" onClick={() => changeWeek(-1)} disabled={week <= 1}><i className="fas fa-chevron-left" /></Button>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>S{week}</span>
                  <Button variant="outline" size="sm" onClick={() => changeWeek(1)}><i className="fas fa-chevron-right" /></Button>
                </div>
              } className="mb-16">
                <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                  {BIZ_DAYS.map(d => (
                    <button key={d} className={`${styles.bizDayBtn} ${d === day ? styles.bizDayBtnActive : ''}`} onClick={() => setDay(d)}>
                      {BIZ_DAY_LABELS[d]}
                    </button>
                  ))}
                </div>
                <FieldRow label="DMs envoyes" field="dms" value={dayEntry.dms || 0} target={dDms} onChange={updateField} />
                <FieldRow label="RDVs pris" field="rdvs" value={dayEntry.rdvs || 0} target={1} onChange={updateField} />
                <FieldRow label="RDVs honores" field="rdvs_attended" value={dayEntry.rdvs_attended || 0} target={1} onChange={updateField} />
                <FieldRow label="Clients online" field="clients_online" value={dayEntry.clients_online || 0} onChange={updateField} />
                <FieldRow label="Clients presentiel" field="clients_offline" value={dayEntry.clients_offline || 0} onChange={updateField} />
                <FieldRow label="Reels postes" field="reels" value={dayEntry.reels || 0} target={dReels} onChange={updateField} />
                <FieldRow label="Followers" field="followers" value={dayEntry.followers || 0} target={dFoll} onChange={updateField} />
                <FieldRow label="Meta Ads EUR" field="meta_ads_budget" value={dayEntry.meta_ads_budget || 0} step="0.01" onChange={updateField} />
              </Card>

              <Card title="Tunnel de conversion">
                <FunnelRow icon="DM" name="DMs envoyes" val={wDms} rate={null} />
                <FunnelRow icon="RDV" name="RDVs pris" val={wRdvs} rate={wDms > 0 ? (wRdvs / wDms * 100).toFixed(1) + '%' : '--'} />
                <FunnelRow icon="OK" name="RDVs honores" val={wRdvsA} rate={wRdvs > 0 ? (wRdvsA / wRdvs * 100).toFixed(1) + '%' : '--'} />
                <FunnelRow icon="W" name="Clients signes" val={wCli} rate={wRdvsA > 0 ? (wCli / wRdvsA * 100).toFixed(1) + '%' : '--'} />
              </Card>
            </div>

            {/* COL 2 - Week tracking + Predictions */}
            <div>
              <Card title={`Semaine S${week}`} className="mb-16">
                <WeekRow label="DMs" val={wDms} target={objectives.dms_target} />
                <WeekRow label="RDVs pris" val={wRdvs} target={objectives.rdvs_target} />
                <WeekRow label="RDVs honores" val={wRdvsA} target={objectives.rdvs_attended_target} />
                <WeekRow label="Clients signes" val={wCli} target={objectives.clients_target} />
                <WeekRow label="Reels" val={wReels} target={objectives.reels_target} />
                <WeekRow label="Followers" val={wFoll} target={objectives.followers_target} />
              </Card>

              <Card title="Predictions" className="mb-16">
                <PredRow label="DMs" pct={pDms} />
                <PredRow label="RDVs" pct={pRdvs} />
                <PredRow label="Clients" pct={pCli} />
                <PredRow label="Reels" pct={pReels} />
                <PredRow label="Followers" pct={pFoll} />
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Projection MRR fin S{week}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>{(mrr.total + wCli * avgPrice).toLocaleString('fr-FR')}EUR</div>
                </div>
              </Card>

              <Card>
                <div style={{ textAlign: 'center', padding: 14, background: 'var(--primary-glow)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{mText}</div>
                </div>
              </Card>
            </div>

            {/* COL 3 - KPIs + Forecast */}
            <div>
              <Card title="Metriques cles" className="mb-16">
                <MetricRow label="Taux DM -> Client" val={dmToClient} />
                <MetricRow label="CAC (Cout acquisition)" val={cac} />
                <MetricRow label="LTV moyen" val={`${ltv}EUR`} />
                <MetricRow label="ROI Meta Ads" val={roi} />
                <MetricRow label="Taux de churn" val={churn} />
                <MetricRow label="Prix moyen / client" val={`${avgPrice}EUR/mois`} />
              </Card>

              <Card title="Reel vs Previsionnel">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <ForecastCard label="Clients" real={mrr.count} forecast={fcClients} delta={deltaCli} />
                  <ForecastCard label="MRR" real={mrr.total} forecast={fcMrr} delta={deltaMrr} suffix="EUR" />
                  <ForecastCard label="Followers" real={totalFollowers} forecast={fcFollowers} delta={deltaFoll} />
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && (() => {
        const payStatusMap: Record<string, { label: string; color: string }> = {
          active: { label: 'Actif', color: '#22c55e' },
          pending: { label: 'En attente', color: '#f59e0b' },
          past_due: { label: 'Impaye', color: '#ef4444' },
          canceled: { label: 'Annule', color: '#ef4444' },
          completed: { label: 'Termine', color: '#6366f1' },
          free: { label: 'Gratuit', color: '#22c55e' },
        }
        return (
          <>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              <div className={styles.bizKpi}>
                <div className={styles.bizKpiLabel}>MRR Stripe</div>
                <div className={styles.bizKpiValue} style={{ color: 'var(--success)' }}>{(stripeMrr / 100).toLocaleString('fr-FR')}EUR</div>
                <div className={styles.bizKpiSub}>{activePlans.length} abonnement{activePlans.length > 1 ? 's' : ''} actif{activePlans.length > 1 ? 's' : ''}</div>
              </div>
              <div className={styles.bizKpi}>
                <div className={styles.bizKpiLabel}>Revenu total</div>
                <div className={styles.bizKpiValue}>{(totalRevenue / 100).toLocaleString('fr-FR')}EUR</div>
                <div className={styles.bizKpiSub}>{athletePayments.filter(p => p.status === 'succeeded').length} paiement{athletePayments.filter(p => p.status === 'succeeded').length > 1 ? 's' : ''}</div>
              </div>
              <div className={styles.bizKpi}>
                <div className={styles.bizKpiLabel}>En attente</div>
                <div className={styles.bizKpiValue} style={{ color: '#f59e0b' }}>{pendingPlans.length}</div>
                <div className={styles.bizKpiSub}>plan{pendingPlans.length > 1 ? 's' : ''} en attente</div>
              </div>
              <div className={styles.bizKpi}>
                <div className={styles.bizKpiLabel}>Total athletes</div>
                <div className={styles.bizKpiValue}>{athletePaymentPlans.length}</div>
                <div className={styles.bizKpiSub}>avec un plan de paiement</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Active subscriptions */}
              <Card title="Abonnements athletes" headerRight={
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{athletePaymentPlans.length} plan{athletePaymentPlans.length > 1 ? 's' : ''}</span>
              }>
                {athletePaymentPlans.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>
                    Aucun plan de paiement configure
                  </div>
                ) : (
                  <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                    {athletePaymentPlans.map((plan) => {
                      const a = athletes[plan.athlete_id]
                      const name = a ? `${a.prenom} ${a.nom}`.trim() : plan.athlete_id
                      const st = payStatusMap[plan.payment_status] || payStatusMap.pending
                      const amtLabel = plan.is_free ? 'Gratuit' :
                        `${(plan.amount / 100).toFixed(0)}EUR/${plan.frequency === 'month' ? 'mois' : plan.frequency === 'week' ? 'sem' : 'jour'}`
                      return (
                        <div key={plan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{amtLabel}</div>
                          </div>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                            color: st.color, background: `${st.color}18`,
                          }}>
                            {st.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>

              {/* Payment history */}
              <Card title="Historique des paiements" headerRight={
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{athletePayments.length} paiement{athletePayments.length > 1 ? 's' : ''}</span>
              }>
                {athletePayments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>
                    Aucun paiement enregistre
                  </div>
                ) : (
                  <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                    {athletePayments.map((p) => {
                      const a = athletes[p.athlete_id]
                      const name = a ? `${a.prenom} ${a.nom}`.trim() : ''
                      const date = new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                      const ok = p.status === 'succeeded'
                      return (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{(p.amount / 100).toFixed(2)} {(p.currency || 'eur').toUpperCase()}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                              {name}{name ? ' — ' : ''}{date}{p.description ? ` — ${p.description}` : ''}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                            color: ok ? '#22c55e' : '#ef4444',
                            background: ok ? 'rgba(34,197,94,0.13)' : 'rgba(239,68,68,0.13)',
                          }}>
                            {ok ? 'Paye' : 'Echoue'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          </>
        )
      })()}

      {/* Objectives Tab */}
      {tab === 'objectives' && (
        <>
          {kpiBar}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 900 }}>
            <Card title="Objectifs hebdo" headerRight={<span style={{ fontSize: 11, color: 'var(--text3)' }}>a partir de S{week}</span>}>
              {(['dms_target', 'rdvs_target', 'rdvs_attended_target', 'clients_target', 'reels_target', 'followers_target'] as const).map(key => (
                <div key={key} className={styles.bizDataRow}>
                  <span className={styles.bizDataLabel} style={{ minWidth: 130 }}>
                    {{ dms_target: 'DMs / semaine', rdvs_target: 'RDVs / semaine', rdvs_attended_target: 'RDVs honores', clients_target: 'Clients / semaine', reels_target: 'Reels / semaine', followers_target: 'Followers / semaine' }[key]}
                  </span>
                  <input
                    type="number" value={editObj[key]}
                    className={styles.bizDataInput}
                    onChange={e => setEditObj(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              ))}
              <div style={{ marginTop: 16 }}>
                <Button variant="red" onClick={saveWeeklyObj}><i className="fas fa-check" /> Sauvegarder</Button>
              </div>
            </Card>

            <Card title="Historique">
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {Array.from({ length: 16 }, (_, i) => i + 1).map(w => {
                  const we = allEntries.filter(e => e.week_number === w)
                  const wkDms = sumField(we, 'dms')
                  const wkCli = sumField(we, 'clients_online') + sumField(we, 'clients_offline')
                  const wkFilled = new Set(we.map(e => e.day_name)).size
                  const cur = w === week
                  const isOpen = openWeeks.has(w)
                  return (
                    <div key={w}>
                      <div
                        className={styles.bizWkHdr}
                        style={cur ? { borderLeft: '3px solid var(--primary)' } : undefined}
                        onClick={() => setOpenWeeks(prev => {
                          const next = new Set(prev)
                          if (next.has(w)) next.delete(w); else next.add(w)
                          return next
                        })}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{cur ? '> ' : ''}Semaine {w}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{wkFilled}/6 jours &middot; {wkDms} DMs &middot; {wkCli} clients</span>
                      </div>
                      {isOpen && (
                        <div className={`${styles.bizWkBody} ${styles.bizWkBodyOpen}`}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
                            {[
                              { v: sumField(we, 'dms'), l: 'DMs' },
                              { v: sumField(we, 'rdvs'), l: 'RDVs' },
                              { v: sumField(we, 'rdvs_attended'), l: 'Honores' },
                              { v: wkCli, l: 'Clients' },
                              { v: sumField(we, 'reels'), l: 'Reels' },
                              { v: sumField(we, 'followers'), l: 'Followers' },
                            ].map(({ v, l }) => (
                              <div key={l} className={styles.bizRecap}>
                                <div style={{ fontSize: 16, fontWeight: 700 }}>{v}</div>
                                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{l}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Clients Tab */}
      {tab === 'clients' && (() => {
        const active = clients.filter(c => c.status === 'active')
        const archived = clients.filter(c => c.status === 'archived')
        const online = active.filter(c => c.client_type === 'online')
        const offline = active.filter(c => c.client_type === 'offline')
        return (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{active.length} clients actifs</span>
                <span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 12 }}>MRR {mrr.total.toLocaleString('fr-FR')}EUR</span>
              </div>
              <Button variant="red" onClick={openAddClient}><i className="fas fa-plus" /> Ajouter</Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card title="Online" headerRight={<span style={{ fontSize: 12, color: 'var(--text3)' }}>{online.length} &middot; {mrr.online.toLocaleString('fr-FR')}EUR/mois</span>}>
                {online.length ? online.map(c => (
                  <ClientRow key={c.id} client={c} stripeData={stripeData} onEdit={openEditClient} onArchive={openArchive} onPayLink={copyPayLink} onPayHistory={openPaymentHistory} />
                )) : <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 12 }}>Aucun client online</div>}
              </Card>
              <Card title="Presentiel" headerRight={<span style={{ fontSize: 12, color: 'var(--text3)' }}>{offline.length} &middot; {mrr.offline.toLocaleString('fr-FR')}EUR/mois</span>}>
                {offline.length ? offline.map(c => (
                  <ClientRow key={c.id} client={c} stripeData={stripeData} onEdit={openEditClient} onArchive={openArchive} onPayLink={copyPayLink} onPayHistory={openPaymentHistory} />
                )) : <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 12 }}>Aucun client presentiel</div>}
              </Card>
            </div>
            {archived.length > 0 && (
              <Card title={`Archives (${archived.length})`} className="mt-16">
                {archived.map(c => (
                  <div key={c.id} className={styles.bizClientRow} style={{ opacity: 0.5 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{c.archive_reason || 'Archive'}</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>{c.price}EUR/mois</span>
                  </div>
                ))}
              </Card>
            )}
          </>
        )
      })()}

      {/* Objective Config Modal */}
      <Modal isOpen={showObjModal} onClose={() => setShowObjModal(false)} title="Configurer l'objectif">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Nom de l&apos;objectif</label>
            <input type="text" className="field-input" value={objName} onChange={e => setObjName(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>MRR cible (EUR)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {[3000, 5000, 10000, 15000, 20000].map(v => (
                <button key={v} className={`np-option-pill ${objMrr === v ? 'active' : ''}`} onClick={() => setObjMrr(v)}>{v / 1000}K</button>
              ))}
            </div>
            <input type="number" className="field-input" value={objMrr} onChange={e => setObjMrr(parseInt(e.target.value) || 10000)} style={{ marginTop: 6 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Deadline</label>
            <input type="date" className="field-input" value={objDeadline} onChange={e => setObjDeadline(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Semaine actuelle</label>
            <input type="number" className="field-input" value={objWeek} min={1} onChange={e => setObjWeek(parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Followers au demarrage</label>
            <input type="number" className="field-input" value={objFollowers} onChange={e => setObjFollowers(parseInt(e.target.value) || 0)} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="outline" size="sm" onClick={() => setShowObjModal(false)}>Annuler</Button>
            <Button variant="red" onClick={saveObjectiveConfig}><i className="fas fa-check" style={{ marginRight: 4 }} />Sauvegarder</Button>
          </div>
        </div>
      </Modal>

      {/* Client Modal */}
      <Modal isOpen={showClientModal} onClose={() => setShowClientModal(false)} title={editingClient ? 'Modifier le client' : 'Ajouter un client'}>
        <div style={{ padding: '16px 0' }}>
          <div className="form-row">
            <div className="form-group"><label>Nom</label><input type="text" value={cName} onChange={e => setCName(e.target.value)} /></div>
            <div className="form-group"><label>Email</label><input type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="Pour lien Stripe" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Prix (EUR/mois)</label><input type="number" value={cPrice} onChange={e => setCPrice(e.target.value)} min={1} /></div>
            <div className="form-group">
              <label>Type</label>
              <select value={cType} onChange={e => setCType(e.target.value as 'online' | 'offline')}>
                <option value="online">Online</option>
                <option value="offline">Presentiel</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Jour facturation</label><input type="text" value={cBilling} onChange={e => setCBilling(e.target.value)} /></div>
            <div className="form-group"><label>Date debut</label><input type="date" value={cStart} onChange={e => setCStart(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: editingClient ? 'space-between' : 'flex-end', marginTop: 16 }}>
            {editingClient && (
              <Button variant="outline" onClick={() => deleteClient(editingClient.id)} style={{ color: 'var(--danger)' }}>Supprimer</Button>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" onClick={() => setShowClientModal(false)}>Annuler</Button>
              <Button variant="red" onClick={submitClient}>{editingClient ? 'Sauvegarder' : 'Ajouter'}</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Archive Modal */}
      <Modal isOpen={showArchiveModal} onClose={() => setShowArchiveModal(false)} title="Archiver le client">
        <div style={{ padding: '16px 0' }}>
          <div className="form-group">
            <label>Raison (optionnel)</label>
            <input type="text" value={archiveReason} onChange={e => setArchiveReason(e.target.value)} placeholder="Ex: Fin de contrat..." />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Button variant="outline" onClick={() => setShowArchiveModal(false)}>Annuler</Button>
            <Button variant="red" onClick={archiveClient}>Archiver</Button>
          </div>
        </div>
      </Modal>

      {/* Payment History Modal */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title={`Paiements — ${paymentClientName}`}>
        <div style={{ padding: '16px 0' }}>
          {loadingPayments ? (
            <div style={{ textAlign: 'center', padding: 24 }}><i className="fas fa-spinner fa-spin" /></div>
          ) : paymentHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>Aucun paiement enregistre</div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {paymentHistory.map((p) => {
                const statusColors: Record<string, string> = { succeeded: '#22c55e', pending: '#f59e0b', failed: '#ef4444' }
                const statusLabels: Record<string, string> = { succeeded: 'Reussi', pending: 'En attente', failed: 'Echoue' }
                const date = new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{(p.amount / 100).toFixed(2)} {(p.currency || 'eur').toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{date}{p.description ? ` — ${p.description}` : ''}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${statusColors[p.status] || '#6b7280'}22`, color: statusColors[p.status] || '#6b7280', fontWeight: 600 }}>
                      {statusLabels[p.status] || p.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
