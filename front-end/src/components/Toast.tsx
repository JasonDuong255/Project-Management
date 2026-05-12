import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ToastTone = 'success' | 'info' | 'warning' | 'danger'

export interface ToastInput {
  title: string
  description?: string
  tone?: ToastTone
  /** Time in ms before auto-dismiss. Default 4000. Pass 0 to disable auto-dismiss. */
  durationMs?: number
}

interface ToastItem extends Required<Omit<ToastInput, 'description'>> {
  id: string
  description?: string
}

interface ToastContextValue {
  show: (input: ToastInput) => string
  dismiss: (id: string) => void
  success: (title: string, description?: string) => string
  info: (title: string, description?: string) => string
  warning: (title: string, description?: string) => string
  error: (title: string, description?: string) => string
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * Global toast notification system. Renders in the bottom-right corner of
 * the viewport. Replaces inline `form-success` messages app-wide.
 *
 * Usage:
 *   const toast = useToast()
 *   toast.success('Đã lưu thay đổi', 'Tài liệu HD-2026/001')
 *   toast.error('Cập nhật thất bại', err.message)
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])

  const show = useCallback(
    (input: ToastInput): string => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const tone: ToastTone = input.tone ?? 'info'
      const durationMs = input.durationMs ?? 4000
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        tone,
        durationMs,
      }
      setToasts((items) => [...items, item])
      if (durationMs > 0) {
        const timer = setTimeout(() => dismiss(id), durationMs)
        timers.current.set(id, timer)
      }
      return id
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      dismiss,
      success: (title, description) => show({ title, description, tone: 'success' }),
      info: (title, description) => show({ title, description, tone: 'info' }),
      warning: (title, description) => show({ title, description, tone: 'warning' }),
      error: (title, description) =>
        show({ title, description, tone: 'danger', durationMs: 6000 }),
    }),
    [show, dismiss],
  )

  useEffect(() => {
    const map = timers.current
    return () => {
      for (const timer of map.values()) clearTimeout(timer)
      map.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="region" aria-label="Thông báo">
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return ctx
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon =
    item.tone === 'success'
      ? CheckCircle2
      : item.tone === 'danger'
        ? XCircle
        : item.tone === 'warning'
          ? TriangleAlert
          : Info

  return (
    <div className={`toast-card toast-card--${item.tone}`} role="status">
      <Icon size={18} className="toast-card__icon" />
      <div className="toast-card__body">
        <strong>{item.title}</strong>
        {item.description ? <p>{item.description}</p> : null}
      </div>
      <button
        type="button"
        className="toast-card__close"
        onClick={onDismiss}
        aria-label="Đóng thông báo"
      >
        <X size={14} />
      </button>
    </div>
  )
}
