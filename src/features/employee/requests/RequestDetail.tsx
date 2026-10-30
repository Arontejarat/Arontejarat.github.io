import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { Ban, CheckCheck, CircleCheck, CircleX, Copy, FilePen, Hourglass, MessageSquare, Pencil, Printer, RotateCcw, Send, UserCheck, Lock, Plus, ListChecks } from 'lucide-react'
import { Button, ButtonLink, Callout, Card, CardHeader, ConfirmDialog, Dialog, DocumentPreview, Field, PageHeader, PageState, StatusBadge, Textarea, useToast, Badge, Ltr } from '@/components/ui'
import { useActions, useCurrentEmployee } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { requestType } from '@/mock/selectors'
import { REQUEST_STATUS } from '@/config/status'
import { PARTY_LABEL } from '@/config/requestTypes'
import { formatDate, formatDeadline, toFaDigits } from '@/lib/format'
import { cn } from '@/lib/cn'
import { AttachmentList, RequestHistory, RequestProgress, RequestValues } from '@/features/requests/RequestViews'
import { DynamicForm } from '@/features/requests/DynamicForm'
import { collectAttachments, computeValues, validate, type FormErrors, type FormValues } from '@/features/requests/logic'
import { OperationResult } from '@/features/system/SystemPages'
import type { EmployeeRequest } from '@/types/domain'

function useMyRequest() {
  const { id } = useParams()
  const db = useDB()
  const emp = useCurrentEmployee()
  // Ownership check mirrors the server rule: an employee can only open their own requests
  const r = db.requests.find((x) => x.id === id)
  return { r: r && r.employeeId === emp.id ? r : undefined, exists: Boolean(r), emp, db }
}

export function RequestDetailPage() {
  const { r, exists } = useMyRequest()
  if (!r) return exists ? <Navigate to="/forbidden" replace /> : <Navigate to="/me/requests" replace />
  if (r.status === 'draft') return <Navigate to={`/me/requests/new?draft=${r.id}`} replace />
  return <PageState variant="detail" loadKey={r.id}>{() => <Detail r={r} />}</PageState>
}

