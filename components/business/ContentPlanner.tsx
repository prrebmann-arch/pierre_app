'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/content-planner.module.css'

// ── Types ──
interface Draft {
  id: string
  user_id: string
  caption: string
  hashtags: string[]
  media_urls: string[]
  media_type: string
  status: string
  scheduled_at: string | null
  published_at: string | null
  ig_media_id?: string
  error_message?: string
  created_at: string
}

interface HashtagGroup {
  id: string
  user_id: string
  name: string
  hashtags: string[]
}

interface CaptionTemplate {
  id: string
  user_id: string
  title: string
  body: string
  category: string
  hashtags: string[]
}

interface IgReel {
  id: string
  user_id: string
  caption: string
  thumbnail_url: string
  published_at: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  reach: number
  engagement_rate: number
}

type TabId = 'calendar' | 'drafts' | 'scheduled' | 'hashtags' | 'templates' | 'besttime'

// ── Helpers ──
function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' Mo'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' Go'
}

interface TempMedia {
  url: string
  name: string
  size: number | null
  type: string
  isVideo: boolean
}

export default function ContentPlanner() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('calendar')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [hashtagGroups, setHashtagGroups] = useState<HashtagGroup[]>([])
  const [captionTemplates, setCaptionTemplates] = useState<CaptionTemplate[]>([])
  const [reels, setReels] = useState<IgReel[]>([])
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())

  // Draft modal state
  const [showDraftModal, setShowDraftModal] = useState(false)
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null)
  const [draftCaption, setDraftCaption] = useState('')
  const [draftHashtags, setDraftHashtags] = useState('')
  const [draftMediaType, setDraftMediaType] = useState('IMAGE')
  const [draftSchedDate, setDraftSchedDate] = useState('')
  const [draftSchedTime, setDraftSchedTime] = useState('09:00')
  const [tempMedia, setTempMedia] = useState<TempMedia[]>([])
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState('')
  const [publishDetail, setPublishDetail] = useState('')
  const [publishResult, setPublishResult] = useState<'success' | 'error' | null>(null)
  const [publishErrorMsg, setPublishErrorMsg] = useState('')

  // Hashtag group modal
  const [showHgModal, setShowHgModal] = useState(false)
  const [editingHg, setEditingHg] = useState<HashtagGroup | null>(null)
  const [hgName, setHgName] = useState('')
  const [hgTags, setHgTags] = useState('')

  // Template modal
  const [showTplModal, setShowTplModal] = useState(false)
  const [editingTpl, setEditingTpl] = useState<CaptionTemplate | null>(null)
  const [tplTitle, setTplTitle] = useState('')
  const [tplBody, setTplBody] = useState('')
  const [tplCategory, setTplCategory] = useState('general')
  const [tplHashtags, setTplHashtags] = useState('')

  // Reel detail modal
  const [showReelModal, setShowReelModal] = useState(false)
  const [selectedReel, setSelectedReel] = useState<IgReel | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Data loaders ──
  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [dRes, hRes, tRes, rRes] = await Promise.all([
        supabase.from('ig_drafts').select('id, user_id, caption, hashtags, media_urls, media_type, status, scheduled_at, created_at').eq('user_id', user.id).order('scheduled_at', { ascending: true }),
        supabase.from('ig_hashtag_groups').select('id, user_id, name, hashtags').eq('user_id', user.id).order('name'),
        supabase.from('ig_caption_templates').select('id, user_id, title, body').eq('user_id', user.id).order('title'),
        supabase.from('ig_reels').select('id, user_id, ig_media_id, caption, published_at, views, likes, comments, shares, saves, reach, pillar').eq('user_id', user.id).order('published_at', { ascending: false }),
      ])
      setDrafts(dRes.data || [])
      setHashtagGroups(hRes.data || [])
      setCaptionTemplates(tRes.data || [])
      setReels(rRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  // ── Draft CRUD ──
  const saveDraft = async (status: string) => {
    if (!user) return
    const hashtags = draftHashtags.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean)
    const scheduledAt = draftSchedDate ? new Date(`${draftSchedDate}T${draftSchedTime || '09:00'}`).toISOString() : null

    if (status === 'scheduled' && !scheduledAt) {
      toast('Choisis une date pour programmer le post', 'error')
      return
    }

    const payload = {
      user_id: user.id,
      caption: draftCaption,
      hashtags,
      media_urls: tempMedia.map(m => m.url),
      media_type: draftMediaType,
      status,
      scheduled_at: scheduledAt,
    }

    let error
    if (editingDraft?.id) {
      ({ error } = await supabase.from('ig_drafts').update(payload).eq('id', editingDraft.id))
    } else {
      ({ error } = await supabase.from('ig_drafts').insert(payload))
    }

    if (error) {
      toast('Erreur sauvegarde', 'error')
      return
    }

    toast(status === 'scheduled' ? 'Post programme !' : 'Brouillon sauvegarde !', 'success')
    setShowDraftModal(false)
    await loadData()
  }

  const deleteDraft = async (id: string) => {
    if (!confirm('Supprimer ce post ?')) return
    await supabase.from('ig_drafts').delete().eq('id', id)
    toast('Post supprime', 'success')
    await loadData()
  }

  // ── Publish now ──
  const publishNow = async () => {
    if (!user) return
    const mediaUrls = tempMedia.map(m => m.url)
    if (!mediaUrls.length) {
      toast('Ajoute au moins un media pour publier', 'error')
      return
    }

    const hashtags = draftHashtags.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean)
    let fullCaption = draftCaption
    if (hashtags.length) fullCaption += '\n\n' + hashtags.map(h => '#' + h).join(' ')

    setPublishing(true)
    setPublishResult(null)
    setPublishStatus('Connexion a Instagram...')
    setPublishDetail('Verification du compte')

    const { data: acct } = await supabase.from('ig_accounts').select('id, user_id, ig_user_id, ig_username, access_token, page_id, page_access_token').eq('user_id', user.id).single()
    if (!acct?.access_token || !acct?.ig_user_id) {
      setPublishing(false)
      toast("Connecte ton compte Instagram d'abord", 'error')
      return
    }

    setPublishStatus('Envoi du media...')
    setPublishDetail(draftMediaType === 'VIDEO' ? 'Traitement de la video par Instagram (peut prendre 1-2 min)' : 'Creation du post')

    try {
      const resp = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: acct.access_token,
          ig_user_id: acct.ig_user_id,
          image_url: draftMediaType !== 'VIDEO' ? mediaUrls[0] : undefined,
          video_url: draftMediaType === 'VIDEO' ? mediaUrls[0] : undefined,
          caption: fullCaption,
          media_type: draftMediaType,
        }),
      })
      const data = await resp.json()
      if (data.error) {
        setPublishResult('error')
        setPublishErrorMsg(data.error)
        if (editingDraft?.id) {
          await supabase.from('ig_drafts').update({ status: 'failed', error_message: data.error }).eq('id', editingDraft.id)
        }
        return
      }

      setPublishResult('success')

      const draftPayload = {
        user_id: user.id,
        caption: draftCaption,
        hashtags,
        media_urls: mediaUrls,
        media_type: draftMediaType,
        status: 'published',
        published_at: new Date().toISOString(),
        ig_media_id: data.ig_media_id,
      }
      if (editingDraft?.id) {
        await supabase.from('ig_drafts').update(draftPayload).eq('id', editingDraft.id)
      } else {
        await supabase.from('ig_drafts').insert(draftPayload)
      }

      setTimeout(() => {
        setShowDraftModal(false)
        setPublishing(false)
        loadData()
      }, 2000)
    } catch (err) {
      setPublishing(false)
      toast('Erreur de publication', 'error')
    }
  }

  // ── Open draft modal ──
  const openDraftModal = (dateStr?: string, draft?: Draft) => {
    setEditingDraft(draft || null)
    setDraftCaption(draft?.caption || '')
    setDraftHashtags((draft?.hashtags || []).join(', '))
    setDraftMediaType(draft?.media_type || 'IMAGE')
    setDraftSchedDate(dateStr || (draft?.scheduled_at ? draft.scheduled_at.slice(0, 10) : ''))
    setDraftSchedTime(draft?.scheduled_at ? draft.scheduled_at.slice(11, 16) : '09:00')
    setTempMedia(draft?.media_urls?.map(url => ({
      url, name: url.split('/').pop() || '', size: null,
      type: url.match(/\.(mp4|mov)$/i) ? 'video' : 'image',
      isVideo: !!url.match(/\.(mp4|mov)$/i),
    })) || [])
    setPublishing(false)
    setPublishResult(null)
    setShowDraftModal(true)
  }

  // ── Media upload ──
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const maxSize = file.type.startsWith('video/') ? 200 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast(`Fichier trop volumineux (max ${file.type.startsWith('video/') ? '200' : '10'} MB)`, 'error')
      return
    }

    const isVideo = file.type.startsWith('video/')
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('content-drafts').upload(path, file, { contentType: file.type })
    if (error) {
      toast('Erreur upload', 'error')
      return
    }

    const { data: urlData } = supabase.storage.from('content-drafts').getPublicUrl(path)
    setTempMedia(prev => [...prev, {
      url: urlData.publicUrl,
      name: file.name,
      size: file.size,
      type: isVideo ? 'video' : 'image',
      isVideo,
    }])
    if (isVideo) setDraftMediaType('VIDEO')
    toast('Media ajoute !', 'success')
    e.target.value = ''
  }

  const addMediaUrl = (url: string) => {
    if (!url.trim()) return
    const isVideo = !!url.match(/\.(mp4|mov|avi|webm)(\?|$)/i)
    setTempMedia(prev => [...prev, {
      url: url.trim(),
      name: url.split('/').pop()?.split('?')[0] || '',
      size: null,
      type: isVideo ? 'video' : 'image',
      isVideo,
    }])
  }

  const removeMedia = (index: number) => {
    setTempMedia(prev => prev.filter((_, i) => i !== index))
  }

  // ── Apply template / hashtag group ──
  const applyTemplate = (id: string) => {
    const tpl = captionTemplates.find(t => t.id === id)
    if (!tpl) return
    setDraftCaption(tpl.body)
    if (tpl.hashtags?.length) {
      const existing = draftHashtags.split(',').map(h => h.trim()).filter(Boolean)
      const merged = [...new Set([...existing, ...tpl.hashtags])]
      setDraftHashtags(merged.join(', '))
    }
  }

  const applyHashtagGroup = (id: string) => {
    const group = hashtagGroups.find(g => g.id === id)
    if (!group?.hashtags) return
    const existing = draftHashtags.split(',').map(h => h.trim()).filter(Boolean)
    const merged = [...new Set([...existing, ...group.hashtags])]
    setDraftHashtags(merged.join(', '))
  }

  // ── Hashtag group CRUD ──
  const openHgModal = (group?: HashtagGroup) => {
    setEditingHg(group || null)
    setHgName(group?.name || '')
    setHgTags((group?.hashtags || []).join(', '))
    setShowHgModal(true)
  }

  const saveHashtagGroup = async () => {
    if (!user) return
    if (!hgName.trim()) { toast('Nom requis', 'error'); return }
    const tags = hgTags.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean)
    if (!tags.length) { toast('Ajoute au moins un hashtag', 'error'); return }

    const payload = { user_id: user.id, name: hgName.trim(), hashtags: tags }
    if (editingHg?.id) {
      await supabase.from('ig_hashtag_groups').update(payload).eq('id', editingHg.id)
    } else {
      await supabase.from('ig_hashtag_groups').insert(payload)
    }
    toast('Groupe sauvegarde !', 'success')
    setShowHgModal(false)
    await loadData()
  }

  const deleteHashtagGroup = async (id: string) => {
    if (!confirm('Supprimer ce groupe ?')) return
    await supabase.from('ig_hashtag_groups').delete().eq('id', id)
    toast('Groupe supprime', 'success')
    await loadData()
  }

  // ── Template CRUD ──
  const openTplModal = (tpl?: CaptionTemplate) => {
    setEditingTpl(tpl || null)
    setTplTitle(tpl?.title || '')
    setTplBody(tpl?.body || '')
    setTplCategory(tpl?.category || 'general')
    setTplHashtags((tpl?.hashtags || []).join(', '))
    setShowTplModal(true)
  }

  const saveTemplate = async () => {
    if (!user) return
    if (!tplTitle.trim() || !tplBody.trim()) { toast('Titre et contenu requis', 'error'); return }
    const hashtags = tplHashtags.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean)
    const payload = { user_id: user.id, title: tplTitle.trim(), body: tplBody.trim(), category: tplCategory, hashtags }
    if (editingTpl?.id) {
      await supabase.from('ig_caption_templates').update(payload).eq('id', editingTpl.id)
    } else {
      await supabase.from('ig_caption_templates').insert(payload)
    }
    toast('Template sauvegarde !', 'success')
    setShowTplModal(false)
    await loadData()
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Supprimer ce template ?')) return
    await supabase.from('ig_caption_templates').delete().eq('id', id)
    toast('Template supprime', 'success')
    await loadData()
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className={styles.cpPage}>
        <div style={{ marginBottom: 16 }}><Skeleton height={36} /></div>
        <Skeleton height={400} />
      </div>
    )
  }

  // ── Tab counts ──
  const draftCount = drafts.filter(d => d.status === 'draft').length
  const scheduledCount = drafts.filter(d => d.status === 'scheduled').length

  const tabs: { id: TabId; icon: string; label: string; count?: number }[] = [
    { id: 'calendar', icon: 'fa-calendar-alt', label: 'Calendrier' },
    { id: 'drafts', icon: 'fa-file-alt', label: 'Brouillons', count: draftCount },
    { id: 'scheduled', icon: 'fa-clock', label: 'Programmes', count: scheduledCount },
    { id: 'hashtags', icon: 'fa-hashtag', label: 'Hashtags' },
    { id: 'templates', icon: 'fa-file-code', label: 'Templates' },
    { id: 'besttime', icon: 'fa-chart-bar', label: 'Best time' },
  ]

  // ═══════════════════════════════════════
  // ── CALENDAR ──
  // ═══════════════════════════════════════
  const renderCalendar = () => {
    const firstDay = new Date(calYear, calMonth, 1)
    const lastDay = new Date(calYear, calMonth + 1, 0)
    const startDow = (firstDay.getDay() + 6) % 7
    const totalDays = lastDay.getDate()
    const monthNames = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre']
    const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    const today = new Date().toISOString().slice(0, 10)

    // Build events map
    const events: Record<string, { type: string; data: Draft | IgReel }[]> = {}
    const addEvent = (date: string, item: { type: string; data: Draft | IgReel }) => {
      const key = date.slice(0, 10)
      if (!events[key]) events[key] = []
      events[key].push(item)
    }
    reels.forEach(r => {
      if (r.published_at) addEvent(r.published_at, { type: 'published', data: r })
    })
    drafts.forEach(d => {
      const date = d.scheduled_at || d.created_at
      if (date) addEvent(date, { type: d.status, data: d })
    })

    const prevMonth = () => {
      if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
      else setCalMonth(m => m - 1)
    }
    const nextMonth = () => {
      if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
      else setCalMonth(m => m + 1)
    }

    const totalCells = startDow + totalDays
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7)

    return (
      <>
        <div className={styles.calHeader}>
          <Button variant="outline" size="sm" onClick={prevMonth}><i className="fas fa-chevron-left" /></Button>
          <span className={styles.calTitle}>{monthNames[calMonth]} {calYear}</span>
          <Button variant="outline" size="sm" onClick={nextMonth}><i className="fas fa-chevron-right" /></Button>
        </div>
        <div className={styles.calGrid}>
          {weekdays.map(d => <div key={d} className={styles.calWeekday}>{d}</div>)}
          {Array.from({ length: startDow }, (_, i) => (
            <div key={`e${i}`} className={`${styles.calDay} ${styles.calDayEmpty}`} />
          ))}
          {Array.from({ length: totalDays }, (_, i) => {
            const day = i + 1
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateStr === today
            const dayEvents = events[dateStr] || []
            return (
              <div
                key={day}
                className={`${styles.calDay} ${isToday ? styles.calDayToday : ''}`}
                onClick={() => openDraftModal(dateStr)}
              >
                <div className={styles.calDayNum}>{day}</div>
                {dayEvents.slice(0, 3).map((ev, j) => {
                  const statusClass = ev.type === 'published' ? styles.calEventPublished
                    : ev.type === 'scheduled' ? styles.calEventScheduled
                    : ev.type === 'failed' ? styles.calEventFailed
                    : styles.calEventDraft
                  const caption = 'caption' in ev.data ? (ev.data.caption?.slice(0, 25) || 'Sans legende') : 'Sans legende'
                  return (
                    <div
                      key={j}
                      className={`${styles.calEvent} ${statusClass}`}
                      onClick={e => {
                        e.stopPropagation()
                        if ('status' in ev.data) openDraftModal(undefined, ev.data as Draft)
                        else { setSelectedReel(ev.data as IgReel); setShowReelModal(true) }
                      }}
                    >{caption}</div>
                  )
                })}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize: 9, color: 'var(--text3)', padding: '0 6px' }}>
                    +{dayEvents.length - 3} autre{dayEvents.length - 3 > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )
          })}
          {Array.from({ length: remaining }, (_, i) => (
            <div key={`t${i}`} className={`${styles.calDay} ${styles.calDayEmpty}`} />
          ))}
        </div>
        <div className={styles.calLegend}>
          <span><div className={styles.calLegendDot} style={{ background: 'var(--success)' }} /> Publie</span>
          <span><div className={styles.calLegendDot} style={{ background: 'var(--primary)' }} /> Programme</span>
          <span><div className={styles.calLegendDot} style={{ background: 'var(--text3)' }} /> Brouillon</span>
          <span><div className={styles.calLegendDot} style={{ background: 'var(--danger)' }} /> Echoue</span>
        </div>
      </>
    )
  }

  // ═══════════════════════════════════════
  // ── DRAFTS LIST ──
  // ═══════════════════════════════════════
  const renderDraftsList = (statusFilter: string) => {
    const filtered = drafts.filter(d => d.status === statusFilter)
    if (!filtered.length) {
      return (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
          <i className={`fas ${statusFilter === 'draft' ? 'fa-file-alt' : 'fa-clock'}`} style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.3 }} />
          <div style={{ fontSize: 13 }}>Aucun {statusFilter === 'draft' ? 'brouillon' : 'post programme'}</div>
          <Button variant="primary" size="sm" style={{ marginTop: 14 }} onClick={() => openDraftModal()}>
            <i className="fas fa-plus" /> Creer un post
          </Button>
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(d => {
          const thumb = d.media_urls?.[0]
          const captionText = d.caption
            ? (d.caption.length > 120 ? d.caption.slice(0, 120) + '...' : d.caption)
            : ''
          const date = d.scheduled_at
            ? new Date(d.scheduled_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : 'Non planifie'
          return (
            <div key={d.id} className={styles.draftCard} onClick={() => openDraftModal(undefined, d)}>
              <div className={styles.draftThumb}>
                {thumb ? <img src={thumb} alt="" /> : <i className="fas fa-image" style={{ fontSize: 22, color: 'var(--text3)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.draftCaption}>
                  {captionText || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Sans legende</span>}
                </div>
                {d.hashtags?.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {d.hashtags.slice(0, 5).map((h, i) => (
                      <span key={i} style={{ fontSize: 10, color: 'var(--primary)', marginRight: 4 }}>#{h}</span>
                    ))}
                  </div>
                )}
                <div className={styles.draftMeta}>
                  <span><i className="fas fa-calendar" /> {date}</span>
                  <span><i className={`fas fa-${d.media_type === 'VIDEO' ? 'video' : 'image'}`} /> {d.media_type || 'IMAGE'}</span>
                </div>
              </div>
              <div className={styles.draftActions}>
                <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); openDraftModal(undefined, d) }} title="Modifier">
                  <i className="fas fa-pen" />
                </Button>
                <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); deleteDraft(d.id) }} title="Supprimer" style={{ color: 'var(--danger)' }}>
                  <i className="fas fa-trash" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ═══════════════════════════════════════
  // ── HASHTAGS TAB ──
  // ═══════════════════════════════════════
  const renderHashtags = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: 'var(--text3)' }}>{hashtagGroups.length} groupe(s)</span>
        <Button variant="primary" size="sm" onClick={() => openHgModal()}>
          <i className="fas fa-plus" style={{ marginRight: 4 }} />Nouveau groupe
        </Button>
      </div>
      <div className={styles.cardGrid}>
        {hashtagGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', gridColumn: '1 / -1' }}>Aucun groupe de hashtags</div>
        ) : (
          hashtagGroups.map(g => (
            <div key={g.id} className={styles.hashtagCard}>
              <div className={styles.hashtagCardHeader}>
                <span className={styles.hashtagCardName}>{g.name}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="outline" size="sm" onClick={() => openHgModal(g)}><i className="fas fa-pen" /></Button>
                  <Button variant="outline" size="sm" onClick={() => deleteHashtagGroup(g.id)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                    <i className="fas fa-trash" />
                  </Button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(g.hashtags || []).map((h, i) => (
                  <span key={i} className={styles.hashtagChip}>#{h}</span>
                ))}
              </div>
              <div className={styles.hashtagCount}>{(g.hashtags || []).length} hashtags</div>
            </div>
          ))
        )}
      </div>
    </>
  )

  // ═══════════════════════════════════════
  // ── TEMPLATES TAB ──
  // ═══════════════════════════════════════
  const renderTemplates = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: 'var(--text3)' }}>{captionTemplates.length} template(s)</span>
        <Button variant="primary" size="sm" onClick={() => openTplModal()}>
          <i className="fas fa-plus" style={{ marginRight: 4 }} />Nouveau template
        </Button>
      </div>
      <div className={styles.cardGrid}>
        {captionTemplates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', gridColumn: '1 / -1' }}>Aucun template</div>
        ) : (
          captionTemplates.map(t => (
            <div key={t.id} className={styles.templateCard}>
              <div className={styles.templateCardHeader}>
                <span className={styles.templateCardTitle}>{t.title}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="outline" size="sm" onClick={() => openTplModal(t)}><i className="fas fa-pen" /></Button>
                  <Button variant="outline" size="sm" onClick={() => deleteTemplate(t.id)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                    <i className="fas fa-trash" />
                  </Button>
                </div>
              </div>
              <div className={styles.templateBody}>{t.body.slice(0, 200)}</div>
              {t.hashtags?.length > 0 && (
                <div className={styles.templateHashtags}>{t.hashtags.map(h => '#' + h).join(' ')}</div>
              )}
              <div className={styles.templateCategory}>{t.category || 'general'}</div>
            </div>
          ))
        )}
      </div>
    </>
  )

  // ═══════════════════════════════════════
  // ── BEST TIME HEATMAP ──
  // ═══════════════════════════════════════
  const renderBestTime = () => {
    if (reels.length < 5) {
      return (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
          <i className="fas fa-chart-bar" style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
          <div style={{ fontSize: 14 }}>Pas assez de donnees</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Publie au moins 5 reels pour voir les meilleurs moments</div>
        </div>
      )
    }

    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    const hours = Array.from({ length: 18 }, (_, i) => i + 6)
    const grid: Record<string, { total_eng: number; count: number }> = {}

    reels.forEach(r => {
      if (!r.published_at) return
      const d = new Date(r.published_at)
      const dayIdx = (d.getDay() + 6) % 7
      const hour = d.getHours()
      const key = `${dayIdx}-${hour}`
      if (!grid[key]) grid[key] = { total_eng: 0, count: 0 }
      grid[key].total_eng += (r.engagement_rate || 0)
      grid[key].count++
    })

    let maxAvg = 0
    Object.values(grid).forEach(v => {
      const avg = v.total_eng / v.count
      if (avg > maxAvg) maxAvg = avg
    })

    const slots = Object.entries(grid).map(([key, val]) => {
      const [d, h] = key.split('-').map(Number)
      return { day: dayNames[d], hour: h, avg: val.total_eng / val.count, count: val.count }
    }).sort((a, b) => b.avg - a.avg).slice(0, 5)

    return (
      <>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Meilleurs moments pour poster</h3>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
          Base sur {reels.length} publications.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <td style={{ padding: 4, fontWeight: 600, color: 'var(--text3)' }} />
                {hours.map(h => (
                  <td key={h} style={{ textAlign: 'center', padding: 4, fontWeight: 600, color: 'var(--text3)' }}>
                    {String(h).padStart(2, '0')}h
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayNames.map((dayName, dayIdx) => (
                <tr key={dayIdx}>
                  <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text)' }}>{dayName}</td>
                  {hours.map(hour => {
                    const key = `${dayIdx}-${hour}`
                    const cell = grid[key]
                    if (cell) {
                      const avg = cell.total_eng / cell.count
                      const intensity = maxAvg > 0 ? avg / maxAvg : 0
                      const r = Math.round(179 * intensity)
                      const g = Math.round(8 * (1 - intensity))
                      const b = Math.round(8 * (1 - intensity))
                      const alpha = 0.2 + intensity * 0.8
                      return (
                        <td key={hour} style={{
                          textAlign: 'center', padding: 6,
                          background: `rgba(${r},${g},${b},${alpha})`,
                          borderRadius: 4, cursor: 'pointer',
                        }} title={`${dayName} ${hour}h -- ${avg.toFixed(1)}% eng (${cell.count} posts)`}>
                          {avg.toFixed(1)}
                        </td>
                      )
                    }
                    return (
                      <td key={hour} style={{ textAlign: 'center', padding: 6, background: 'var(--bg3)', borderRadius: 4, color: 'var(--text3)' }}>
                        --
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Top 5 creneaux</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {slots.map((s, i) => (
              <div key={i} style={{
                padding: '10px 16px', background: 'var(--bg2)', borderRadius: 10,
                border: `1px solid ${i === 0 ? 'var(--primary)' : 'var(--border)'}`, textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.day}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: i === 0 ? 'var(--primary)' : 'var(--text)' }}>
                  {String(s.hour).padStart(2, '0')}h
                </div>
                <div style={{ fontSize: 10, color: 'var(--success)' }}>{s.avg.toFixed(1)}% eng</div>
                <div style={{ fontSize: 9, color: 'var(--text3)' }}>{s.count} post{s.count > 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ═══════════════════════════════════════
  // ── MAIN RENDER ──
  // ═══════════════════════════════════════
  const [mediaUrlInput, setMediaUrlInput] = useState('')

  return (
    <div className={styles.cpPage}>
      {/* Nav + New post button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className={styles.cpNav}>
          {tabs.map(t => (
            <button
              key={t.id}
              className={`${styles.cpNavBtn} ${tab === t.id ? styles.cpNavBtnActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              <i className={`fas ${t.icon}`} /> {t.label}
              {t.count ? <span className={styles.cpNavCount}>{t.count}</span> : null}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Button variant="primary" size="sm" onClick={() => openDraftModal()}>
          <i className="fas fa-plus" /> Nouveau post
        </Button>
      </div>

      {/* Tab content */}
      {tab === 'calendar' && renderCalendar()}
      {tab === 'drafts' && renderDraftsList('draft')}
      {tab === 'scheduled' && renderDraftsList('scheduled')}
      {tab === 'hashtags' && renderHashtags()}
      {tab === 'templates' && renderTemplates()}
      {tab === 'besttime' && renderBestTime()}

      {/* ── Draft Modal ── */}
      <Modal
        isOpen={showDraftModal}
        title={editingDraft ? 'Modifier le post' : 'Nouveau post'}
        onClose={() => { setShowDraftModal(false); setPublishing(false) }}
        size="lg"
      >
          <div className={styles.draftModalBody}>
            {/* LEFT: Media */}
            <div className={styles.draftModalLeft}>
              <div className={styles.mediaPreview}>
                {tempMedia.map((m, i) => (
                  <div key={i} className={styles.mediaItem}>
                    <div className={styles.mediaItemInner}>
                      {m.isVideo
                        ? <video src={m.url} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      }
                      <div className={styles.mediaOverlay}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                          <span>{m.isVideo ? 'Video' : 'Image'}</span>
                          {m.size && <span>{formatSize(m.size)}</span>}
                          <span style={{ color: '#22c55e' }}><i className="fas fa-check-circle" style={{ marginRight: 2 }} />Pret</span>
                        </div>
                      </div>
                      <button className={styles.mediaRemoveBtn} onClick={() => removeMedia(i)}><i className="fas fa-trash" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <input type="file" ref={fileInputRef} accept="image/*,video/*" style={{ display: 'none' }} onChange={handleMediaUpload} />
              <div className={styles.uploadZone} onClick={() => fileInputRef.current?.click()}>
                <i className="fas fa-cloud-upload-alt" style={{ fontSize: 28, color: 'var(--text3)', marginBottom: 8, display: 'block' }} />
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>Clique ou glisse un fichier</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Images (10 MB) - Videos (200 MB)</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  className="field-input"
                  placeholder="URL du media..."
                  style={{ flex: 1, fontSize: 11 }}
                  value={mediaUrlInput}
                  onChange={e => setMediaUrlInput(e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={() => { addMediaUrl(mediaUrlInput); setMediaUrlInput('') }}>
                  <i className="fas fa-link" />
                </Button>
              </div>
            </div>

            {/* RIGHT: Form */}
            <div className={styles.draftModalRight}>
              {/* Caption */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Legende</label>
                  {captionTemplates.length > 0 && (
                    <select
                      className="field-input"
                      style={{ width: 'auto', fontSize: 11, padding: '4px 8px' }}
                      onChange={e => applyTemplate(e.target.value)}
                      defaultValue=""
                    >
                      <option value="">Template...</option>
                      {captionTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  )}
                </div>
                <textarea
                  className="field-input"
                  rows={6}
                  style={{ marginTop: 4, resize: 'vertical', fontFamily: 'inherit', width: '100%' }}
                  placeholder="Ecris ta legende ici..."
                  value={draftCaption}
                  onChange={e => setDraftCaption(e.target.value)}
                />
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{draftCaption.length} / 2200</span>
              </div>

              {/* Hashtags */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Hashtags</label>
                  {hashtagGroups.length > 0 && (
                    <select
                      className="field-input"
                      style={{ width: 'auto', fontSize: 11, padding: '4px 8px' }}
                      onChange={e => applyHashtagGroup(e.target.value)}
                      defaultValue=""
                    >
                      <option value="">Groupe...</option>
                      {hashtagGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.name} ({g.hashtags?.length || 0})</option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  type="text"
                  className="field-input"
                  style={{ marginTop: 4, width: '100%' }}
                  placeholder="fitness, coaching, musculation"
                  value={draftHashtags}
                  onChange={e => setDraftHashtags(e.target.value)}
                />
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                  {draftHashtags.split(',').filter(h => h.trim()).length} / 30
                </span>
              </div>

              {/* Type + Schedule */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Type</label>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {(['IMAGE', 'VIDEO', 'CAROUSEL'] as const).map(t => (
                      <button
                        key={t}
                        className={`${styles.typeBtn} ${draftMediaType === t ? styles.typeBtnActive : ''}`}
                        onClick={() => setDraftMediaType(t)}
                      >
                        <i className={`fas fa-${t === 'IMAGE' ? 'image' : t === 'VIDEO' ? 'video' : 'images'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Planification</label>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <input type="date" className="field-input" style={{ fontSize: 11 }} value={draftSchedDate} onChange={e => setDraftSchedDate(e.target.value)} />
                    <input type="time" className="field-input" style={{ fontSize: 11 }} value={draftSchedTime} onChange={e => setDraftSchedTime(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                <Button variant="outline" style={{ flex: 1 }} onClick={() => saveDraft('draft')}>
                  <i className="fas fa-save" style={{ marginRight: 4 }} />Brouillon
                </Button>
                <Button variant="primary" style={{ flex: 1 }} onClick={() => saveDraft('scheduled')}>
                  <i className="fas fa-clock" style={{ marginRight: 4 }} />Programmer
                </Button>
                <Button variant="primary" style={{ flex: 1, background: 'var(--success)', borderColor: 'var(--success)' }} onClick={publishNow}>
                  <i className="fas fa-paper-plane" style={{ marginRight: 4 }} />Publier
                </Button>
              </div>
            </div>
          </div>

          {/* Publishing overlay */}
          {publishing && (
            <div className={styles.publishOverlay}>
              {publishResult === 'success' ? (
                <>
                  <div className={styles.publishIcon} style={{ background: 'rgba(34,197,94,0.15)' }}>
                    <i className="fas fa-check" style={{ fontSize: 28, color: 'var(--success)' }} />
                  </div>
                  <div className={styles.publishStatus} style={{ color: 'var(--success)' }}>Publie sur Instagram !</div>
                  <div className={styles.publishDetail}>Ton post est en ligne</div>
                </>
              ) : publishResult === 'error' ? (
                <>
                  <div className={styles.publishIcon} style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <i className="fas fa-times" style={{ fontSize: 28, color: 'var(--danger)' }} />
                  </div>
                  <div className={styles.publishStatus} style={{ color: 'var(--danger)' }}>Erreur de publication</div>
                  <div className={styles.publishDetail} style={{ maxWidth: 300, textAlign: 'center' }}>{publishErrorMsg}</div>
                  <Button variant="outline" size="sm" onClick={() => setPublishing(false)} style={{ marginTop: 8 }}>Fermer</Button>
                </>
              ) : (
                <>
                  <div className={styles.publishIcon} style={{ background: 'rgba(179,8,8,0.15)' }}>
                    <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--primary)' }} />
                  </div>
                  <div className={styles.publishStatus}>{publishStatus}</div>
                  <div className={styles.publishDetail}>{publishDetail}</div>
                </>
              )}
            </div>
          )}
        </Modal>

      {/* ── Hashtag Group Modal ── */}
      <Modal isOpen={showHgModal} title={editingHg ? 'Modifier le groupe' : 'Nouveau groupe de hashtags'} onClose={() => setShowHgModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Nom du groupe</label>
              <input type="text" className="field-input" value={hgName} onChange={e => setHgName(e.target.value)} placeholder="Ex: Fitness general" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Hashtags (separes par des virgules)</label>
              <textarea className="field-input" rows={4} value={hgTags} onChange={e => setHgTags(e.target.value)} placeholder="fitness, musculation, coaching, sport" />
            </div>
            <Button variant="primary" onClick={saveHashtagGroup}><i className="fas fa-save" style={{ marginRight: 4 }} />Sauvegarder</Button>
          </div>
        </Modal>

      {/* ── Template Modal ── */}
      <Modal isOpen={showTplModal} title={editingTpl ? 'Modifier le template' : 'Nouveau template de caption'} onClose={() => setShowTplModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Titre</label>
              <input type="text" className="field-input" value={tplTitle} onChange={e => setTplTitle(e.target.value)} placeholder="Ex: Post transformation" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Categorie</label>
              <select className="field-input" value={tplCategory} onChange={e => setTplCategory(e.target.value)}>
                {['general', 'education', 'storytelling', 'offre', 'preuve_sociale', 'motivation', 'behind_the_scenes'].map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Contenu</label>
              <textarea className="field-input" rows={8} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={tplBody} onChange={e => setTplBody(e.target.value)} placeholder="Ecris ton template de caption ici..." />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Hashtags inclus (optionnel)</label>
              <input type="text" className="field-input" value={tplHashtags} onChange={e => setTplHashtags(e.target.value)} placeholder="fitness, coaching" />
            </div>
            <Button variant="primary" onClick={saveTemplate}><i className="fas fa-save" style={{ marginRight: 4 }} />Sauvegarder</Button>
          </div>
        </Modal>

      {/* ── Published Reel Detail Modal ── */}
      <Modal isOpen={showReelModal && !!selectedReel} title="Post publie" onClose={() => setShowReelModal(false)}>
          {selectedReel?.thumbnail_url && (
            <img src={selectedReel?.thumbnail_url} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 12 }} />
          )}
          <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
            {selectedReel?.caption || 'Sans legende'}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { icon: 'fa-eye', value: selectedReel?.views ?? 0, label: 'Vues' },
              { icon: 'fa-heart', value: selectedReel?.likes ?? 0, label: 'Likes' },
              { icon: 'fa-comment', value: selectedReel?.comments ?? 0, label: 'Commentaires' },
              { icon: 'fa-share', value: selectedReel?.shares ?? 0, label: 'Partages' },
              { icon: 'fa-bookmark', value: selectedReel?.saves ?? 0, label: 'Saves' },
              { icon: 'fa-bullseye', value: selectedReel?.reach ?? 0, label: 'Reach' },
              { icon: 'fa-chart-line', value: (selectedReel?.engagement_rate || 0).toFixed(1) + '%', label: 'Engagement' },
            ].map((s, i) => (
              <div key={i} className={styles.statBadge}>
                <i className={`fas ${s.icon} ${styles.statBadgeIcon}`} />
                <span className={styles.statBadgeValue}>{s.value}</span>
                <span className={styles.statBadgeLabel}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)' }}>
            Publie le {selectedReel?.published_at ? new Date(selectedReel.published_at).toLocaleString('fr-FR') : '--'}
          </div>
        </Modal>
    </div>
  )
}
