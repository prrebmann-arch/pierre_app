'use client'

import styles from '@/styles/training.module.css'

export interface SetData {
  type: 'normal' | 'dropset' | 'rest_pause'
  reps: string
  tempo?: string
  repos?: string
  reps_rp?: string
  rest_pause_time?: string
}

interface SetRowProps {
  exIdx: number
  setIdx: number
  set: SetData
  onChange: (exIdx: number, setIdx: number, field: string, value: string) => void
  onRemove: (exIdx: number, setIdx: number) => void
  onToggleMaxRep?: (exIdx: number, setIdx: number, isMax: boolean) => void
  readOnly?: boolean
}

export default function SetRow({ exIdx, setIdx, set, onChange, onRemove, onToggleMaxRep, readOnly }: SetRowProps) {
  if (set.type === 'dropset') {
    const isMax = set.reps === 'MAX'
    return (
      <tr className={`${styles.tpSetRow} ${styles.tpSetDrop}`}>
        <td className={styles.tpSetNum}>
          <span className={`${styles.tpSetTypeTag} ${styles.tpTagDrop}`}>DROP</span>
        </td>
        <td>
          {isMax ? (
            <>
              <span className={styles.tpMaxrepTag}>MAX REP</span>
              {!readOnly && (
                <label className={styles.tpMaxrepToggle}>
                  <input
                    type="checkbox"
                    checked
                    onChange={(e) => onToggleMaxRep?.(exIdx, setIdx, !e.target.checked)}
                  />
                  <span>Max</span>
                </label>
              )}
            </>
          ) : (
            <>
              <input
                type="text"
                value={set.reps}
                placeholder="10"
                onChange={(e) => onChange(exIdx, setIdx, 'reps', e.target.value)}
                readOnly={readOnly}
              />
              {!readOnly && (
                <label className={styles.tpMaxrepToggle}>
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => onToggleMaxRep?.(exIdx, setIdx, true)}
                  />
                  <span>Max</span>
                </label>
              )}
            </>
          )}
        </td>
        <td>
          <input
            type="text"
            value={set.tempo || ''}
            placeholder="30X1"
            onChange={(e) => onChange(exIdx, setIdx, 'tempo', e.target.value)}
            readOnly={readOnly}
          />
        </td>
        <td><span style={{ color: 'var(--text3)', fontSize: 11 }}>&mdash;</span></td>
        <td>
          {!readOnly && (
            <button className={styles.tpSetDel} onClick={() => onRemove(exIdx, setIdx)}>
              <i className="fa-solid fa-times" />
            </button>
          )}
        </td>
      </tr>
    )
  }

  if (set.type === 'rest_pause') {
    return (
      <tr className={`${styles.tpSetRow} ${styles.tpSetRp}`}>
        <td className={styles.tpSetNum}>
          <span className={`${styles.tpSetTypeTag} ${styles.tpTagRp}`}>RP</span>
        </td>
        <td className={styles.tpRpParams}>
          <input
            type="text"
            value={set.reps}
            placeholder="12"
            style={{ width: 30 }}
            onChange={(e) => onChange(exIdx, setIdx, 'reps', e.target.value)}
            readOnly={readOnly}
          />
          <span className={styles.tpRpLbl}>reps</span>
          <input
            type="text"
            value={set.reps_rp || ''}
            placeholder="20"
            style={{ width: 30 }}
            onChange={(e) => onChange(exIdx, setIdx, 'reps_rp', e.target.value)}
            readOnly={readOnly}
          />
          <span className={styles.tpRpLbl}>total</span>
          <span className={styles.tpRpLbl}>RP</span>
          <input
            type="text"
            value={set.rest_pause_time || ''}
            placeholder="15"
            style={{ width: 28 }}
            onChange={(e) => onChange(exIdx, setIdx, 'rest_pause_time', e.target.value)}
            readOnly={readOnly}
          />
          <span className={styles.tpRpLbl}>s</span>
        </td>
        <td><span style={{ color: 'var(--text3)', fontSize: 11 }}>&mdash;</span></td>
        <td><span style={{ color: 'var(--text3)', fontSize: 11 }}>&mdash;</span></td>
        <td>
          {!readOnly && (
            <button className={styles.tpSetDel} onClick={() => onRemove(exIdx, setIdx)}>
              <i className="fa-solid fa-times" />
            </button>
          )}
        </td>
      </tr>
    )
  }

  // Normal set
  return (
    <tr className={styles.tpSetRow}>
      <td className={styles.tpSetNum}>{setIdx + 1}</td>
      <td>
        <input
          type="text"
          value={set.reps}
          placeholder="8-12"
          onChange={(e) => onChange(exIdx, setIdx, 'reps', e.target.value)}
          readOnly={readOnly}
        />
      </td>
      <td>
        <input
          type="text"
          value={set.tempo || ''}
          placeholder="30X1"
          onChange={(e) => onChange(exIdx, setIdx, 'tempo', e.target.value)}
          readOnly={readOnly}
        />
      </td>
      <td>
        <input
          type="text"
          value={set.repos || ''}
          placeholder="1m30"
          onChange={(e) => onChange(exIdx, setIdx, 'repos', e.target.value)}
          readOnly={readOnly}
        />
      </td>
      <td>
        {!readOnly && (
          <button className={styles.tpSetDel} onClick={() => onRemove(exIdx, setIdx)}>
            <i className="fa-solid fa-times" />
          </button>
        )}
      </td>
    </tr>
  )
}