function Detail({ r }: { r: EmployeeRequest }) {
  const db = useDB()
  const emp = useCurrentEmployee()
  const type = requestType(db, r.typeId)!
  const actions = useActions()
  const toast = useToast()
  const navigate = useNavigate()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('')
  const [preview, setPreview] = useState<number | null>(null)
  const meta = REQUEST_STATUS[r.status]
  const canCancel = ['submitted', 'needs_correction'].includes(r.status) || (r.status === 'in_review' && !r.steps.some((s) => s.status === 'approved'))
  const open = ['submitted', 'in_review', 'needs_correction'].includes(r.status)
  const active = r.steps[r.currentStep]
  const due = open && r.dueAt ? formatDeadline(r.dueAt) : null

  const doCancel = async () => {
    setBusy(true)
    try {
      await actions.cancelRequest(r.id, cancelReason)
      setCancelOpen(false)
      navigate(`/me/requests/${r.id}/result?kind=cancelled`, { replace: true })
    } catch (e) {
      toast.fromError(e)
    } finally {
      setBusy(false)
    }
  }

  const sendReply = async () => {
    if (!reply.trim()) return
    setBusy(true)
    try {
      await actions.addRequestMessage(r.id, reply.trim())
      setReply('')
      toast.success('پیام شما ارسال شد')
    } catch (e) {
      toast.fromError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={type.title}
        breadcrumbs={[{ label: 'داشبورد', to: '/me' }, { label: 'مرکز درخواست‌ها', to: '/me/requests' }, { label: `درخواست ${toFaDigits(r.trackingNo)}` }]}
        back={{ to: '/me/requests', label: 'درخواست‌های من' }}
        meta={
          <>
            <StatusBadge meta={meta} />
            <span className="inline-flex items-center gap-1 text-xs text-ink-500">
              شماره پیگیری: <Ltr className="font-semibold text-ink-800">{toFaDigits(r.trackingNo)}</Ltr>
              <button
                type="button"
                className="grid size-6 place-items-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label="کپی شماره پیگیری"
                onClick={() => {
                  navigator.clipboard?.writeText(r.trackingNo)
                  toast.info('شماره پیگیری کپی شد')
                }}
              >
                <Copy size={13} />
              </button>
            </span>
            {r.confidential ? (
              <Badge tone="neutral" icon={Lock} size="sm">
                محرمانه
              </Badge>
            ) : null}
          </>
        }
        actions={
          <>
            <Button variant="ghost" icon={Printer} onClick={() => window.print()} className="no-print">
              چاپ
            </Button>
            {canCancel ? (
              <Button variant="danger-ghost" icon={Ban} onClick={() => setCancelOpen(true)}>
                لغو درخواست
              </Button>
            ) : null}
          </>
        }
      />

      {/* State-specific guidance */}
      <div className="mb-5 space-y-3">
        {r.status === 'needs_correction' ? (
          <Callout
            tone="warning"
            icon={RotateCcw}
            title="درخواست شما برای اصلاح برگشت داده شده است"
            action={
              <ButtonLink to={`/me/requests/${r.id}/edit`} icon={Pencil} size="sm">
                اصلاح و ارسال مجدد
              </ButtonLink>
            }
          >
            {r.correctionNote}
          </Callout>
        ) : null}
        {r.status === 'rejected' ? (
          <Callout tone="danger" icon={CircleX} title="درخواست رد شد" action={<ButtonLink to={`/me/requests/new?type=${r.typeId}`} variant="outline" size="sm" icon={Plus}>ثبت درخواست جدید</ButtonLink>}>
            <span className="font-medium">دلیل: </span>
            {r.rejectionReason}
          </Callout>
        ) : null}
        {r.status === 'approved' ? (
          <Callout tone="success" icon={CircleCheck} title="درخواست تأیید شد">
            {type.executionLabel ? `تأیید به معنی انجام نهایی نیست. «${type.executionLabel}» پس از ثبت توسط واحد مسئول، با اعلان به شما اطلاع داده می‌شود.` : 'درخواست شما توسط مرجع رسیدگی تأیید شد.'}
          </Callout>
        ) : null}
        {r.status === 'executed' && r.execution ? (
          <Callout tone="success" icon={CheckCheck} title={`${type.executionLabel ?? 'اقدام نهایی'} انجام شد`}>
            {r.execution.note} — {formatDate(r.execution.at, 'datetime')}
          </Callout>
        ) : null}
        {['submitted', 'in_review'].includes(r.status) ? (
          <Callout tone="info" icon={Hourglass} title="در انتظار بررسی">
            درخواست در «{active?.label}» ({PARTY_LABEL[active?.party ?? 'company']}) قرار دارد. اقدامی از طرف شما لازم نیست.
            {due ? ` زمان هدف رسیدگی: ${formatDate(r.dueAt)} (${due.text}).` : ''}
          </Callout>
        ) : null}
        {r.status === 'cancelled' ? <Callout tone="neutral" icon={Ban} title="این درخواست لغو شده است" /> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="مراحل رسیدگی" icon={ListChecks} />
            <RequestProgress request={r} type={type} />
          </Card>
          <Card>
            <CardHeader title="اطلاعات درخواست" description={`ثبت‌شده در ${formatDate(r.submittedAt, 'datetime')}`} />
            <RequestValues request={r} type={type} employee={emp} />
          </Card>
          <Card>
            <CardHeader title="مدارک پیوست" />
            <AttachmentList request={r} onOpen={setPreview} />
          </Card>
          <Card>
            <CardHeader title="پاسخ‌ها و پیام‌ها" icon={MessageSquare} description="پیام‌های ردوبدل‌شده بین شما و مرجع رسیدگی" />
            {r.messages.length === 0 ? <p className="text-sm text-ink-500">هنوز پیامی ثبت نشده است.</p> : null}
            <ul className="space-y-3">
              {r.messages.map((m) => {
                const mine = m.authorRole === 'employee'
                return (
                  <li key={m.id} className={cn('flex', mine ? 'justify-start' : 'justify-end')}>
                    <div className={cn('max-w-[85%] rounded-xl px-3.5 py-2.5', mine ? 'rounded-ss-sm bg-brand-50' : 'rounded-se-sm bg-ink-100')}>
                      <p className="text-2xs font-semibold text-ink-600">
                        {mine ? 'شما' : `${m.author} — ${PARTY_LABEL[m.authorRole as 'org' | 'company'] ?? ''}`}، {formatDate(m.at, 'datetime')}
                      </p>
                      <p className="mt-0.5 whitespace-pre-line text-sm leading-6 text-ink-800">{m.text}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
            {open ? (
              <div className="mt-4 space-y-2 border-t border-ink-100 pt-4">
                <Field label="ارسال پیام به مرجع رسیدگی">{(p) => <Textarea id={p.id} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={500} showCount placeholder="مثلاً توضیح تکمیلی…" className="min-h-20" />}</Field>
                <div className="flex justify-end">
                  <Button size="sm" icon={Send} onClick={sendReply} loading={busy} disabled={!reply.trim()}>
                    ارسال پیام
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
        <aside className="space-y-5">
          <Card>
            <CardHeader title="مرجع رسیدگی" icon={UserCheck} />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-ink-500">مسئول فعلی</dt>
                <dd className="font-medium">{open ? (r.status === 'needs_correction' ? 'شما (اصلاح درخواست)' : r.assignee ?? active?.label) : r.status === 'approved' && type.executionLabel ? `ثبت اجرا: ${type.executionLabel}` : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">مسیر تأیید</dt>
                <dd className="font-medium">{r.steps.map((s) => s.label).join(' ← ')}</dd>
              </div>
              {r.finalizedAt ? (
                <div>
                  <dt className="text-xs text-ink-500">تاریخ نهایی‌شدن</dt>
                  <dd className="font-medium">{formatDate(r.finalizedAt, 'datetime')}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
          <Card>
            <CardHeader title="تاریخچه" />
            <RequestHistory request={r} />
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={doCancel}
        loading={busy}
        tone="danger"
        title="لغو این درخواست؟"
        description="پس از لغو، درخواست از صف رسیدگی خارج می‌شود و قابل بازگردانی نیست. در صورت نیاز می‌توانید درخواست جدید ثبت کنید."
        confirmLabel="لغو درخواست"
        cancelLabel="منصرف شدم"
      >
        <Field label="دلیل لغو" optionalLabel>
          {(p) => <Textarea id={p.id} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={300} className="min-h-20" />}
        </Field>
      </ConfirmDialog>

      <Dialog open={preview !== null} onClose={() => setPreview(null)} title={preview !== null ? r.attachments[preview]?.name : ''} size="lg">
        {preview !== null && r.attachments[preview] ? <DocumentPreview source={{ fileName: r.attachments[preview].name, mime: r.attachments[preview].mime, previewUrl: r.attachments[preview].previewUrl, title: r.attachments[preview].name }} /> : null}
      </Dialog>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* REQ-06 — complete / correct a returned request                       */
/* ------------------------------------------------------------------ */

export function RequestEditPage() {
  const { r, exists, emp, db } = useMyRequest()
  const actions = useActions()
  const toast = useToast()
  const navigate = useNavigate()
  const type = r ? requestType(db, r.typeId) : undefined
  const [values, setValues] = useState<FormValues>(() => {
    if (!r || !type) return {}
    // Restore file fields from attachments
    const v = { ...r.values }
    type.fields.filter((f) => f.kind === 'files' && !Array.isArray(v[f.name])).forEach((f, i) => (v[f.name] = i === 0 ? r.attachments : []))
    return v
  })
  const [reply, setReply] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)

  if (!r) return exists ? <Navigate to="/forbidden" replace /> : <Navigate to="/me/requests" replace />
  if (r.status !== 'needs_correction') {
    return (
      <OperationResult
        tone="neutral"
        icon={FilePen}
        title="این درخواست قابل اصلاح نیست"
        description={`وضعیت فعلی درخواست «${REQUEST_STATUS[r.status].label}» است. اصلاح فقط زمانی امکان‌پذیر است که مرجع رسیدگی درخواست را برای اصلاح برگشت دهد.`}
        actions={<ButtonLink to={`/me/requests/${r.id}`}>مشاهده درخواست</ButtonLink>}
      />
    )
  }
  const t = type!
  const submit = async () => {
    if (busy) return
    const errs = validate(t, values, { employee: emp, otherRequests: db.requests.filter((x) => x.employeeId === emp.id), editingId: r.id })
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('اطلاعات واردشده نیازمند اصلاح است', 'موارد مشخص‌شده در فرم را بررسی کنید.')
      return
    }
    setBusy(true)
    try {
      await actions.resubmitRequest(r.id, computeValues(t, values), collectAttachments(t, values), reply)
      navigate(`/me/requests/${r.id}/result?kind=resubmitted`, { replace: true })
    } catch (e) {
      toast.fromError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeader title={`اصلاح ${t.title}`} breadcrumbs={[{ label: 'مرکز درخواست‌ها', to: '/me/requests' }, { label: `درخواست ${toFaDigits(r.trackingNo)}`, to: `/me/requests/${r.id}` }, { label: 'اصلاح' }]} back={{ to: `/me/requests/${r.id}`, label: 'جزئیات درخواست' }} />
      <div className="mx-auto max-w-3xl space-y-5">
        <Callout tone="warning" icon={RotateCcw} title="توضیح مرجع رسیدگی">
          {r.correctionNote}
        </Callout>
        <Card>
          <DynamicForm type={t} values={values} onChange={setValues} errors={errors} employee={emp} payslips={db.payslips.filter((p) => p.employeeId === emp.id)} disabled={busy} />
          <div className="mt-5 border-t border-ink-100 pt-5">
            <Field label="توضیح برای مرجع رسیدگی" optionalLabel helper="مثلاً: تصویر واضح گواهی شبا بارگذاری شد.">
              {(p) => <Textarea id={p.id} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={500} showCount />}
            </Field>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <ButtonLink to={`/me/requests/${r.id}`} variant="outline">
              انصراف
            </ButtonLink>
            <Button icon={Send} onClick={submit} loading={busy}>
              ارسال مجدد
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* REQ-07 — result of submit / cancel / resubmit                        */
/* ------------------------------------------------------------------ */

export function RequestResultPage() {
  const { r } = useMyRequest()
  const [params] = useSearchParams()
  const db = useDB()
  if (!r) return <Navigate to="/me/requests" replace />
  const type = requestType(db, r.typeId)!
  const kind = params.get('kind')
  if (kind === 'cancelled') {
    return (
      <OperationResult
        tone="neutral"
        icon={Ban}
        title="درخواست لغو شد"
        description={`«${type.title}» با شماره پیگیری ${toFaDigits(r.trackingNo)} لغو شد و از صف رسیدگی خارج شد.`}
        actions={
          <>
            <ButtonLink to="/me/requests" variant="outline">
              درخواست‌های من
            </ButtonLink>
            <ButtonLink to="/me/requests/new" icon={Plus}>
              ثبت درخواست جدید
            </ButtonLink>
          </>
        }
      />
    )
  }
  return (
    <OperationResult
      title={kind === 'resubmitted' ? 'درخواست اصلاح‌شده ارسال شد' : 'درخواست شما با موفقیت ثبت شد'}
      description={`درخواست به ${r.steps[r.currentStep]?.label} ارجاع شد. تغییر وضعیت‌ها از طریق اعلان به شما اطلاع داده می‌شود.`}
      details={[
        { label: 'شماره پیگیری', value: <Ltr className="text-base">{toFaDigits(r.trackingNo)}</Ltr> },
        { label: 'نوع درخواست', value: type.title },
        { label: 'تاریخ ثبت', value: formatDate(r.updatedAt, 'datetime') },
        { label: 'وضعیت', value: <StatusBadge meta={REQUEST_STATUS[r.status]} size="sm" /> },
        ...(r.dueAt ? [{ label: 'زمان هدف رسیدگی', value: formatDate(r.dueAt) }] : []),
      ]}
      actions={
        <>
          <ButtonLink to={`/me/requests/${r.id}`}>پیگیری درخواست</ButtonLink>
          <ButtonLink to="/me" variant="outline">
            بازگشت به داشبورد
          </ButtonLink>
        </>
      }
    />
  )
}

export { computeValues }
