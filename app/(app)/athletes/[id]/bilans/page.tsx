'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { useToast } from '@/contexts/ToastContext'
import { notifyAthlete } from '@/lib/push'
import BilanAccordion from '@/components/bilans/BilanAccordion'
import PhotoCompare from '@/components/bilans/PhotoCompare'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import type { DailyReport } from '@/components/bilans/BilanAccordion'
import type { PhotoType, PhotoEntry } from '@/components/bilans/PhotoCompare'
import styles from '@/styles/bilans.module.css'

// ── Bilan Traite Popup (inline, same as overview) ──

const BILAN_TRAITE_MESSAGES = [
  "Bon bilan, pas de changement, donne-toi a fond !",
  "Tres beau resultat, continue comme ca !",
  "Bilan correct, on garde le cap !",
  "Super progression, rien a modifier !",
  "RAS, on continue sur cette lancee !",
]

function BilanTraitePopupInline({
  userId,
  prenom,
  athleteId,
  onClose,
}: {
  userId: string
  prenom: string
  athleteId: string
  onClose: () => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()
  const [selectedChip, setSelectedChip] = useState(0)
  const [customMsg, setCustomMsg] = useState('')

  const handleSend = async () => {
    const msg = customMsg.trim() || (selectedChip >= 0 ? BILAN_TRAITE_MESSAGES[selectedChip] : '')
    if (!msg) { toast('Ajoutez un message', 'error'); return }
    const body = 'Ton bilan a ete verifie : ' + msg.charAt(0).toLowerCase() + msg.slice(1)

    await supabase.from('bilan_retours').insert({
      athlete_id: athleteId,
      coach_id: user?.id,
      titre: 'Bilan traite',
      commentaire: msg,
      type: 'message',
    })

    await notifyAthlete(userId, 'bilan', 'Bilan traite', body)

    onClose()
    toast('Notification envoyee !', 'success')
  }

  const s = styles

  return (
    <div className={s.btOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={s.btPopup}>
        <div className={s.btPopupHeader}>
          <div className={s.btPopupTitle}>
            <div className={s.btPopupAvatar}>{prenom.charAt(0)}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Retour bilan</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>{prenom}</div>
            </div>
          </div>
          <button className={s.btClose} onClick={onClose}><i className="fas fa-times" /></button>
        </div>
        <div className={s.btPopupBody}>
          <div className={s.btSectionLabel}><i className="fas fa-comment-dots" /> Message rapide</div>
          <div className={s.btChips}>
            {BILAN_TRAITE_MESSAGES.map((msg, i) => (
              <button key={i} type="button"
                className={`${s.btChip} ${selectedChip === i && !customMsg.trim() ? s.btChipActive : ''}`}
                onClick={() => { setSelectedChip(i); setCustomMsg('') }}
              >{msg}</button>
            ))}
          </div>
          <div className={s.btSectionLabel} style={{ marginTop: 16 }}><i className="fas fa-pen" /> Ou message libre</div>
          <input type="text" className={s.btInput} placeholder="Ecrivez votre message..."
            value={customMsg} onChange={(e) => { setCustomMsg(e.target.value); setSelectedChip(-1) }} />
        </div>
        <div className={s.btPopupFooter}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-red" onClick={handleSend}>
            <i className="fas fa-paper-plane" style={{ marginRight: 6 }} />Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──

export default function BilansPage() {
  const { user } = useAuth()
  const { selectedAthlete } = useAthleteContext()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [bilans, setBilans] = useState<DailyReport[]>([])
  const [allWLogs, setAllWLogs] = useState<Array<{ id: string; date: string; session_id?: string | null; session_name?: string | null; titre?: string | null; type?: string | null; started_at?: string | null; finished_at?: string | null; exercices_completes?: string | unknown[] | null }>>([])
  const [progWeeks, setProgWeeks] = useState<Array<{ week_date: string; phase?: string | null; _phaseNum?: number }>>([])
  const [nutriPlans, setNutriPlans] = useState<Array<{ id: string; valid_from?: string | null; meal_type?: string | null; nom?: string | null; calories_objectif?: number | null; proteines?: number | null; glucides?: number | null; lipides?: number | null; created_at?: string | null }>>([])
  const [roadmapPhases, setRoadmapPhases] = useState<Array<{ phase?: string | null; name?: string | null; start_date?: string | null; end_date?: string | null }>>([])
  const [photoHistory, setPhotoHistory] = useState<Record<PhotoType, PhotoEntry[]>>({ front: [], side: [], back: [] })

  // Photo compare state
  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoType, setPhotoType] = useState<PhotoType>('front')
  const [photoDate, setPhotoDate] = useState('')

  // Bilan traite popup state
  const [bilanTraiteOpen, setBilanTraiteOpen] = useState(false)

  const loadData = useCallback(async () => {
    if (!selectedAthlete?.user_id) return
    setLoading(true)
    try {
      const [bilansRes, progRes, nutriRes, phasesRes, wlogsRes] = await Promise.all([
        supabase.from('daily_reports').select('user_id, date, weight, sessions_executed, session_performance, energy, sleep_quality, steps, adherence, digestion, stress, humeur, douleurs, notes, photo_front, photo_side, photo_back, menstrual_flow, menstrual_symptoms').eq('user_id', selectedAthlete.user_id).order('date', { ascending: false }).limit(200),
        supabase.from('programming_weeks').select('week_date, phase').eq('athlete_id', selectedAthlete.id).order('week_date'),
        supabase.from('nutrition_plans').select('id, valid_from, meal_type, nom, calories_objectif, proteines, glucides, lipides, created_at').eq('athlete_id', selectedAthlete.id),
        supabase.from('roadmap_phases').select('phase, name, start_date, end_date').eq('athlete_id', selectedAthlete.id).order('start_date'),
        supabase.from('workout_logs').select('id, date, session_id, session_name, titre, type, started_at, finished_at, exercices_completes').eq('athlete_id', selectedAthlete.id).order('date', { ascending: false }).limit(500),
      ])

      const bilanData = (bilansRes.data || []) as DailyReport[]
      setBilans(bilanData)
      setAllWLogs(wlogsRes.data || [])
      setProgWeeks(progRes.data || [])
      setNutriPlans(nutriRes.data || [])
      setRoadmapPhases((phasesRes.data || []).sort((a: { start_date?: string }, b: { start_date?: string }) => (a.start_date || '').localeCompare(b.start_date || '')))

      // Build photo history with signed URLs
      const history: Record<PhotoType, PhotoEntry[]> = { front: [], side: [], back: [] }
      const photoPromises: Promise<void>[] = []

      bilanData.forEach((b: DailyReport) => {
        (['front', 'side', 'back'] as PhotoType[]).forEach(pos => {
          const raw = b[`photo_${pos}`] as string | null
          if (!raw) return

          let path = raw
          const bucketMarker = '/athlete-photos/'
          const idx = raw.indexOf(bucketMarker)
          if (idx !== -1) {
            path = raw.substring(idx + bucketMarker.length).split('?')[0]
          }

          photoPromises.push(
            supabase.storage
              .from('athlete-photos')
              .createSignedUrl(path, 3600)
              .then(({ data, error }) => {
                if (data?.signedUrl) {
                  history[pos].push({ date: b.date, url: data.signedUrl })
                } else if (raw.startsWith('http')) {
                  history[pos].push({ date: b.date, url: raw })
                }
              })
          )
        })
      })

      await Promise.all(photoPromises)
      Object.values(history).forEach(arr => arr.sort((a, b) => a.date.localeCompare(b.date)))
      setPhotoHistory(history)
    } finally {
      setLoading(false)
    }
  }, [selectedAthlete?.id, selectedAthlete?.user_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = useCallback(async (bilanId: string, date: string) => {
    if (!confirm(`Supprimer le bilan du ${date} ?`)) return
    try {
      const { error, count } = await supabase.from('daily_reports').delete({ count: 'exact' }).eq('id', bilanId)
      if (error) throw error
      if (count === 0) {
        toast('Impossible de supprimer ce bilan (permission refusee).', 'error')
        return
      }
      toast('Bilan supprime', 'success')
      loadData()
    } catch (err) {
      toast('Erreur lors de la suppression', 'error')
    }
  }, [toast, loadData]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenPhoto = useCallback((type: PhotoType, date: string) => {
    setPhotoType(type)
    setPhotoDate(date)
    setPhotoOpen(true)
  }, [])

  if (!selectedAthlete) {
    return (
      <EmptyState
        icon="fa-solid fa-exclamation-triangle"
        message="Athlete non selectionne"
      />
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => <Skeleton key={i} height={120} />)}
      </div>
    )
  }

  if (!bilans.length) {
    return (
      <EmptyState
        icon="fa-solid fa-chart-line"
        message="Aucun bilan enregistre"
      />
    )
  }

  return (
    <>
      <BilanAccordion
        bilans={bilans}
        allWLogs={allWLogs}
        progWeeks={progWeeks}
        nutriPlans={nutriPlans}
        roadmapPhases={roadmapPhases}
        athlete={selectedAthlete}
        photoHistory={photoHistory}
        onDeleteBilan={handleDelete}
        onOpenPhoto={handleOpenPhoto}
        onOpenBilanTraite={() => setBilanTraiteOpen(true)}
      />

      <PhotoCompare
        isOpen={photoOpen}
        onClose={() => setPhotoOpen(false)}
        initialType={photoType}
        initialDate={photoDate}
        photoHistory={photoHistory}
      />

      {bilanTraiteOpen && selectedAthlete.user_id && (
        <BilanTraitePopupInline
          userId={selectedAthlete.user_id}
          prenom={selectedAthlete.prenom}
          athleteId={selectedAthlete.id}
          onClose={() => setBilanTraiteOpen(false)}
        />
      )}
    </>
  )
}
