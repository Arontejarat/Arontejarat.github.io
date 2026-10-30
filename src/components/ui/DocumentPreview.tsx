import { useState } from 'react'
import { FileText, Lock, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Dialog } from './overlay'
import { IconButton } from './Button'

export interface PreviewSource {
  fileName: string
  mime: string
  previewUrl?: string
  title: string
}

/**
 * In-app preview. Images render directly; PDFs (and demo files without real
 * content) render a placeholder page. Real files must be streamed through
 * an authorised, short-lived URL — never a public link.
 */
export function DocumentPreview({ source, restricted, className, watermark }: { source: PreviewSource; restricted?: boolean; className?: string; watermark?: string }) {
  const [zoom, setZoom] = useState(1)
  const [full, setFull] = useState(false)
  if (restricted) {
    return (
      <div className={cn('grid place-items-center rounded-lg border border-ink-200 bg-ink-50 p-8 text-center', className)}>
        <div>
          <Lock size={28} className="mx-auto text-ink-400" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-ink-800">پیش‌نمایش برای نقش شما مجاز نیست</p>
          <p className="mt-1 text-xs leading-5 text-ink-500">این مدرک حاوی اطلاعات حساس است و فقط مسئولان مجاز امکان مشاهده آن را دارند.</p>
        </div>
      </div>
    )
  }
  const body = (scale: number) => (
    <div className="relative mx-auto origin-top transition-transform" style={{ transform: `scale(${scale})` }}>
      {source.previewUrl ? (
        <img src={source.previewUrl} alt={`پیش‌نمایش ${source.title}`} className="mx-auto max-h-[70vh] rounded-md shadow-sm" />
      ) : (
        <div className="mx-auto aspect-[1/1.414] w-full max-w-[340px] rounded-md bg-white p-6 shadow-sm ring-1 ring-ink-200">
          <div className="flex items-center gap-2 border-b border-ink-100 pb-3">
            <FileText size={18} className="text-red-600" aria-hidden />
            <span className="truncate text-xs font-semibold text-ink-700" dir="auto">
              {source.fileName}
            </span>
          </div>
          <p className="mt-4 text-center text-sm font-bold text-ink-800">{source.title}</p>
          <div className="mt-5 space-y-2.5" aria-hidden>
            {[90, 100, 84, 96, 70, 100, 88, 60].map((w, i) => (
              <div key={i} className="h-2 rounded bg-ink-100" style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="mt-8 flex justify-between" aria-hidden>
            <div className="h-10 w-20 rounded border border-dashed border-ink-200" />
            <div className="size-12 rounded-full border-2 border-brand-200" />
          </div>
          <p className="mt-6 text-center text-2xs text-ink-400">پیش‌نمایش نمایشی — محتوای واقعی فایل از سرور دریافت می‌شود</p>
        </div>
      )}
      {watermark ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden" aria-hidden>
          <span className="-rotate-30 select-none whitespace-nowrap text-lg font-bold text-ink-900/10">{watermark}</span>
        </div>
      ) : null}
    </div>
  )
  return (
    <div className={cn('rounded-lg border border-ink-200 bg-ink-100/60', className)}>
      <div className="flex items-center justify-end gap-1 border-b border-ink-200 bg-white/70 px-2 py-1.5">
        <IconButton icon={ZoomOut} label="کوچک‌نمایی" size="sm" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} />
        <IconButton icon={ZoomIn} label="بزرگ‌نمایی" size="sm" onClick={() => setZoom((z) => Math.min(2, z + 0.2))} />
        <IconButton icon={Maximize2} label="نمایش تمام‌صفحه" size="sm" onClick={() => setFull(true)} />
      </div>
      <div className="scrollbar-thin max-h-[480px] overflow-auto p-4">{body(zoom)}</div>
      <Dialog open={full} onClose={() => setFull(false)} title={source.title} size="xl">
        <div className="bg-ink-100/60 p-4">{body(1)}</div>
      </Dialog>
    </div>
  )
}
