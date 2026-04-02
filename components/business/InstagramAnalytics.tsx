'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/instagram.module.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend)

// ── Types ──
interface IgAccount {
  id: string
  user_id: string
  ig_user_id: string
  ig_username: string
  access_token: string
  token_expires_at: string
  is_connected: boolean
  page_id?: string
  page_access_token?: string
  starting_followers?: number
  starting_date?: string
}
interface IgReel {
  id: string
  ig_media_id: string
  caption: string | null
  thumbnail_url: string | null
  video_url: string | null
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  reach: number
  plays: number
  engagement_rate: number
  published_at: string | null
  pillar_id?: string
  format?: string
}
interface IgPillar { id: string; name: string; color: string }
interface IgSnapshot { id: string; snapshot_date: string; followers: number; total_views: number; total_reach: number; new_followers: number; created_at: string }
interface IgGoal { id: string; quarter: string; metric: string; target_value: number }
interface IgStory {
  id: string
  ig_story_id: string
  ig_media_url: string | null
  thumbnail_url: string | null
  caption: string | null
  story_type: string
  impressions: number
  reach: number
  replies: number
  exits: number
  taps_forward: number
  taps_back: number
  published_at: string | null
}
interface IgProfile {
  username?: string
  name?: string
  biography?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
  profile_picture_url?: string
}

const META_APP_ID_KEY = 'meta-app-id'
const IG_REDIRECT_URI = typeof window !== 'undefined' ? window.location.origin + '/' : ''

const PERIODS = [
  { key: '7d', label: '7 jours', days: 7 },
  { key: '30d', label: '30 jours', days: 30 },
  { key: '90d', label: '90 jours', days: 90 },
  { key: '6m', label: '6 mois', days: 180 },
  { key: '1y', label: '1 an', days: 365 },
]

const GOAL_METRICS = [
  { key: 'followers', label: 'Followers', icon: 'fa-users' },
  { key: 'monthly_views', label: 'Monthly Views', icon: 'fa-eye' },
  { key: 'engagement_rate', label: 'Engagement Rate (%)', icon: 'fa-heart' },
  { key: 'weekly_output', label: 'Reels / semaine', icon: 'fa-film' },
  { key: 'dms_month', label: 'DMs / mois', icon: 'fa-envelope' },
  { key: 'viral_reels', label: 'Reels viraux (100K+)', icon: 'fa-fire' },
]

