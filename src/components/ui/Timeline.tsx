import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Tone } from '@/config/status'
import { toneClasses } from './feedback'

export interface TimelineItem {
  id: string
  title: ReactNode
  time?: ReactNode
  body?: ReactNode
  icon: LucideIcon
  tone?: Tone
  /** Future / pending step rendered hollow */
  pending?: boolean
  current?: boolean
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('relative', className)}>
      {items.map((it, i) => {
        const Icon = it.icon
        const tone = it.tone ?? 'neutral'
        return (
          <li key={it.id} className="relative flex gap-3 pb-5 last:pb-0" aria-current={it.current ? 'step' : undefined}>
            {i < items.length - 1 ? <span className={cn('absolute start-[15px] top-8 bottom-0 w-px', it.pending ? 'border-s border-dashed border-ink-300' : 'bg-ink-200')} aria-hidden /> : null}
            <span
              className={cn(
                'relative z-[1] grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-white',
                it.pending ? 'border border-dashed border-ink-300 bg-white text-ink-400' : cn(toneClasses[tone].soft, toneClasses[tone].text),
                it.current && 'ring-brand-100',
              )}
            >
              <Icon size={15} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className={cn('text-sm font-semibold', it.pending ? 'text-ink-500' : 'text-ink-900')}>{it.title}</p>
                {it.time ? <span className="text-xs text-ink-500 tabular">{it.time}</span> : null}
              </div>
              {it.body ? <div className="mt-1 text-[13px] leading-6 text-ink-600">{it.body}</div> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
