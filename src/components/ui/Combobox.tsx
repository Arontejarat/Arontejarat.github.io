import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Search, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { controlBase, controlState } from './forms'
import { Popover } from './overlay'

export interface ComboOption {
  value: string
  label: string
  group?: string
  description?: string
  icon?: LucideIcon
  keywords?: string[]
  disabled?: boolean
}

export interface ComboboxProps {
  value: string
  onChange: (v: string) => void
  options: ComboOption[]
  placeholder?: string
  searchPlaceholder?: string
  id?: string
  invalid?: boolean
  describedBy?: string
  emptyText?: ReactNode
}

/** Normalise Arabic/Persian variants (ي/ی، ك/ک) so search works for both keyboards */
const norm = (s: string) => s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').toLowerCase()

export function Combobox({ value, onChange, options, placeholder = 'انتخاب کنید', searchPlaceholder = 'جست‌وجو…', id, invalid, describedBy, emptyText = 'موردی یافت نشد.' }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = norm(query.trim())
    if (!q) return options
    return options.filter((o) => norm([o.label, o.group, o.description, ...(o.keywords ?? [])].filter(Boolean).join(' ')).includes(q))
  }, [options, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    }
  }, [open, options, value])

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (o: ComboOption) => {
    if (o.disabled) return
    onChange(o.value)
    setOpen(false)
    anchorRef.current?.focus()
  }

  let lastGroup: string | undefined
  return (
    <>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(controlBase, controlState(invalid), 'flex min-h-11 items-center gap-2.5 px-3 py-2 text-start')}
      >
        {selected?.icon ? <selected.icon size={18} className="shrink-0 text-brand-700" aria-hidden /> : null}
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="block truncate font-medium text-ink-900">{selected.label}</span>
              {selected.group ? <span className="block text-2xs text-ink-500">{selected.group}</span> : null}
            </>
          ) : (
            <span className="text-ink-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={18} className="shrink-0 text-ink-400" aria-hidden />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} className="w-[min(92vw,420px)] overflow-hidden" role="presentation">
        <div className="border-b border-ink-100 p-2">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
              aria-autocomplete="list"
              value={query}
              placeholder={searchPlaceholder}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActive((a) => Math.min(a + 1, filtered.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((a) => Math.max(a - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  if (filtered[active]) choose(filtered[active])
                }
              }}
              className="h-10 w-full rounded-md border border-ink-200 bg-ink-25 ps-9 pe-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100"
            />
          </div>
        </div>
        <div ref={listRef} id={listId} role="listbox" className="scrollbar-thin max-h-[min(60vh,380px)] overflow-y-auto p-1.5">
          {filtered.length === 0 ? <p className="px-3 py-6 text-center text-sm text-ink-500">{emptyText}</p> : null}
          {filtered.map((o, i) => {
            const header = o.group && o.group !== lastGroup ? o.group : null
            lastGroup = o.group
            const Icon = o.icon
            return (
              <div key={o.value}>
                {header ? <div className="px-2.5 pb-1 pt-2.5 text-2xs font-bold text-ink-500">{header}</div> : null}
                <div
                  id={`${listId}-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={o.value === value}
                  aria-disabled={o.disabled || undefined}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2',
                    i === active && 'bg-brand-50',
                    o.disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {Icon ? <Icon size={18} className="mt-0.5 shrink-0 text-ink-500" aria-hidden /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink-900">{o.label}</span>
                    {o.description ? <span className="block text-xs leading-5 text-ink-500">{o.description}</span> : null}
                  </span>
                  {o.value === value ? <Check size={16} className="mt-1 shrink-0 text-brand-700" aria-hidden /> : null}
                </div>
              </div>
            )
          })}
        </div>
      </Popover>
    </>
  )
}
