import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { readFile } from '@/lib/fileStorage'
import type { Attachment } from '@/types/domain'
import { Button } from './Button'
import { Callout } from './feedback'

/** Blob URLs live only for the mounted viewer and are never persisted. */
export function StoredFile({ file, allowDownload = true }: { file: Attachment; allowDownload?: boolean }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    let objectUrl = ''
    setUrl('')
    setError('')
    if (!file.storageKey) { setError('فایل اصلی این رکورد نمایشی در دسترس نیست.'); return }
    readFile(file.storageKey).then((blob) => {
      if (!alive) return
      if (!blob) { setError('فایل در این مرورگر پیدا نشد؛ از فرستنده بخواهید دوباره بارگذاری کند.'); return }
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => { if (alive) setError('دریافت فایل انجام نشد؛ دوباره تلاش کنید.') })
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [file.storageKey, attempt])
  if (error) return <Callout tone="warning" action={<Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>تلاش دوباره</Button>}>{error}</Callout>
  if (!url) return <p role="status" className="p-4 text-sm text-ink-600">در حال دریافت فایل…</p>
  return <div className="space-y-4">
    {allowDownload ? <a href={url} download={file.name} className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700"><Download size={16} aria-hidden />دریافت فایل <bdi className="max-w-56 truncate">{file.name}</bdi></a> : null}
    {file.mime === 'application/pdf' ? <iframe title={file.name} src={url + '#view=FitH'} className="h-[65vh] w-full rounded-lg border border-ink-200" /> : file.mime.startsWith('image/') ? <img src={url} alt={file.name} className="mx-auto max-h-[65vh] max-w-full object-contain" /> : <p className="text-sm text-ink-600">برای مشاهده فایل Excel، آن را دریافت کنید.</p>}
  </div>
}
