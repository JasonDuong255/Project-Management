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

interface LoadingState {
  message: string
  count: number
}

interface LoadingContextValue {
  /** Show the global loading overlay until the returned `release()` is called. */
  begin: (message?: string) => () => void
  /** Wrap an async function so the overlay is automatically shown / hidden. */
  run: <T>(message: string, task: () => Promise<T>) => Promise<T>
}

const LoadingContext = createContext<LoadingContextValue | null>(null)

/**
 * Global loading overlay. Multiple concurrent calls are reference-counted —
 * the overlay disappears only when ALL outstanding tasks have released.
 * The message displayed is the most recent one.
 *
 * Usage:
 *   const loading = useLoading()
 *   await loading.run('Đang lưu thay đổi…', () => api.updateProject(...))
 */
export function LoadingOverlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadingState>({ message: '', count: 0 })
  const stack = useRef<string[]>([])

  const begin = useCallback((message = 'Đang xử lý…') => {
    stack.current.push(message)
    setState({ message, count: stack.current.length })
    return () => {
      const idx = stack.current.lastIndexOf(message)
      if (idx >= 0) stack.current.splice(idx, 1)
      setState({
        message: stack.current[stack.current.length - 1] ?? '',
        count: stack.current.length,
      })
    }
  }, [])

  const run = useCallback(
    async <T,>(message: string, task: () => Promise<T>): Promise<T> => {
      const release = begin(message)
      try {
        return await task()
      } finally {
        release()
      }
    },
    [begin],
  )

  const value = useMemo<LoadingContextValue>(() => ({ begin, run }), [begin, run])

  // Lock background scroll while overlay is active.
  useEffect(() => {
    if (state.count > 0) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
    return undefined
  }, [state.count])

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {state.count > 0 ? (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loading-overlay__card">
            <div className="loading-overlay__spinner" aria-hidden />
            <p>{state.message || 'Đang xử lý…'}</p>
          </div>
        </div>
      ) : null}
    </LoadingContext.Provider>
  )
}

export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext)
  if (!ctx) {
    throw new Error('useLoading must be used inside <LoadingOverlayProvider>')
  }
  return ctx
}
