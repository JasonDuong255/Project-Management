import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ConfirmTone = 'default' | 'danger' | 'primary'

export interface ConfirmOptions {
  title: string
  description?: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
}

interface OpenDialog extends ConfirmOptions {
  resolve: (decision: boolean) => void
}

interface ConfirmContextValue {
  /** Returns a promise that resolves true when the user confirms, false otherwise. */
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

/**
 * Promise-based confirmation modal. Use anywhere we previously called
 * `window.confirm(...)`. The look-and-feel matches the rest of the app's
 * modals (modal-backdrop + modal-card).
 *
 * Usage:
 *   const { confirm } = useConfirm()
 *   if (await confirm({ title: 'Xoá tài liệu?', tone: 'danger' })) { ... }
 */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<OpenDialog | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setDialog({ ...options, resolve })
      }),
    [],
  )

  const value = useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm])

  function close(decision: boolean) {
    if (!dialog) return
    dialog.resolve(decision)
    setDialog(null)
  }

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => close(false)}
        >
          <section
            className="modal-card confirm-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-card__header">
              <div className={`confirm-card__icon confirm-card__icon--${dialog.tone ?? 'default'}`}>
                {dialog.tone === 'danger' ? (
                  <AlertTriangle size={22} />
                ) : (
                  <CheckCircle2 size={22} />
                )}
              </div>
              <div className="confirm-card__body">
                <h3>{dialog.title}</h3>
                {dialog.description ? (
                  typeof dialog.description === 'string' ? (
                    <p>{dialog.description}</p>
                  ) : (
                    dialog.description
                  )
                ) : null}
              </div>
              <button
                type="button"
                className="confirm-card__close ghost-button icon-button"
                onClick={() => close(false)}
                aria-label="Đóng"
              >
                <X size={16} />
              </button>
            </div>

            <div className="confirm-card__actions">
              <button type="button" className="ghost-button" onClick={() => close(false)}>
                {dialog.cancelLabel ?? 'Huỷ'}
              </button>
              <button
                type="button"
                className={
                  dialog.tone === 'danger'
                    ? 'primary-button primary-button--danger'
                    : 'primary-button'
                }
                onClick={() => close(true)}
                autoFocus
              >
                {dialog.confirmLabel ?? 'Xác nhận'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used inside <ConfirmDialogProvider>')
  }
  return ctx
}
