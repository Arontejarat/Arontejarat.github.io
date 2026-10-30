import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { TriangleAlert, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button, type ButtonVariant } from './Button'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

let openLayers = 0

/** Shared modal behaviour: focus trap, Esc, scroll lock, focus restore. */
function useModal(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLElement | null>, dismissable = true) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    openLayers += 1
    document.body.style.overflow = 'hidden'
    const panel = panelRef.current
    const t = setTimeout(() => {
      const auto = panel?.querySelector<HTMLElement>('[data-autofocus]')
      const first = auto ?? panel?.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel)?.focus()
    }, 20)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) {
        // Only close the top-most layer
        const layers = document.querySelectorAll('[data-layer]')
        if (layers[layers.length - 1] === panel?.closest('[data-layer]')) {
          e.stopPropagation()
          onCloseRef.current()
        }
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      openLayers -= 1
      if (openLayers === 0) document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [open, panelRef, dismissable])
}

/* ------------------------------------------------------------------ */

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: LucideIcon
  tone?: 'default' | 'danger' | 'warning'
  /** Prevent closing via backdrop / Esc (e.g. while submitting) */
  dismissable?: boolean
}

export function Dialog({ open, onClose, title, description, children, footer, size = 'md', icon: Icon, tone = 'default', dismissable = true }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  useModal(open, onClose, panelRef, dismissable)
  if (!open) return null
  const width = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size]
  return createPortal(
    <div data-layer className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-ink-900/45 backdrop-blur-[2px]" onClick={() => dismissable && onClose()} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-slide-up flex-col rounded-t-2xl bg-white shadow-lg focus:outline-none sm:rounded-xl',
          width,
        )}
      >
        <div className="flex items-start gap-3 border-b border-ink-100 px-5 py-4">
          {Icon ? (
            <span
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-full',
                tone === 'danger' ? 'bg-red-50 text-red-600' : tone === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-700',
              )}
            >
              <Icon size={20} aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-sm leading-6 text-ink-600">
                {description}
              </p>
            ) : null}
          </div>
          {dismissable ? (
            <button onClick={onClose} className="-me-1 grid size-9 shrink-0 place-items-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-800" aria-label="بستن">
              <X size={20} />
            </button>
          ) : null}
        </div>
        {children ? <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
        {footer ? <div className="flex flex-col-reverse gap-2 border-t border-ink-100 px-5 py-3.5 pb-safe sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'md' | 'lg' | 'xl'
  dismissable?: boolean
}

/** Side sheet; enters from the start (right) edge in RTL, full-screen on mobile */
export function Drawer({ open, onClose, title, description, children, footer, width = 'md', dismissable = true }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useModal(open, onClose, panelRef, dismissable)
  if (!open) return null
  const w = { md: 'sm:max-w-md', lg: 'sm:max-w-xl', xl: 'sm:max-w-3xl' }[width]
  return createPortal(
    <div data-layer className="fixed inset-0 z-50 flex justify-start">
      <div className="absolute inset-0 animate-fade-in bg-ink-900/40" onClick={() => dismissable && onClose()} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('relative flex h-full w-full animate-slide-in-start flex-col bg-white shadow-lg focus:outline-none', w)}
      >
        <div className="flex items-start gap-3 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-sm text-ink-600">{description}</p> : null}
          </div>
          <button onClick={onClose} className="-me-1 grid size-9 place-items-center rounded-md text-ink-500 hover:bg-ink-100" aria-label="بستن">
            <X size={20} />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex flex-col-reverse gap-2 border-t border-ink-100 px-5 py-3.5 pb-safe sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ */

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger' | 'warning'
  icon?: LucideIcon
  children?: ReactNode
  confirmDisabled?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  tone = 'default',
  icon,
  children,
  confirmDisabled,
  loading,
}: ConfirmDialogProps) {
  const variant: ButtonVariant = tone === 'danger' ? 'danger' : 'primary'
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      tone={tone}
      icon={icon ?? (tone !== 'default' ? TriangleAlert : undefined)}
      dismissable={!loading}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={() => onConfirm()} loading={loading} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Popover positioning (fixed, portal) — escapes overflow containers    */
/* ------------------------------------------------------------------ */

function usePopoverPosition(open: boolean, anchor: React.RefObject<HTMLElement | null>, panel: React.RefObject<HTMLElement | null>, align: 'start' | 'end') {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const update = useCallback(() => {
    const a = anchor.current?.getBoundingClientRect()
    const p = panel.current?.getBoundingClientRect()
    if (!a || !p) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    // In RTL "start" is the right edge of the anchor
    let left = align === 'start' ? a.right - p.width : a.left
    left = Math.max(8, Math.min(left, vw - p.width - 8))
    let top = a.bottom + 6
    if (top + p.height > vh - 8 && a.top - p.height - 6 > 8) top = a.top - p.height - 6
    setPos({ top, left })
  }, [anchor, panel, align])
  useLayoutEffect(() => {
    if (!open) return
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, update])
  return pos
}

export interface MenuItem {
  label: string
  icon?: LucideIcon
  onSelect: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
  hint?: string
}

export interface DropdownMenuProps {
  trigger: ReactElement<Record<string, unknown>>
  items: (MenuItem | 'separator' | { heading: string })[]
  align?: 'start' | 'end'
  header?: ReactNode
  minWidth?: number
}

export function DropdownMenu({ trigger, items, align = 'start', header, minWidth = 200 }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const pos = usePopoverPosition(open, anchorRef, panelRef, align)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        anchorRef.current?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const els = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
        const i = els.indexOf(document.activeElement as HTMLElement)
        const next = e.key === 'ArrowDown' ? (i + 1) % els.length : (i - 1 + els.length) % els.length
        els[next]?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    setTimeout(() => panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus(), 10)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const triggerEl = cloneElement(trigger, {
    ref: anchorRef,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation()
      setOpen((o) => !o)
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
  })

  return (
    <>
      {triggerEl}
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={menuId}
              role="menu"
              style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, minWidth }}
              className="fixed z-[60] animate-fade-in overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              {header}
              {items.map((it, i) => {
                if (it === 'separator') return <div key={i} className="my-1 h-px bg-ink-100" role="separator" />
                if ('heading' in it)
                  return (
                    <div key={i} className="px-3 pb-1 pt-2 text-2xs font-semibold text-ink-500">
                      {it.heading}
                    </div>
                  )
                const Icon = it.icon
                return (
                  <button
                    key={i}
                    role="menuitem"
                    disabled={it.disabled}
                    title={it.hint}
                    onClick={() => {
                      setOpen(false)
                      it.onSelect()
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-45',
                      it.tone === 'danger' ? 'text-red-700 hover:bg-red-50 focus:bg-red-50' : 'text-ink-800 hover:bg-ink-50 focus:bg-ink-100',
                    )}
                  >
                    {Icon ? <Icon size={16} aria-hidden className={it.tone === 'danger' ? '' : 'text-ink-500'} /> : null}
                    <span className="flex-1">{it.label}</span>
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

/** Generic anchored popover panel (used by date pickers, comboboxes, column chooser) */
export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  align = 'start',
  className,
  role = 'dialog',
  label,
}: {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  children: ReactNode
  align?: 'start' | 'end'
  className?: string
  role?: string
  label?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(open, anchorRef, panelRef, align)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) onCloseRef.current()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        anchorRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, anchorRef])
  if (!open) return null
  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-label={label}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className={cn('fixed z-[70] animate-fade-in rounded-lg border border-ink-200 bg-white shadow-md', className)}
    >
      {children}
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ */

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactElement<Record<string, unknown>>; side?: 'top' | 'bottom' }) {
  const id = useId()
  return (
    <span className="group/tt relative inline-flex">
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute start-1/2 z-40 w-max max-w-64 translate-x-1/2 rounded-md bg-ink-900 px-2.5 py-1.5 text-xs leading-5 text-white opacity-0 shadow-md transition-opacity delay-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        )}
      >
        {content}
      </span>
    </span>
  )
}
