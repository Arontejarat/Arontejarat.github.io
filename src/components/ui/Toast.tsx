import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn, uid } from '@/lib/cn'
import { ApiError } from '@/mock/actions'

type ToastTone = 'success' | 'error' | 'info' | 'warning'
interface ToastItem {
  id: string
  tone: ToastTone
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

interface ToastApi {
  show: (t: Omit<ToastItem, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  /** Maps an ApiError (or unknown error) to a clear Persian message */
  fromError: (e: unknown, fallback?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const toneMeta = {
  success: { icon: CircleCheck, cls: 'text-emerald-600' },
  error: { icon: CircleAlert, cls: 'text-red-600' },
  info: { icon: Info, cls: 'text-sky-600' },
  warning: { icon: TriangleAlert, cls: 'text-amber-600' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: string) => setItems((xs) => xs.filter((x) => x.id !== id)), [])
  const show = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = uid('toast')
      setItems((xs) => [...xs.slice(-3), { ...t, id }])
      setTimeout(() => dismiss(id), t.tone === 'error' ? 7000 : 4500)
    },
    [dismiss],
  )
  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ tone: 'success', title, description }),
      error: (title, description) => show({ tone: 'error', title, description }),
      info: (title, description) => show({ tone: 'info', title, description }),
      fromError: (e, fallback = 'عملیات انجام نشد') => {
        if (e instanceof ApiError) {
          const titles: Record<ApiError['code'], string> = {
            network: 'خطای ارتباط',
            conflict: 'تداخل در وضعیت',
            duplicate: 'درخواست تکراری',
            forbidden: 'دسترسی مجاز نیست',
            validation: 'اطلاعات واردشده نیازمند اصلاح است',
            expired: 'مهلت انجام عملیات پایان یافته است',
            not_found: 'مورد یافت نشد',
          }
          show({ tone: e.code === 'network' ? 'warning' : 'error', title: titles[e.code], description: e.message })
        } else show({ tone: 'error', title: fallback, description: 'لطفاً دوباره تلاش کنید.' })
      },
    }),
    [show],
  )
  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:top-4 sm:items-start sm:ps-6">
          {items.map((t) => {
            const M = toneMeta[t.tone]
            return (
              <div
                key={t.id}
                role={t.tone === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-lg border border-ink-200 bg-white p-3.5 shadow-lg"
              >
                <M.icon size={20} className={cn('mt-0.5 shrink-0', M.cls)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">{t.title}</p>
                  {t.description ? <p className="mt-0.5 text-[13px] leading-6 text-ink-600">{t.description}</p> : null}
                  {t.action ? (
                    <button onClick={t.action.onClick} className="mt-1.5 text-sm font-semibold text-brand-700 hover:underline">
                      {t.action.label}
                    </button>
                  ) : null}
                </div>
                <button onClick={() => dismiss(t.id)} className="grid size-7 shrink-0 place-items-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="بستن اعلان">
                  <X size={16} />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast outside ToastProvider')
  return ctx
}
