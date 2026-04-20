'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type ToastType = 'success' | 'error' | 'warning'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  // Only mount the portal after hydration — the `typeof document` guard
  // produces different JSX between SSR (false) and client (portal element),
  // causing React error #418 hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 9998,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {toasts.map((t) => (
              <div key={t.id} className={`notification show ${t.type}`}>
                <i
                  className={`fa-solid ${
                    t.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'
                  }`}
                />
                <span style={{ flex: 1 }}>{t.message}</span>
                <button
                  className="btn-icon"
                  onClick={() => dismiss(t.id)}
                  aria-label="Fermer"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
