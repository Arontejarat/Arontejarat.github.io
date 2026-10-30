import { useRef, useState } from 'react'
import { Camera, CircleAlert, FileText, ImageIcon, RefreshCw, Trash2, Upload } from 'lucide-react'
import { cn, sleep, uid } from '@/lib/cn'
import { formatFileSize, toFaDigits } from '@/lib/format'
import type { Attachment } from '@/types/domain'
import { useDemo } from '@/mock/store'
import { ProgressBar } from './feedback'
import { IconButton } from './Button'

const TYPE_LABEL: Record<string, string> = { 'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG' }

export function acceptLabel(accept: string[]) {
  return accept.map((a) => TYPE_LABEL[a] ?? a).join('، ')
}

/** Downscales images so demo previews fit in localStorage. Real uploads keep the original. */
export async function makePreview(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return undefined
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, 720 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return undefined
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function validateFile(file: File, accept: string[], maxSizeMb: number): string | null {
  if (!accept.includes(file.type)) return `فایل انتخاب‌شده معتبر نیست. فرمت‌های مجاز: ${acceptLabel(accept)}`
  if (file.size > maxSizeMb * 1024 * 1024) return `حجم فایل بیش از ${toFaDigits(maxSizeMb)} مگابایت است (${formatFileSize(file.size)}).`
  if (file.size === 0) return 'فایل خالی است.'
  return null
}

interface Pending {
  key: string
  file: File
  progress: number
  error?: string
}

export interface FileUploaderProps {
  value: Attachment[]
  onChange: (v: Attachment[]) => void
  accept?: string[]
  maxSizeMb?: number
  maxFiles?: number
  id?: string
  invalid?: boolean
  describedBy?: string
  /** Offer a camera capture button on mobile */
  camera?: boolean
  compact?: boolean
}

export function FileUploader({ value, onChange, accept = ['application/pdf', 'image/jpeg', 'image/png'], maxSizeMb = 5, maxFiles = 3, id, invalid, describedBy, camera = true, compact }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [rejected, setRejected] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const { demo } = useDemo()
  const valueRef = useRef(value)
  valueRef.current = value

  const upload = async (p: Pending) => {
    setPending((xs) => xs.map((x) => (x.key === p.key ? { ...x, progress: 0, error: undefined } : x)))
    for (let pr = 10; pr <= 100; pr += 18) {
      await sleep(demo.slow ? 260 : 90)
      if (demo.failNetwork && pr > 50) {
        setPending((xs) => xs.map((x) => (x.key === p.key ? { ...x, error: 'ارسال فایل به‌دلیل قطع ارتباط ناتمام ماند.' } : x)))
        return
      }
      setPending((xs) => xs.map((x) => (x.key === p.key ? { ...x, progress: Math.min(100, pr) } : x)))
    }
    const previewUrl = await makePreview(p.file)
    const att: Attachment = { id: uid('att'), name: p.file.name, size: p.file.size, mime: p.file.type, uploadedAt: new Date().toISOString(), previewUrl }
    setPending((xs) => xs.filter((x) => x.key !== p.key))
    onChange([...valueRef.current, att])
  }

  const add = (files: FileList | null) => {
    setRejected(null)
    if (!files) return
    const room = maxFiles - value.length - pending.length
    const list = Array.from(files)
    if (list.length > room) setRejected(`حداکثر ${toFaDigits(maxFiles)} فایل قابل بارگذاری است.`)
    list.slice(0, Math.max(0, room)).forEach((file) => {
      const err = validateFile(file, accept, maxSizeMb)
      if (err) {
        setRejected(err)
        return
      }
      const p: Pending = { key: uid('up'), file, progress: 0 }
      setPending((xs) => [...xs, p])
      void upload(p)
    })
    if (inputRef.current) inputRef.current.value = ''
    if (camRef.current) camRef.current.value = ''
  }

  const full = value.length + pending.length >= maxFiles

  return (
    <div className="space-y-2.5">
      {!full ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            add(e.dataTransfer.files)
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center transition-colors',
            compact ? 'px-3 py-4' : 'px-4 py-6',
            drag ? 'border-brand-400 bg-brand-50' : invalid ? 'border-red-300 bg-red-50/40' : 'border-ink-200 bg-ink-25 hover:border-ink-300',
          )}
        >
          <span className="grid size-10 place-items-center rounded-full bg-white text-brand-700 shadow-xs ring-1 ring-ink-200">
            <Upload size={18} aria-hidden />
          </span>
          <div className="text-sm text-ink-700">
            <button type="button" id={id} aria-describedby={describedBy} onClick={() => inputRef.current?.click()} className="font-semibold text-brand-700 hover:underline">
              انتخاب فایل
            </button>
            <span className="hidden sm:inline"> یا رها کردن فایل در این قسمت</span>
          </div>
          <p className="text-xs text-ink-500">
            {acceptLabel(accept)} — حداکثر {toFaDigits(maxSizeMb)} مگابایت{maxFiles > 1 ? `، تا ${toFaDigits(maxFiles)} فایل` : ''}
          </p>
          {camera && accept.some((a) => a.startsWith('image/')) ? (
            <button type="button" onClick={() => camRef.current?.click()} className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 sm:hidden">
              <Camera size={14} aria-hidden /> عکس با دوربین
            </button>
          ) : null}
          <input ref={inputRef} type="file" className="sr-only" tabIndex={-1} accept={accept.join(',')} multiple={maxFiles > 1} onChange={(e) => add(e.target.files)} />
          <input ref={camRef} type="file" className="sr-only" tabIndex={-1} accept="image/*" capture="environment" onChange={(e) => add(e.target.files)} />
        </div>
      ) : null}

      {rejected ? (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-red-700">
          <CircleAlert size={14} className="mt-0.5 shrink-0" /> {rejected}
        </p>
      ) : null}

      {value.length + pending.length > 0 ? (
        <ul className="space-y-2" aria-live="polite">
          {value.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white p-2.5">
              {a.previewUrl ? (
                <img src={a.previewUrl} alt="" className="size-10 shrink-0 rounded-md object-cover ring-1 ring-ink-200" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-red-50 text-red-700">
                  {a.mime === 'application/pdf' ? <FileText size={18} /> : <ImageIcon size={18} />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800" dir="auto">
                  {a.name}
                </p>
                <p className="text-xs text-emerald-700">بارگذاری شد، {formatFileSize(a.size)}</p>
              </div>
              <IconButton icon={Trash2} label={`حذف ${a.name}`} size="sm" variant="danger-ghost" onClick={() => onChange(value.filter((x) => x.id !== a.id))} />
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className={cn('rounded-lg border p-2.5', p.error ? 'border-red-200 bg-red-50/50' : 'border-ink-200 bg-white')}>
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-ink-50 text-ink-500">
                  <FileText size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800" dir="auto">
                    {p.file.name}
                  </p>
                  {p.error ? (
                    <p className="text-xs text-red-700">{p.error}</p>
                  ) : (
                    <ProgressBar value={p.progress} size="sm" className="mt-1.5" label={`در حال ارسال ${p.file.name}`} />
                  )}
                </div>
                {p.error ? (
                  <>
                    <IconButton icon={RefreshCw} label="تلاش دوباره" size="sm" onClick={() => void upload(p)} />
                    <IconButton icon={Trash2} label="حذف" size="sm" variant="danger-ghost" onClick={() => setPending((xs) => xs.filter((x) => x.key !== p.key))} />
                  </>
                ) : (
                  <span className="text-xs tabular text-ink-500">{toFaDigits(p.progress)}٪</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
