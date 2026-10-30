import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Checkbox } from './forms'
import { Popover } from './overlay'
import { Button } from './Button'
import { Pagination } from './layout'

export interface Column<T> {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  sortValue?: (row: T) => string | number
  className?: string
  headerClassName?: string
  hideable?: boolean
  defaultHidden?: boolean
  /** Plain-text label used in the column chooser */
  label?: string
}

export interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  getId: (row: T) => string
  /** Card renderer for small screens; defaults to stacked label/value pairs */
  mobileCard?: (row: T, selection?: ReactNode) => ReactNode
  rowHref?: (row: T) => string
  onRowClick?: (row: T) => void
  selectable?: boolean
  selected?: Set<string>
  onSelectedChange?: (s: Set<string>) => void
  empty?: ReactNode
  pageSize?: number
  initialSort?: { id: string; dir: 'asc' | 'desc' }
  columnChooser?: boolean
  caption?: string
  rowClassName?: (row: T) => string | undefined
  toolbar?: ReactNode
}

export function DataTable<T>({
  rows,
  columns,
  getId,
  mobileCard,
  rowHref,
  onRowClick,
  selectable,
  selected,
  onSelectedChange,
  empty,
  pageSize = 10,
  initialSort,
  columnChooser,
  caption,
  rowClassName,
  toolbar,
}: DataTableProps<T>) {
  const navigate = useNavigate()
  const [sort, setSort] = useState(initialSort)
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id)))
  const [chooserOpen, setChooserOpen] = useState(false)
  const chooserRef = useRef<HTMLButtonElement>(null)
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.id === sort.id)
    if (!col?.sortValue) return rows
    const sv = col.sortValue
    return [...rows].sort((a, b) => {
      const x = sv(a)
      const y = sv(b)
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fa')
      return sort.dir === 'asc' ? r : -r
    })
  }, [rows, sort, columns])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
  const visible = columns.filter((c) => !hidden.has(c.id))

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected?.has(getId(r)))
  const someOnPage = pageRows.some((r) => selected?.has(getId(r)))
  const toggleAll = () => {
    const next = new Set(selected)
    if (allOnPage) pageRows.forEach((r) => next.delete(getId(r)))
    else pageRows.forEach((r) => next.add(getId(r)))
    onSelectedChange?.(next)
  }
  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange?.(next)
  }

  const activate = (row: T) => {
    if (onRowClick) onRowClick(row)
    else if (rowHref) navigate(rowHref(row))
  }
  const interactive = Boolean(onRowClick || rowHref)

  if (rows.length === 0) return <>{empty}</>

  return (
    <div>
      {toolbar || columnChooser ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">{toolbar}</div>
          {columnChooser ? (
            <>
              <Button ref={chooserRef} variant="ghost" size="sm" icon={Columns3} onClick={() => setChooserOpen((o) => !o)} aria-expanded={chooserOpen} className="max-md:hidden">
                ستون‌ها
              </Button>
              <Popover open={chooserOpen} onClose={() => setChooserOpen(false)} anchorRef={chooserRef} align="end" label="انتخاب ستون‌ها" className="w-56 p-2">
                <p className="px-2 pb-1.5 pt-1 text-xs font-semibold text-ink-500">ستون‌های قابل نمایش</p>
                {columns
                  .filter((c) => c.hideable)
                  .map((c) => (
                    <Checkbox
                      key={c.id}
                      className="rounded-md px-2 py-1.5 hover:bg-ink-50"
                      label={c.label ?? String(c.header)}
                      checked={!hidden.has(c.id)}
                      onChange={(v) => {
                        const next = new Set(hidden)
                        if (v) next.delete(c.id)
                        else next.add(c.id)
                        setHidden(next)
                      }}
                    />
                  ))}
              </Popover>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-xl border border-ink-200/80 bg-white shadow-xs md:block">
        <div className="scrollbar-thin relative overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead className="bg-ink-50/80">
              <tr>
                {selectable ? (
                  <th scope="col" className="w-10 border-b border-ink-200 px-3 py-2.5">
                    <Checkbox checked={allOnPage} indeterminate={!allOnPage && someOnPage} onChange={toggleAll} aria-label="انتخاب همه ردیف‌های این صفحه" />
                  </th>
                ) : null}
                {visible.map((c) => {
                  const active = sort?.id === c.id
                  return (
                    <th
                      key={c.id}
                      scope="col"
                      aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cn('whitespace-nowrap border-b border-ink-200 px-3 py-2.5 text-start text-xs font-semibold text-ink-600', c.headerClassName)}
                    >
                      {c.sortValue ? (
                        <button
                          className="inline-flex items-center gap-1 rounded hover:text-ink-900"
                          onClick={() => setSort(active && sort!.dir === 'asc' ? { id: c.id, dir: 'desc' } : active && sort!.dir === 'desc' ? undefined : { id: c.id, dir: 'asc' })}
                        >
                          {c.header}
                          {active ? sort!.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ArrowUpDown size={13} className="text-ink-300" />}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const id = getId(row)
                const isSel = selected?.has(id)
                return (
                  <tr
                    key={id}
                    onClick={interactive ? (e) => {
                      // Ignore clicks on interactive children (editors, menus, links)
                      if ((e.target as HTMLElement).closest('button,a,input,select,textarea,[data-no-row-click]')) return
                      activate(row)
                    } : undefined}
                    className={cn(
                      'border-b border-ink-100 last:border-0 transition-colors',
                      interactive && 'cursor-pointer hover:bg-ink-25',
                      isSel && 'bg-brand-50/50 hover:bg-brand-50/70',
                      rowClassName?.(row),
                    )}
                  >
                    {selectable ? (
                      <td className="px-3 py-2.5">
                        <Checkbox checked={Boolean(isSel)} onChange={() => toggle(id)} aria-label="انتخاب ردیف" />
                      </td>
                    ) : null}
                    {visible.map((c) => (
                      <td key={c.id} className={cn('px-3 py-2.5 align-middle text-ink-800', c.className)}>
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2.5 md:hidden">
        {pageRows.map((row) => {
          const id = getId(row)
          const sel = selectable ? <Checkbox checked={Boolean(selected?.has(id))} onChange={() => toggle(id)} aria-label="انتخاب" /> : undefined
          return (
            <li key={id}>
              {mobileCard ? (
                <div
                  onClick={interactive ? (e) => {
                    if ((e.target as HTMLElement).closest('button,a,input,select,textarea,[data-no-row-click]')) return
                    activate(row)
                  } : undefined}
                  className={cn('rounded-xl border border-ink-200/80 bg-white p-3.5 shadow-xs', interactive && 'cursor-pointer active:bg-ink-25')}
                >
                  {mobileCard(row, sel)}
                </div>
              ) : (
                <div className="rounded-xl border border-ink-200/80 bg-white p-3.5 shadow-xs" onClick={interactive ? () => activate(row) : undefined}>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {visible.map((c) => (
                      <div key={c.id} className="min-w-0">
                        <dt className="text-2xs text-ink-500">{c.label ?? c.header}</dt>
                        <dd className="text-sm">{c.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <Pagination page={safePage} pageCount={pageCount} onChange={setPage} total={sorted.length} pageSize={pageSize} />
    </div>
  )
}
