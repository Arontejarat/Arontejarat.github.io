import { useRef, useState } from 'react'
import { Button, Dialog, useToast } from '@/components/ui'
import { useActions } from '@/auth/auth'
import { readFile } from '@/lib/fileStorage'
import { printDocument } from '@/lib/printDocument'
import { BrandedPayslip } from './CompanyDocument'
import type { Employee, Payslip } from '@/types/domain'

export function PayslipActions({ payslip, employee }: { payslip: Payslip; employee: Employee }) {
  const actions = useActions(); const toast = useToast(); const [busy, setBusy] = useState(false); const [preview, setPreview] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const original = async (print = false) => {
    if (busy) return
    const win = print ? window.open('', '_blank') : null
    if (print && !win) { toast.error('برای چاپ اجازه باز شدن پنجره را بدهید.'); return }
    setBusy(true)
    try {
      const file = await actions.payslipFile(payslip.id, payslip.version)
      const blob = await readFile(file.storageKey!)
      if (!blob) throw new Error('فایل اصلی در این مرورگر پیدا نشد؛ دوباره از شرکت دریافت کنید.')
      const url = URL.createObjectURL(blob)
      if (win) {
        win.document.title = 'چاپ اصل فیش'
        const style = win.document.createElement('style'); style.textContent = '@media print{button{display:none}}img{max-width:100%;height:auto!important}'; win.document.head.appendChild(style)
        const frame = win.document.createElement(file.mime === 'application/pdf' ? 'iframe' : 'img')
        frame.setAttribute('src', url); frame.style.width = '100%'; frame.style.height = '90vh'
        win.document.body.appendChild(frame)
        const button = win.document.createElement('button'); button.textContent = 'چاپ / ذخیره PDF'; button.onclick = () => { if (frame.tagName === 'IFRAME') (frame as HTMLIFrameElement).contentWindow?.print(); else win.print() }; win.document.body.prepend(button)
        win.addEventListener('beforeunload', () => URL.revokeObjectURL(url))
      } else { const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000) }
    } catch (e) { win?.close(); toast.fromError(e) } finally { setBusy(false) }
  }
  return <div className="flex flex-wrap gap-2" data-no-row-click>
    {payslip.file ? <><Button size="sm" variant="outline" loading={busy} onClick={(e) => { e.stopPropagation(); void original() }}>دریافت اصل فیش</Button><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void original(true) }}>چاپ اصل / PDF</Button></> : null}
    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setPreview(true) }}>{payslip.source === 'file' ? 'پیش‌نمایش برگه رسمی پیوست' : 'پیش‌نمایش و دریافت PDF'}</Button>
    <Dialog open={preview} onClose={() => setPreview(false)} title={payslip.source === 'file' ? 'برگه رسمی همراه؛ اصل فایل تغییر نمی‌کند' : 'پیش‌نمایش فیش با قالب شرکت'} size="xl" footer={<Button onClick={() => { try { printDocument(ref.current) } catch (e) { toast.fromError(e) } }}>چاپ / ذخیره به PDF</Button>}><div ref={ref}><BrandedPayslip payslip={payslip} employee={employee} /></div></Dialog>
  </div>
}
