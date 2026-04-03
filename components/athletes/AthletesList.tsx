'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAthleteContext } from '@/contexts/AthleteContext'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import AddAthleteForm from './AddAthleteForm'
import Modal from '@/components/ui/Modal'
import styles from '@/styles/athletes.module.css'
import type { Athlete } from '@/lib/types'

import { PROG_PHASES } from '@/lib/constants'

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: '#22c55e' },
  pending: { label: 'En attente', color: '#f59e0b' },
  past_due: { label: 'Impaye', color: '#ef4444' },
  canceled: { label: 'Annule', color: '#ef4444' },
  completed: { label: 'Termine', color: '#6366f1' },
  free: { label: 'Gratuit', color: '#22c55e' },
}

function getPaymentBadge(athlete: Athlete) {
  const plan = athlete._payment
  if (!plan) return { label: 'Gratuit', color: '#22c55e' }
  if (plan.is_free) return { label: 'Gratuit', color: '#22c55e' }
  return PAYMENT_STATUS_MAP[plan.payment_status] || { label: 'En attente', color: '#f59e0b' }
}

function AthleteCard({ athlete, onClick }: { athlete: Athlete; onClick: () => void }) {
  const initials = (athlete.prenom?.charAt(0) || '') + (athlete.nom?.charAt(0) || '')
  const poids = athlete.poids_actuel ? `${athlete.poids_actuel} kg` : '\u2014'
  const activePhase = athlete._phase
  const phaseInfo = activePhase?.phase ? (PROG_PHASES as Record<string, { label: string; short: string; color: string }>)[activePhase.phase] : null
  const phaseLabel = phaseInfo ? phaseInfo.label : (activePhase?.name || '')
  const phaseColor = phaseInfo ? phaseInfo.color : 'var(--primary)'
  const payBadge = getPaymentBadge(athlete)

  return (
    <div className={styles.athleteCard} onClick={onClick}>
      <div
        className={styles.cardTopBar}
        style={{
          background: phaseInfo ? phaseColor : 'var(--border)',
          opacity: phaseInfo ? 0.8 : 0.3,
        }}
      />
      <div className={styles.cardHead}>
        {athlete.avatar_url ? (
          <img src={athlete.avatar_url} alt="" className={styles.cardAvatar} />
        ) : (
          <div className={styles.cardAvatarFallback}>{initials}</div>
        )}
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>
            {athlete.prenom} {athlete.nom}
          </div>
          <div className={styles.cardEmail}>{athlete.email || ''}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          {phaseLabel && (
            <span
              className={styles.phaseBadge}
              style={{ color: phaseColor, background: `${phaseColor}18` }}
            >
              {phaseLabel}
            </span>
          )}
          <span
            className={styles.phaseBadge}
            style={{ color: payBadge.color, background: `${payBadge.color}18` }}
          >
            {payBadge.label}
          </span>
        </div>
      </div>
      <div className={styles.statGrid}>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{poids}</div>
          <div className={styles.statLabel}>Poids</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statValue}>
            {athlete.poids_objectif ? `${athlete.poids_objectif} kg` : '\u2014'}
          </div>
          <div className={styles.statLabel}>Objectif</div>
        </div>
        <div className={styles.statBox}>
          <div
            className={styles.statValue}
            style={phaseInfo ? { color: phaseColor } : undefined}
          >
            {phaseInfo ? phaseInfo.short : '\u2014'}
          </div>
          <div className={styles.statLabel}>Phase</div>
        </div>
      </div>
    </div>
  )
}

export default function AthletesList() {
  const { athletes, loading } = useAthleteContext()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [credentialsMessage, setCredentialsMessage] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return athletes
    const q = search.toLowerCase()
    return athletes.filter(
      (a) =>
        a.prenom?.toLowerCase().includes(q) ||
        a.nom?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q)
    )
  }, [athletes, search])

  if (loading) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Athletes</h1>
        </div>
        <div className={styles.athleteGrid}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={180} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          Athletes
          <span className={styles.countLabel}>
            {athletes.length} athlete{athletes.length > 1 ? 's' : ''} enregistre{athletes.length > 1 ? 's' : ''}
          </span>
        </h1>
        <button className="btn btn-red" onClick={() => setShowAddModal(true)}>
          <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />
          Ajouter un athlete
        </button>
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <i className={`fa-solid fa-search ${styles.searchIcon}`} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Rechercher un athlete..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="fa-solid fa-users"
          message={search ? 'Aucun athlete trouve' : 'Aucun athlete'}
          action={
            !search ? (
              <button className="btn btn-red" onClick={() => setShowAddModal(true)}>
                <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />
                Ajouter un athlete
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className={styles.athleteGrid}>
          {filtered.map((athlete) => (
            <AthleteCard
              key={athlete.id}
              athlete={athlete}
              onClick={() => router.push(`/athletes/${athlete.id}/apercu`)}
            />
          ))}
        </div>
      )}

      <AddAthleteForm
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={(msg) => setCredentialsMessage(msg)}
      />

      <Modal
        isOpen={!!credentialsMessage}
        onClose={() => setCredentialsMessage(null)}
        title="Message WhatsApp"
      >
        <div style={{ padding: 20, background: 'var(--bg3)', borderRadius: 10, margin: 16, fontFamily: 'monospace', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid var(--border)' }}>
          {credentialsMessage}
        </div>
        <div style={{ padding: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-red" onClick={async () => {
            if (credentialsMessage) {
              try { await navigator.clipboard.writeText(credentialsMessage); } catch {}
            }
          }}>
            Copier le message
          </button>
          <button className="btn btn-outline" onClick={() => setCredentialsMessage(null)}>
            Fermer
          </button>
        </div>
      </Modal>
    </div>
  )
}