function getQuarter(date?: Date) {
  const d = date || new Date()
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${d.getFullYear()}-Q${q}`
}

function periodRange(key: string) {
  const p = PERIODS.find((x) => x.key === key) || PERIODS[1]
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  start.setDate(start.getDate() - p.days)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default function InstagramAnalytics() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'general' | 'stories' | 'reels' | 'overview'>('general')
  const [period, setPeriod] = useState('30d')
  const [account, setAccount] = useState<IgAccount | null>(null)
  const [reels, setReels] = useState<IgReel[]>([])
  const [pillars, setPillars] = useState<IgPillar[]>([])
  const [snapshots, setSnapshots] = useState<IgSnapshot[]>([])
  const [goals, setGoals] = useState<IgGoal[]>([])
  const [stories, setStories] = useState<IgStory[]>([])
  const [profile, setProfile] = useState<IgProfile>({})
  const [syncing, setSyncing] = useState(false)

  // Modals
  const [goalsModalOpen, setGoalsModalOpen] = useState(false)
  const [goalsQuarter, setGoalsQuarter] = useState(getQuarter())
  const [goalValues, setGoalValues] = useState<Record<string, string>>({})
  const [reelModalOpen, setReelModalOpen] = useState(false)
  const [selectedReel, setSelectedReel] = useState<IgReel | null>(null)
  const [pillarModalOpen, setPillarModalOpen] = useState(false)
  const [editingPillar, setEditingPillar] = useState<IgPillar | null>(null)
  const [pillarName, setPillarName] = useState('')
  const [pillarColor, setPillarColor] = useState('#3b82f6')

  // Chart refs
  const growthChartRef = useRef<ChartJS<'line'>>(null)
  const formatChartRef = useRef<ChartJS<'bar'>>(null)
  const pillarsChartRef = useRef<ChartJS<'doughnut'>>(null)

  // ── OAuth callback check ──
  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    let code = params.get('code')
    if (!code || params.get('state') === 'fb_page_auth') return
    code = code.replace(/#_$/, '').replace(/#$/, '')

    window.history.replaceState({}, '', window.location.pathname)
    toast('Connexion Instagram en cours...')

    const exchangeCode = async () => {
      try {
        const resp = await fetch('/api/instagram/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: window.location.origin + '/' }),
        })
        const data = await resp.json()
        if (!resp.ok || data.error) {
          toast('Erreur Instagram: ' + (data.error || `HTTP ${resp.status}`), 'error')
          return
        }
        await supabase.from('ig_accounts').delete().eq('user_id', user.id)
        const insertData: Record<string, unknown> = {
          user_id: user.id,
          ig_user_id: data.ig_user_id || '',
          ig_username: data.ig_username || '',
          access_token: data.access_token,
          token_expires_at: new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString(),
          is_connected: true,
        }
        if (data.page_id) insertData.page_id = data.page_id
        if (data.page_access_token) insertData.page_access_token = data.page_access_token
        const { error } = await supabase.from('ig_accounts').insert(insertData)
        if (error) { toast('Erreur sauvegarde: ' + error.message, 'error'); return }
        toast(`Instagram @${data.ig_username} connecte !`)
        loadData()
      } catch {
        toast('Erreur de connexion Instagram', 'error')
      }
    }
    exchangeCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ── Load all data ──
  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [acctRes, reelsRes, pillarsRes, snapshotsRes, goalsRes, storiesRes] = await Promise.all([
        supabase.from('ig_accounts').select('*').eq('user_id', user.id).single(),
        supabase.from('ig_reels').select('*').eq('user_id', user.id).order('published_at', { ascending: false }),
        supabase.from('ig_content_pillars').select('*').eq('user_id', user.id).order('name'),
        supabase.from('ig_snapshots').select('*').eq('user_id', user.id).order('snapshot_date', { ascending: true }),
        supabase.from('ig_goals').select('*').eq('user_id', user.id),
        supabase.from('ig_stories').select('*').eq('user_id', user.id).order('published_at', { ascending: false }),
      ])
      const acct = acctRes.data as IgAccount | null
      setAccount(acct)
      setReels((reelsRes.data || []) as IgReel[])
      setPillars((pillarsRes.data || []) as IgPillar[])
      setSnapshots((snapshotsRes.data || []) as IgSnapshot[])
      setGoals((goalsRes.data || []) as IgGoal[])
      setStories((storiesRes.data || []) as IgStory[])

      // Fetch live profile
      if (acct?.access_token) {
        try {
          const resp = await fetch(`https://graph.instagram.com/v25.0/me?fields=username,name,biography,followers_count,follows_count,media_count,profile_picture_url&access_token=${acct.access_token}`)
          const p = await resp.json()
          if (!p.error) setProfile(p)
        } catch { /* silent */ }
      }
    } catch {
      toast('Erreur chargement Instagram', 'error')
    } finally {
      setLoading(false)
    }
  }, [user, toast]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  // ── Sync data ──
  const syncData = useCallback(async () => {
    if (!account?.access_token || !user) return
    setSyncing(true)
    toast('Synchronisation Instagram...')
    try {
      // Sync reels
      const mediaRes = await fetch(`https://graph.instagram.com/v25.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=50&access_token=${account.access_token}`)
      const mediaData = await mediaRes.json()
      if (!mediaData.error && mediaData.data) {
        for (const item of mediaData.data) {
          const isVideo = item.media_type === 'VIDEO' || item.media_type === 'REELS'
          if (isVideo) {
            let reach = 0, saved = 0, shares = 0, totalViews = 0
            try {
              const iRes = await fetch(`https://graph.instagram.com/v25.0/${item.id}/insights?metric=views,reach,saved,shares&access_token=${account.access_token}`)
              const iData = await iRes.json()
              if (iData.data) {
                iData.data.forEach((m: { name: string; values?: { value: number }[] }) => {
                  if (m.name === 'views') totalViews = m.values?.[0]?.value || 0
                  if (m.name === 'reach') reach = m.values?.[0]?.value || 0
                  if (m.name === 'saved') saved = m.values?.[0]?.value || 0
                  if (m.name === 'shares') shares = m.values?.[0]?.value || 0
                })
              }
            } catch { /* silent */ }
            const views = totalViews || reach
            const totalEng = (item.like_count || 0) + (item.comments_count || 0) + saved + shares
            const engRate = reach > 0 ? (totalEng / reach) * 100 : 0
            await supabase.from('ig_reels').upsert(
              {
                user_id: user.id,
                ig_media_id: item.id,
                caption: item.caption || null,
                thumbnail_url: item.thumbnail_url || null,
                video_url: item.media_url || null,
                views,
                likes: item.like_count || 0,
                comments: item.comments_count || 0,
                shares,
                saves: saved,
                reach,
                plays: views,
                engagement_rate: parseFloat(engRate.toFixed(2)),
                published_at: item.timestamp,
              },
              { onConflict: 'ig_media_id' },
            )
          }
        }
      }

      // Snapshot
      try {
        const profileRes = await fetch(`https://graph.instagram.com/v25.0/me?fields=followers_count&access_token=${account.access_token}`)
        const pData = await profileRes.json()
        const { data: freshReels } = await supabase.from('ig_reels').select('views,reach').eq('user_id', user.id)
        const tv = (freshReels || []).reduce((s: number, r: { views: number }) => s + (r.views || 0), 0)
        const tr = (freshReels || []).reduce((s: number, r: { reach: number }) => s + (r.reach || 0), 0)
        await supabase.from('ig_snapshots').insert({
          user_id: user.id,
          snapshot_date: new Date().toISOString().slice(0, 10),
          followers: pData.followers_count || 0,
          total_views: tv,
          total_reach: tr,
          new_followers: (pData.followers_count || 0) - (account.starting_followers || 0),
        })
      } catch { /* silent */ }

      toast('Instagram synchronise !')
      await loadData()
    } catch {
      toast('Erreur de synchronisation', 'error')
    } finally {
      setSyncing(false)
    }
  }, [account, user, toast, loadData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connect Instagram ──
  const connectInstagram = () => {
    const appId = document.querySelector(`meta[name="${META_APP_ID_KEY}"]`)?.getAttribute('content')
    if (!appId) { toast('Instagram non configure. Contactez le support.', 'error'); return }
    const redirectUri = encodeURIComponent(IG_REDIRECT_URI)
    const scope = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights'
    window.location.href = `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&enable_fb_login=0`
  }

  // ── Disconnect ──
  const disconnectIg = async () => {
    if (!confirm('Deconnecter votre compte Instagram ?')) return
    await supabase.from('ig_accounts').delete().eq('user_id', user!.id)
    setAccount(null)
    toast('Instagram deconnecte')
  }

  // ── Goals ──
  const openGoalsModal = (quarter: string) => {
    setGoalsQuarter(quarter)
    const qGoals = goals.filter((g) => g.quarter === quarter)
    const vals: Record<string, string> = {}
    GOAL_METRICS.forEach((m) => {
      const existing = qGoals.find((g) => g.metric === m.key)
      vals[m.key] = existing ? String(existing.target_value) : ''
    })
    setGoalValues(vals)
    setGoalsModalOpen(true)
  }

  const saveGoals = async () => {
    const inserts: { user_id: string; quarter: string; metric: string; target_value: number }[] = []
    GOAL_METRICS.forEach((m) => {
      const val = parseFloat(goalValues[m.key] || '')
      if (!isNaN(val) && val > 0) {
        inserts.push({ user_id: user!.id, quarter: goalsQuarter, metric: m.key, target_value: val })
      }
    })
    await supabase.from('ig_goals').delete().eq('user_id', user!.id).eq('quarter', goalsQuarter)
    if (inserts.length) {
      const { error } = await supabase.from('ig_goals').insert(inserts)
      if (error) { toast('Erreur: ' + error.message, 'error'); return }
    }
    setGoalsModalOpen(false)
    toast('Objectifs enregistres !')
    loadData()
  }

  // ── Pillar CRUD ──
  const openPillarModal = (pillar?: IgPillar) => {
    setEditingPillar(pillar || null)
    setPillarName(pillar?.name || '')
    setPillarColor(pillar?.color || '#3b82f6')
    setPillarModalOpen(true)
  }

  const savePillar = async () => {
    if (!pillarName.trim()) { toast('Le nom est obligatoire', 'error'); return }
    if (editingPillar) {
      await supabase.from('ig_content_pillars').update({ name: pillarName, color: pillarColor }).eq('id', editingPillar.id)
    } else {
      await supabase.from('ig_content_pillars').insert({ user_id: user!.id, name: pillarName, color: pillarColor })
    }
    setPillarModalOpen(false)
    toast(editingPillar ? 'Pilier mis a jour' : 'Pilier cree')
    loadData()
  }

  const deletePillar = async (id: string) => {
    if (!confirm('Supprimer ce pilier ?')) return
    await supabase.from('ig_content_pillars').delete().eq('id', id)
    toast('Pilier supprime')
    loadData()
  }

  // ── Reel modal ──
  const openReelModal = (reel: IgReel) => {
    setSelectedReel(reel)
    setReelModalOpen(true)
  }

  // ── Derived data ──
  const quarter = getQuarter()
  const { start: pStart, end: pEnd } = periodRange(period)
  const filteredReels = reels.filter((r) => {
    if (!r.published_at) return false
    const d = new Date(r.published_at)
    return d >= pStart && d <= pEnd
  })
  const filteredSnapshots = snapshots.filter((s) => {
    const d = new Date(s.snapshot_date)
    return d >= pStart && d <= pEnd
  })

  const followers = profile.followers_count || 0
  const firstSnapshot = filteredSnapshots.length ? filteredSnapshots[0] : null
  const startFollowers = firstSnapshot ? firstSnapshot.followers : followers
  const newFollowers = followers - startFollowers
  const totalViews = filteredReels.reduce((s, r) => s + (r.views || 0), 0)
  const totalReach = filteredReels.reduce((s, r) => s + (r.reach || 0), 0)
  const totalInteractions = filteredReels.reduce((s, r) => s + (r.likes || 0) + (r.comments || 0) + (r.saves || 0) + (r.shares || 0), 0)
  const avgEngagement = reels.length ? (reels.reduce((s, r) => s + (r.engagement_rate || 0), 0) / reels.length).toFixed(2) : '0.00'

  // Format distribution
  const formats: Record<string, { views: number; count: number }> = {}
  filteredReels.forEach((r) => {
    const f = r.format || 'non_tagge'
    if (!formats[f]) formats[f] = { views: 0, count: 0 }
    formats[f].views += r.views || 0
    formats[f].count++
  })
  const hasFormats = filteredReels.some((r) => r.format)

  // Pillar distribution
  const pillarCounts: Record<string, number> = {}
  filteredReels.forEach((r) => {
    const pid = r.pillar_id || '_none'
    pillarCounts[pid] = (pillarCounts[pid] || 0) + 1
  })
  const hasPillarData = pillars.length > 0 && filteredReels.some((r) => r.pillar_id)

  // Quarter goals
  const qGoals = goals.filter((g) => g.quarter === quarter)

  const getGoalCurrent = (metric: string): number => {
    switch (metric) {
      case 'followers': return followers
      case 'monthly_views': return totalViews
      case 'engagement_rate': return parseFloat(avgEngagement)
      case 'weekly_output': {
        const now = new Date()
        const ws = new Date(now); ws.setDate(now.getDate() - now.getDay() + 1); ws.setHours(0, 0, 0, 0)
        return reels.filter((r) => r.published_at && new Date(r.published_at) >= ws).length
      }
      case 'viral_reels': return filteredReels.filter((r) => (r.views || 0) >= 100000).length
      default: return 0
    }
  }

  // ── Render ──
  if (loading) {
    return (
      <div className={styles.igPage}>
        <Skeleton height={40} width={300} />
        <Skeleton height={200} />
        <Skeleton height={300} />
      </div>
    )
  }

  if (!account) {
    return (
      <div className={styles.notConnected}>
        <i className={`fab fa-instagram ${styles.notConnectedIcon}`} />
        <div className={styles.notConnectedTitle}>Aucun compte connecte</div>
        <div className={styles.notConnectedDesc}>Connectez votre compte Instagram pour commencer</div>
        <button className="btn btn-red" onClick={connectInstagram}>
          <i className="fab fa-instagram" style={{ marginRight: 6 }} /> Connecter Instagram
        </button>
        <div className={styles.notConnectedHint}>Necessite un compte Instagram Business ou Creator</div>
      </div>
    )
  }

  return (
    <div className={styles.igPage}>
      {/* Tab navigation */}
      <div className={styles.igTabs}>
        {(['general', 'stories', 'reels', 'overview'] as const).map((t) => {
          const icons = { general: 'fa-chart-line', stories: 'fa-images', reels: 'fa-film', overview: 'fa-chart-pie' }
          const labels = { general: 'General', stories: 'Stories', reels: 'Reels', overview: 'Apercu' }
          return (
            <button key={t} className={`${styles.igTab} ${tab === t ? styles.igTabActive : ''}`} onClick={() => setTab(t)}>
              <i className={`fas ${icons[t]}`} /> {labels[t]}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'general' && (
        <GeneralTab
          period={period} setPeriod={setPeriod} filteredReels={filteredReels}
          filteredSnapshots={filteredSnapshots} profile={profile} followers={followers}
          newFollowers={newFollowers} totalViews={totalViews} totalReach={totalReach}
          totalInteractions={totalInteractions} formats={formats} hasFormats={hasFormats}
          pillars={pillars} pillarCounts={pillarCounts} hasPillarData={hasPillarData}
          qGoals={qGoals} quarter={quarter} getGoalCurrent={getGoalCurrent}
          firstSnapshot={firstSnapshot} syncData={syncData} syncing={syncing}
          openGoalsModal={openGoalsModal} openReelModal={openReelModal}
          growthChartRef={growthChartRef} formatChartRef={formatChartRef} pillarsChartRef={pillarsChartRef}
        />
      )}
      {tab === 'reels' && (
        <ReelsTab reels={reels} pillars={pillars} openReelModal={openReelModal} openPillarModal={openPillarModal} deletePillar={deletePillar} />
      )}
      {tab === 'stories' && <StoriesTab stories={stories} />}
      {tab === 'overview' && (
        <OverviewTab account={account} profile={profile} reels={reels} avgEngagement={avgEngagement} totalReach={totalReach} syncData={syncData} syncing={syncing} disconnectIg={disconnectIg} />
      )}

      {/* Goals Modal */}
      <Modal isOpen={goalsModalOpen} onClose={() => setGoalsModalOpen(false)} title={`Objectifs ${goalsQuarter.replace('-', ' ')}`}>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {GOAL_METRICS.map((m) => (
            <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', width: 160 }}>{m.label}</label>
              <input
                type="number"
                className="bt-input"
                value={goalValues[m.key] || ''}
                onChange={(e) => setGoalValues((v) => ({ ...v, [m.key]: e.target.value }))}
                placeholder="0"
                style={{ flex: 1 }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-outline" onClick={() => setGoalsModalOpen(false)}>Annuler</button>
            <button className="btn btn-red" onClick={saveGoals}>Enregistrer</button>
          </div>
        </div>
      </Modal>

      {/* Reel Modal */}
      <Modal isOpen={reelModalOpen} onClose={() => setReelModalOpen(false)} title={selectedReel?.published_at ? new Date(selectedReel.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Reel'}>
        {selectedReel && (
          <div style={{ padding: 16 }}>
            {selectedReel.video_url ? (
              <video src={selectedReel.video_url} controls autoPlay playsInline style={{ width: '100%', maxHeight: '70vh', background: '#000', borderRadius: 8 }} />
            ) : selectedReel.thumbnail_url ? (
              <img src={selectedReel.thumbnail_url} alt="" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', background: '#000', borderRadius: 8 }} />
            ) : (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>Video non disponible</div>
            )}
            <div className={styles.reelModalMetrics} style={{ marginTop: 12 }}>
              <span><i className="fas fa-eye" style={{ marginRight: 3 }} />{(selectedReel.views || 0).toLocaleString()}</span>
              <span><i className="fas fa-heart" style={{ marginRight: 3 }} />{selectedReel.likes || 0}</span>
              <span><i className="fas fa-comment" style={{ marginRight: 3 }} />{selectedReel.comments || 0}</span>
              <span><i className="fas fa-share" style={{ marginRight: 3 }} />{selectedReel.shares || 0}</span>
              <span><i className="fas fa-bookmark" style={{ marginRight: 3 }} />{selectedReel.saves || 0}</span>
              <span><i className="fas fa-bullseye" style={{ marginRight: 3 }} />{(selectedReel.reach || 0).toLocaleString()}</span>
            </div>
            <div className={styles.reelModalCaption}>{selectedReel.caption || ''}</div>
          </div>
        )}
      </Modal>

      {/* Pillar Modal */}
      <Modal isOpen={pillarModalOpen} onClose={() => setPillarModalOpen(false)} title={editingPillar ? 'Modifier le Pilier' : 'Nouveau Pilier'}>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Nom</label>
            <input type="text" className="bt-input" value={pillarName} onChange={(e) => setPillarName(e.target.value)} placeholder="Ex: Education fitness" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Couleur</label>
            <input type="color" value={pillarColor} onChange={(e) => setPillarColor(e.target.value)} style={{ width: 50, height: 32, border: 'none', cursor: 'pointer', background: 'transparent' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setPillarModalOpen(false)}>Annuler</button>
            <button className="btn btn-red" onClick={savePillar}>{editingPillar ? 'Enregistrer' : 'Creer'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════
// ── GENERAL TAB ──
// ═══════════════════════════════════════
function GeneralTab({
  period, setPeriod, filteredReels, filteredSnapshots, profile, followers, newFollowers,
  totalViews, totalReach, totalInteractions, formats, hasFormats, pillars, pillarCounts,
  hasPillarData, qGoals, quarter, getGoalCurrent, firstSnapshot, syncData, syncing,
  openGoalsModal, openReelModal, growthChartRef, formatChartRef, pillarsChartRef,
}: {
  period: string; setPeriod: (p: string) => void; filteredReels: IgReel[]; filteredSnapshots: IgSnapshot[]
  profile: IgProfile; followers: number; newFollowers: number; totalViews: number; totalReach: number
  totalInteractions: number; formats: Record<string, { views: number; count: number }>; hasFormats: boolean
  pillars: IgPillar[]; pillarCounts: Record<string, number>; hasPillarData: boolean
  qGoals: IgGoal[]; quarter: string; getGoalCurrent: (m: string) => number
  firstSnapshot: IgSnapshot | null; syncData: () => void; syncing: boolean
  openGoalsModal: (q: string) => void; openReelModal: (r: IgReel) => void
  growthChartRef: React.RefObject<ChartJS<'line'> | null>; formatChartRef: React.RefObject<ChartJS<'bar'> | null>; pillarsChartRef: React.RefObject<ChartJS<'doughnut'> | null>
}) {
  const periodLabel = PERIODS.find((p) => p.key === period)?.label || period
  const sortedReels = [...filteredReels].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8)
  const currentViews = filteredReels.reduce((s, r) => s + (r.views || 0), 0)
  const bestReelViews = filteredReels.length ? Math.max(...filteredReels.map((r) => r.views || 0)) : 0

  // Chart data
  const growthData = filteredSnapshots.length ? {
    labels: filteredSnapshots.map((s) => new Date(s.snapshot_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })),
    datasets: [
      { label: 'Followers', data: filteredSnapshots.map((s) => s.followers || 0), borderColor: '#3b82f6', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3 },
      { label: 'Views', data: filteredSnapshots.map((s) => s.total_views || 0), borderColor: '#eab308', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3 },
      { label: 'Reached', data: filteredSnapshots.map((s) => s.total_reach || 0), borderColor: '#22c55e', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3 },
    ],
  } : null

  const formatColors: Record<string, string> = { talking_head: '#3b82f6', text_overlay: '#f59e0b', raw_documentary: '#ef4444' }
  const formatLabels: Record<string, string> = { talking_head: 'Talking Head', text_overlay: 'Text Overlay', raw_documentary: 'Raw/Documentary' }
  const formatKeys = Object.keys(formats).filter((k) => k !== 'non_tagge')

  const activePillars = pillars.filter((p) => pillarCounts[p.id])

  return (
    <>
      {/* Period selector + Sync */}
      <div className={styles.periodRow}>
        {PERIODS.map((p) => (
          <button key={p.key} className={`${styles.periodPill} ${p.key === period ? styles.periodPillActive : ''}`} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={syncData} disabled={syncing}>
          <i className={`fas fa-sync ${syncing ? 'fa-spin' : ''}`} style={{ marginRight: 4 }} /> Sync
        </button>
      </div>

      {/* KPI Row */}
      <div className={styles.kpiRow}>
        {[
          { label: 'Followers', value: followers.toLocaleString(), color: 'var(--success)' },
          { label: 'New', value: (newFollowers >= 0 ? '+' : '') + newFollowers.toLocaleString() },
          { label: 'Views', value: totalViews.toLocaleString(), color: 'var(--primary)' },
          { label: 'Reached', value: totalReach.toLocaleString() },
          { label: 'Interactions', value: totalInteractions.toLocaleString() },
          { label: 'Posted', value: String(filteredReels.length) },
        ].map((k) => (
          <div key={k.label} className={styles.kpiCard}>
            <div className={styles.kpiValue} style={k.color ? { color: k.color } : undefined}>{k.value}</div>
            <div className={styles.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Two-column grid */}
      <div className={styles.gridTwo}>
        <div className={styles.colStack}>
          {/* Growth chart */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Growth Trend</h4>
            {growthData ? (
              <div className={styles.chartContainer}>
                <Line ref={growthChartRef} data={growthData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#888', font: { size: 11 } } } }, scales: { x: { grid: { color: '#333' }, ticks: { color: '#888', font: { size: 10 } } }, y: { grid: { color: '#333' }, ticks: { color: '#888', font: { size: 10 } } } } }} />
              </div>
            ) : (
              <div className={styles.sectionEmpty}><i className={`fas fa-chart-line ${styles.sectionEmptyIcon}`} />Aucun historique</div>
            )}
          </div>

          {/* Format chart */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Performance par Format</h4>
            {hasFormats ? (
              <div className={styles.chartContainerSmall}>
                <Bar ref={formatChartRef} data={{
                  labels: formatKeys.map((k) => formatLabels[k] || k),
                  datasets: [{ label: 'Avg Views', data: formatKeys.map((k) => formats[k].count > 0 ? Math.round(formats[k].views / formats[k].count) : 0), backgroundColor: formatKeys.map((k) => formatColors[k] || '#6b7280'), borderRadius: 4 }],
                }} options={{ indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#333' }, ticks: { color: '#888', font: { size: 10 } } }, y: { grid: { display: false }, ticks: { color: '#888', font: { size: 11 } } } } }} />
              </div>
            ) : (
              <div className={styles.sectionEmpty}><i className={`fas fa-tags ${styles.sectionEmptyIcon}`} />Aucun reel tagge</div>
            )}
          </div>
        </div>

        <div className={styles.colStack}>
          {/* Evolution */}
          <div className={styles.section} style={{ overflow: 'hidden' }}>
            <div className={styles.evolutionBar} />
            <div style={{ padding: '20px 0 0' }}>
              <h4 className={styles.sectionTitle}>Evolution ({periodLabel})</h4>
              {firstSnapshot ? (
                <>
                  <EvolutionLine label="Followers" before={firstSnapshot.followers.toLocaleString()} after={followers.toLocaleString()} diff={followers - firstSnapshot.followers} />
                  <EvolutionLine label="Views" before={(firstSnapshot.total_views || 0).toLocaleString()} after={currentViews.toLocaleString()} diff={currentViews - (firstSnapshot.total_views || 0)} />
                  <EvolutionLine label="Best Reel" before="--" after={bestReelViews.toLocaleString()} diff={0} />
                </>
              ) : (
                <div className={styles.sectionEmpty}>Pas encore de donnees sur cette periode.</div>
              )}
            </div>
          </div>

          {/* Goals */}
          <div className={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 className={styles.sectionTitle} style={{ margin: 0 }}>{quarter.replace('-', ' ')} Goals</h4>
              <button className="btn btn-outline btn-sm" onClick={() => openGoalsModal(quarter)}>
                <i className="fas fa-pen" style={{ marginRight: 4 }} />Modifier
              </button>
            </div>
            {qGoals.length ? (
              qGoals.map((g) => {
                const meta = GOAL_METRICS.find((m) => m.key === g.metric) || { label: g.metric, icon: 'fa-bullseye' }
                const current = getGoalCurrent(g.metric)
                const pct = g.target_value > 0 ? Math.min(100, Math.round((current / g.target_value) * 100)) : 0
                return (
                  <div key={g.id} className={styles.goalBar}>
                    <div className={styles.goalHeader}>
                      <span className={styles.goalLabel}><i className={`fas ${meta.icon} ${styles.goalLabelIcon}`} />{meta.label}</span>
                      <span className={styles.goalProgress}>{current.toLocaleString()} / {Number(g.target_value).toLocaleString()}</span>
                    </div>
                    <div className={styles.goalTrack}>
                      <div className={styles.goalFill} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className={styles.sectionEmpty}>
                Aucun objectif defini
                <br />
                <button className="btn btn-red btn-sm" style={{ marginTop: 8 }} onClick={() => openGoalsModal(quarter)}>
                  <i className="fas fa-plus" style={{ marginRight: 4 }} />Definir des objectifs
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top reels */}
      {sortedReels.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Top Performing Reels</h4>
          <div className="nd-table-wrap">
            <table className="nd-table">
              <thead><tr><th>#</th><th></th><th>Caption</th><th>Pillar</th><th>Views</th><th>Saves</th><th>Shares</th></tr></thead>
              <tbody>
                {sortedReels.map((r, idx) => {
                  const pillar = pillars.find((p) => p.id === r.pillar_id)
                  return (
                    <tr key={r.id} className="nd-tr" style={{ cursor: 'pointer' }} onClick={() => openReelModal(r)}>
                      <td style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>#{idx + 1}</td>
                      <td style={{ padding: '6px 8px' }}>
                        {r.thumbnail_url ? <img src={r.thumbnail_url} alt="" className={styles.reelThumb} /> : <div className={styles.reelThumbPlaceholder}><i className="fas fa-film" style={{ fontSize: 10, color: 'var(--text3)' }} /></div>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text)', maxWidth: 200 }}>{(r.caption || '').slice(0, 50)}{(r.caption || '').length > 50 ? '...' : ''}</td>
                      <td>{pillar ? <span className={styles.pillarTag} style={{ background: `${pillar.color}20`, color: pillar.color }}>{pillar.name}</span> : <span style={{ color: 'var(--text3)', fontSize: 10 }}>--</span>}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{(r.views || 0).toLocaleString()}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{r.saves || 0}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{r.shares || 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Content Pillars Distribution */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Content Pillars Distribution</h4>
        {hasPillarData ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
            <div className={styles.chartContainerDoughnut}>
              <Doughnut ref={pillarsChartRef} data={{
                labels: activePillars.map((p) => p.name),
                datasets: [{ data: activePillars.map((p) => pillarCounts[p.id] || 0), backgroundColor: activePillars.map((p) => p.color || '#6b7280'), borderWidth: 0 }],
              }} options={{ responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } }} />
            </div>
            <div>
              {activePillars.map((p) => {
                const count = pillarCounts[p.id] || 0
                const pct = filteredReels.length ? Math.round((count / filteredReels.length) * 100) : 0
                return (
                  <div key={p.id} className={styles.pillarLegendRow}>
                    <div className={styles.pillarDot} style={{ background: p.color || '#6b7280' }} />
                    <span className={styles.pillarLegendName}>{p.name}</span>
                    <span className={styles.pillarLegendCount}>{pct}% ({count})</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className={styles.sectionEmpty}>Assignez des piliers a vos reels pour voir la repartition</div>
        )}
      </div>
    </>
  )
}

function EvolutionLine({ label, before, after, diff }: { label: string; before: string; after: string; diff: number }) {
  return (
    <div className={styles.evolutionLine}>
      <span className={styles.evolutionLabel}>{label}</span>
      <div className={styles.evolutionValues}>
        <span className={styles.evolutionBefore}>{before}</span>
        <span className={styles.evolutionArrow}>&rarr;</span>
        <span className={styles.evolutionAfter}>{after}</span>
        {diff > 0 && <span className={styles.evolutionDiffPos}>+{diff.toLocaleString()}</span>}
        {diff < 0 && <span className={styles.evolutionDiffNeg}>{diff.toLocaleString()}</span>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// ── REELS TAB ──
// ═══════════════════════════════════════
function ReelsTab({ reels, pillars, openReelModal, openPillarModal, deletePillar }: {
  reels: IgReel[]; pillars: IgPillar[]; openReelModal: (r: IgReel) => void
  openPillarModal: (p?: IgPillar) => void; deletePillar: (id: string) => void
}) {
  if (!reels.length && !pillars.length) {
    return (
      <div className={styles.notConnected}>
        <i className={`fas fa-film ${styles.notConnectedIcon}`} />
        <div className={styles.notConnectedTitle}>Aucun reel importe</div>
        <div className={styles.notConnectedDesc}>Connectez votre Instagram pour importer vos reels</div>
      </div>
    )
  }

  const totalViews = reels.reduce((s, r) => s + (r.views || 0), 0)
  const avgEng = reels.length ? (reels.reduce((s, r) => s + (r.engagement_rate || 0), 0) / reels.length).toFixed(2) : '0'
  const avgReach = reels.length ? Math.round(reels.reduce((s, r) => s + (r.reach || 0), 0) / reels.length) : 0
  const sorted = [...reels].sort((a, b) => (b.views || 0) - (a.views || 0))

  return (
    <>
      <div className={styles.gridFour}>
        {[
          { label: 'Total Views', value: totalViews.toLocaleString(), icon: 'fa-play' },
          { label: 'Avg Engagement', value: avgEng + '%', icon: 'fa-heart' },
          { label: 'Total Reels', value: String(reels.length), icon: 'fa-film' },
          { label: 'Avg Reach', value: avgReach.toLocaleString(), icon: 'fa-bullseye' },
        ].map((k) => (
          <div key={k.label} className={styles.kpiCard}>
            <i className={`fas ${k.icon} ${styles.kpiIcon}`} />
            <div className={styles.kpiValue}>{k.value}</div>
            <div className={styles.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      {reels.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Top Performing Reels</h4>
          <div className="nd-table-wrap">
            <table className="nd-table">
              <thead><tr><th></th><th>Caption</th><th>Pillar</th><th>Views</th><th>Saves</th><th>Shares</th><th>Comments</th></tr></thead>
              <tbody>
                {sorted.map((r) => {
                  const pillar = pillars.find((p) => p.id === r.pillar_id)
                  return (
                    <tr key={r.id} className="nd-tr" style={{ cursor: 'pointer' }} onClick={() => openReelModal(r)}>
                      <td style={{ padding: '6px 8px' }}>
                        {r.thumbnail_url ? <img src={r.thumbnail_url} alt="" className={styles.reelThumb} /> : <div className={styles.reelThumbPlaceholder}><i className="fas fa-film" style={{ fontSize: 12, color: 'var(--text3)' }} /></div>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text)', maxWidth: 200 }}>{(r.caption || '').slice(0, 50)}{(r.caption || '').length > 50 ? '...' : ''}</td>
                      <td>{pillar ? <span className={styles.pillarTag} style={{ background: `${pillar.color}20`, color: pillar.color }}>{pillar.name}</span> : '--'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{(r.views || 0).toLocaleString()}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{r.saves || 0}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{r.shares || 0}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{r.comments || 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Content Pillars */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Content Pillars</h3>
        <button className="btn btn-red btn-sm" onClick={() => openPillarModal()}>
          <i className="fas fa-plus" style={{ marginRight: 4 }} />Ajouter
        </button>
      </div>
      {pillars.length ? pillars.map((p) => (
        <div key={p.id} className={styles.pillarItem}>
          <div className={styles.pillarItemLeft}>
            <div className={styles.pillarDot} style={{ background: p.color || '#6b7280' }} />
            <span className={styles.pillarItemName}>{p.name}</span>
            <span className={styles.pillarItemCount}>{reels.filter((r) => r.pillar_id === p.id).length} reels</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-outline btn-sm" onClick={() => openPillarModal(p)} title="Modifier"><i className="fas fa-pen" style={{ fontSize: 10 }} /></button>
            <button className="btn btn-outline btn-sm" onClick={() => deletePillar(p.id)} title="Supprimer" style={{ color: 'var(--danger)' }}><i className="fas fa-trash" style={{ fontSize: 10 }} /></button>
          </div>
        </div>
      )) : <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 12 }}>Aucun pilier de contenu defini</div>}
    </>
  )
}

// ═══════════════════════════════════════
// ── STORIES TAB ──
// ═══════════════════════════════════════
function StoriesTab({ stories }: { stories: IgStory[] }) {
  if (!stories.length) {
    return (
      <div className={styles.notConnected}>
        <i className={`fas fa-images ${styles.notConnectedIcon}`} />
        <div className={styles.notConnectedTitle}>Aucune story</div>
        <div className={styles.notConnectedDesc}>Les stories sont synchronisees automatiquement (dernieres 24h)</div>
      </div>
    )
  }

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Stories recentes</h3>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
        {stories.map((s) => (
          <div key={s.id} className={styles.miniStoryCard}>
            <div className={styles.miniStoryMedia}>
              {(s.thumbnail_url || s.ig_media_url) ? (
                <img src={s.thumbnail_url || s.ig_media_url || ''} alt="" />
              ) : (
                <i className="fas fa-image" style={{ fontSize: 20, color: 'var(--text3)', opacity: 0.3 }} />
              )}
            </div>
            <div className={styles.miniStoryStats}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>
                <span><strong>{s.impressions || 0}</strong> vues</span>
                <span><strong>{s.reach || 0}</strong> reach</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)' }}>
                <span>{s.replies || 0} DMs</span>
                <span>{s.exits || 0} nav</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// ── OVERVIEW TAB ──
// ═══════════════════════════════════════
function OverviewTab({ account, profile, reels, avgEngagement, totalReach, syncData, syncing, disconnectIg }: {
  account: IgAccount; profile: IgProfile; reels: IgReel[]; avgEngagement: string; totalReach: number
  syncData: () => void; syncing: boolean; disconnectIg: () => void
}) {
  return (
    <>
      <div className={styles.profileRow}>
        <div className={styles.profileAvatar}>
          {profile.profile_picture_url ? <img src={profile.profile_picture_url} alt="" /> : <i className="fab fa-instagram" style={{ color: '#fff', fontSize: 22 }} />}
        </div>
        <div>
          <div className={styles.profileName}>@{account.ig_username || profile.username || ''}</div>
          <div className={styles.profileSub}>Compte connecte</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={syncData} disabled={syncing}>
          <i className={`fas fa-sync ${syncing ? 'fa-spin' : ''}`} /> Synchroniser
        </button>
        <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={disconnectIg}>
          <i className="fas fa-unlink" />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Followers', value: (profile.followers_count || 0).toLocaleString(), icon: 'fa-users' },
          { label: 'Following', value: (profile.follows_count || 0).toLocaleString(), icon: 'fa-user-plus' },
          { label: 'Posts', value: (profile.media_count || 0).toLocaleString(), icon: 'fa-images' },
          { label: 'Engagement', value: avgEngagement + '%', icon: 'fa-heart' },
          { label: 'Total Reach', value: totalReach.toLocaleString(), icon: 'fa-bullseye' },
        ].map((k) => (
          <div key={k.label} className={styles.kpiCard}>
            <i className={`fas ${k.icon} ${styles.kpiIcon}`} />
            <div className={styles.kpiValue}>{k.value}</div>
            <div className={styles.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      {profile.biography && (
        <div className={styles.section} style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Bio</div>
          <div className={styles.profileBio}>{profile.biography}</div>
        </div>
      )}
    </>
  )
}
