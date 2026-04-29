'use client'

import { useRecorder } from '@/contexts/RecorderContext'
import styles from './RecordingPill.module.css'

const WARNING_AT_S = 12 * 60

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function RecordingPill() {
  const { isRecording, seconds, isProcessing, isUploading, uploadProgress, stopRecording, cancelRecording } = useRecorder()

  if (!isRecording && !isProcessing && !isUploading) return null

  if (isUploading) {
    return (
      <div className={styles.pill} role="status" aria-live="polite">
        <i className="fas fa-cloud-upload-alt" />
        <span className={styles.uploading}>
          Envoi… {uploadProgress}%
          <span className={styles.progressBar}>
            <span className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
          </span>
        </span>
      </div>
    )
  }

  if (isProcessing) {
    return (
      <div className={styles.pill} role="status" aria-live="polite">
        <span className={`${styles.dot} ${styles.dotProcessing}`} />
        <span>Traitement…</span>
      </div>
    )
  }

  // isRecording
  const isWarning = seconds >= WARNING_AT_S
  return (
    <div className={styles.pill} role="status" aria-live="polite">
      <span className={styles.dot} />
      <span className={`${styles.timer} ${isWarning ? styles.timerWarning : ''}`}>{formatTime(seconds)}</span>
      <button
        className={`${styles.btn} ${styles.btnStop}`}
        onClick={() => { stopRecording() }}
        disabled={isProcessing || isUploading}
        aria-label="Arrêter l'enregistrement"
      >
        <i className="fas fa-stop" /> Stop
      </button>
      <button
        className={`${styles.btn} ${styles.btnCancel}`}
        onClick={() => {
          if (confirm('Annuler cet enregistrement ? La vidéo sera perdue.')) cancelRecording()
        }}
        disabled={isProcessing || isUploading}
        aria-label="Annuler"
      >
        Annuler
      </button>
    </div>
  )
}
