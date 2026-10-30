import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, Ban, CalendarX2, Clock, FilePen, Route, Save, Send, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button, Callout, Card, Combobox, ConfirmDialog, Dialog, PageHeader, useToast, type ComboOption } from '@/components/ui'
import { useActions, useCurrentEmployee } from '@/auth/auth'
import { useDB, useDemo } from '@/mock/store'
import { REQUEST_CATEGORIES, PARTY_LABEL } from '@/config/requestTypes'
import { REQUEST_STATUS } from '@/config/status'
import { iconFor } from '@/config/icons'
import { formatDate, formatNumber, toFaDigits } from '@/lib/format'
import { DynamicForm } from '@/features/requests/DynamicForm'
import { availability, collectAttachments, computeValues, displayValue, hasMeaningfulInput, validate, visibleFields, type FormErrors, type FormValues } from '@/features/requests/logic'
import { RequestCenterTabs } from './MyRequests'
import type { RequestTypeDef } from '@/types/domain'

export function NewRequestPage() {
  const db = useDB()
  const emp = useCurrentEmployee()
  const actions = useActions()
  const toast = useToast()
  const navigate = useNavigate()
  const { demo } = useDemo()
  const [params, setParams] = useSearchParams()
  const draftId = params.get('draft') ?? undefined
  const draft = draftId ? db.requests.find((r) => r.id === draftId && r.status === 'draft' && r.employeeId === emp.id) : undefined

  const [typeId, setTypeId] = useState<string>(draft?.typeId ?? params.get('type') ?? '')
  const [values, setValues] = useState<FormValues>(draft?.values ?? (params.get('month') ? { month: params.get('month') } : {}))
  const [confidential, setConfidential] = useState(Boolean(draft?.confidential))
  const [errors, setErrors] = useState<FormErrors>({})
  const [attempted, setAttempted] = useState(false)
  const [pendingType, setPendingType] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null)
  const [savedDraftId, setSavedDraftId] = useState(draftId)
  const [dirty, setDirty] = useState(false)
  const submittedRef = useRef(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  const type = db.requestTypes.find((t) => t.id === typeId && t.enabled)
  const myRequests = db.requests.filter((r) => r.employeeId === emp.id)
  const payslips = db.payslips.filter((p) => p.employeeId === emp.id)
  const avail = type ? availability(type, demo.dayOverride) : { allowed: true }
  const openDuplicate = type?.rules?.singleOpen ? myRequests.find((r) => r.typeId === type.id && ['submitted', 'in_review', 'needs_correction'].includes(r.status)) : undefined

  // Live validation after the first submit attempt
  useEffect(() => {
    if (attempted && type) setErrors(validate(type, values, { employee: emp, otherRequests: myRequests, editingId: savedDraftId }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, attempted, typeId])

  // Warn before leaving with unsaved input
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !submittedRef.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty && !submittedRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  const options: ComboOption[] = useMemo(
    () =>
      REQUEST_CATEGORIES.flatMap((c) =>
        db.requestTypes
          .filter((t) => t.category === c.id && t.enabled)
          .map((t) => ({ value: t.id, label: t.title, group: c.title, description: t.description, icon: iconFor(t.icon), keywords: t.keywords })),
      ),
    [db.requestTypes],
  )

  const applyType = (id: string) => {
    setTypeId(id)
    setValues({})
    setErrors({})
    setAttempted(false)
    setConfidential(false)
    setDirty(false)
    const p = new URLSearchParams(params)
    p.set('type', id)
    p.delete('draft')
    setParams(p, { replace: true })
    if (savedDraftId && draft?.typeId !== id) setSavedDraftId(undefined)
  }

  const onTypeChange = (id: string) => {
    if (id === typeId) return
    // Never silently discard entered data
    if (type && hasMeaningfulInput(values)) setPendingType(id)
    else applyType(id)
  }

  const onValues = (v: FormValues) => {
    setValues(v)
    setDirty(true)
  }

  const saveDraft = async (thenType?: string) => {
    if (!type) return
    setBusy('draft')
    try {
      const r = await actions.saveDraft({ typeId: type.id, values, attachments: collectAttachments(type, values), confidential }, savedDraftId)
      setSavedDraftId(r.id)
      setDirty(false)
      toast.success('پیش‌نویس ذخیره شد', 'می‌توانید بعداً از «درخواست‌های من» آن را تکمیل و ارسال کنید.')
      if (thenType) applyType(thenType)
    } catch (e) {
      toast.fromError(e, 'ذخیره پیش‌نویس انجام نشد')
    } finally {
      setBusy(null)
    }
  }

  const openReview = () => {
    if (!type) return
    setAttempted(true)
    const errs = validate(type, values, { employee: emp, otherRequests: myRequests, editingId: savedDraftId })
    setErrors(errs)
    if (Object.keys(errs).length) {
      setTimeout(() => summaryRef.current?.focus(), 30)
      return
    }
    setReviewOpen(true)
  }

  const submit = async () => {
    if (!type || busy) return // duplicate-submission guard
    setBusy('submit')
    try {
      const finalValues = computeValues(type, values)
      const r = await actions.submitRequest({ typeId: type.id, values: finalValues, attachments: collectAttachments(type, values), confidential }, savedDraftId)
      submittedRef.current = true
      setReviewOpen(false)
      navigate(`/me/requests/${r.id}/result?kind=submitted`, { replace: true })
    } catch (e) {
      // Inputs are kept as-is so the user can retry
      toast.fromError(e, 'ثبت درخواست انجام نشد')
      setReviewOpen(false)
    } finally {
      setBusy(null)
    }
  }

  const errorList = Object.entries(errors)
  const fieldsById = type ? Object.fromEntries(type.fields.map((f) => [f.name, f])) : {}

  return (
    <>
      <PageHeader
        title="مرکز درخواست‌ها"
        description="نوع درخواست را انتخاب کنید؛ فرم مربوط به همان درخواست نمایش داده می‌شود."
        breadcrumbs={[{ label: 'داشبورد', to: '/me' }, { label: 'مرکز درخواست‌ها', to: '/me/requests' }, { label: 'ثبت درخواست جدید' }]}
      />
      <RequestCenterTabs />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <Card>
            <label htmlFor="req-type" className="mb-1.5 block text-sm font-semibold text-ink-900">
              نوع درخواست <span className="text-red-600" aria-hidden>*</span>
            </label>
            <Combobox id="req-type" value={typeId} onChange={onTypeChange} options={options} placeholder="انتخاب نوع درخواست…" searchPlaceholder="مثلاً مرخصی، مساعده، شبا…" />
            {!type ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-ink-500">درخواست‌های پرکاربرد</p>
                <div className="flex flex-wrap gap-2">
                  {['leave_daily', 'advance', 'leave_hourly', 'certificate', 'payslip_objection', 'bank_change'].map((id) => {
                    const t = db.requestTypes.find((x) => x.id === id && x.enabled)
                    if (!t) return null
                    const Icon = iconFor(t.icon)
                    return (
                      <button key={id} type="button" onClick={() => applyType(id)} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[13px] text-ink-700 hover:border-brand-300 hover:bg-brand-50">
                        <Icon size={15} className="text-ink-500" aria-hidden /> {t.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[13px] leading-6 text-ink-600">{type.description}</p>
            )}
            {draft ? (
              <Callout tone="neutral" icon={FilePen} className="mt-4">
                در حال تکمیل پیش‌نویس ذخیره‌شده در {formatDate(draft.updatedAt, 'datetime')} هستید.
              </Callout>
            ) : null}
          </Card>

          {type && !avail.allowed ? (
            <Card>
              <Callout tone="warning" icon={CalendarX2} title="ثبت این درخواست هنوز امکان‌پذیر نیست">
                {avail.reason} ثبت از <strong>{avail.opensOn}</strong> فعال می‌شود.
              </Callout>
            </Card>
          ) : type && openDuplicate ? (
            <Card>
              <Callout
                tone="warning"
                icon={Ban}
                title="درخواست مشابهی از قبل ثبت شده است"
                action={
                  <Button variant="outline" size="sm" onClick={() => navigate(`/me/requests/${openDuplicate.id}`)}>
                    مشاهده درخواست قبلی
                  </Button>
                }
              >
                طبق ضوابط، تا تعیین تکلیف درخواست {toFaDigits(openDuplicate.trackingNo)} ({REQUEST_STATUS[openDuplicate.status].label}) امکان ثبت درخواست جدید از این نوع وجود ندارد.
              </Callout>
            </Card>
          ) : type ? (
            <Card>
              {attempted && errorList.length ? (
                <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3.5 focus:outline-none">
                  <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                    <TriangleAlert size={16} aria-hidden /> اطلاعات واردشده نیازمند اصلاح است ({toFaDigits(errorList.length)} مورد)
                  </p>
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[13px] text-red-800">
                    {errorList.map(([k, msg]) => (
                      <li key={k}>
                        <a href={`#f-${k}`} className="underline-offset-2 hover:underline">
                          {fieldsById[k]?.label ?? k}: {msg}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="mb-4 text-xs text-ink-500">
                فیلدهای دارای <span className="text-red-600">*</span> الزامی هستند.
              </p>
              <DynamicForm type={type} values={values} onChange={onValues} errors={attempted ? errors : {}} employee={emp} payslips={payslips} confidential={confidential} onConfidentialChange={setConfidential} disabled={busy === 'submit'} />
              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-ink-100 pt-4 sm:flex-row sm:justify-between">
                <Button variant="outline" icon={Save} onClick={() => saveDraft()} loading={busy === 'draft'} disabled={busy === 'submit' || !hasMeaningfulInput(values)}>
                  ذخیره پیش‌نویس
                </Button>
                <Button icon={Send} onClick={openReview} disabled={Boolean(busy)}>
                  بررسی و ارسال
                </Button>
              </div>
            </Card>
          ) : null}
        </div>

        {/* Routing info */}
        <aside className="space-y-4">
          {type ? <RoutingCard type={type} /> : null}
          <Card className="bg-ink-25">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-800">
              <ShieldCheck size={16} className="text-accent-600" aria-hidden /> حریم خصوصی
            </p>
            <p className="mt-1.5 text-xs leading-6 text-ink-600">اطلاعات و پیوست‌های درخواست فقط برای مرجع رسیدگی مجاز قابل مشاهده است. اطلاعات پزشکی و بانکی با دسترسی محدود نگهداری می‌شود.</p>
          </Card>
        </aside>
      </div>

      {/* Type change confirmation */}
      <Dialog
        open={pendingType !== null}
        onClose={() => setPendingType(null)}
        title="تغییر نوع درخواست؟"
        description="با تغییر نوع درخواست، اطلاعاتی که در فرم فعلی وارد کرده‌اید حذف می‌شود. می‌توانید ابتدا آن را به‌عنوان پیش‌نویس ذخیره کنید."
        icon={TriangleAlert}
        tone="warning"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingType(null)}>
              انصراف
            </Button>
            <Button variant="danger-ghost" onClick={() => { const t = pendingType!; setPendingType(null); applyType(t) }}>
              تغییر بدون ذخیره
            </Button>
            <Button icon={Save} loading={busy === 'draft'} onClick={async () => { const t = pendingType!; setPendingType(null); await saveDraft(t) }}>
              ذخیره پیش‌نویس و تغییر
            </Button>
          </>
        }
      />

      {/* Review before submit */}
      {type ? (
        <Dialog
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          dismissable={busy !== 'submit'}
          title="بازبینی پیش از ارسال"
          description="اطلاعات زیر را بررسی کنید. پس از ارسال، ویرایش فقط در صورت برگشت درخواست برای اصلاح ممکن است."
          size="md"
          footer={
            <>
              <Button variant="outline" icon={ArrowRight} onClick={() => setReviewOpen(false)} disabled={busy === 'submit'}>
                بازگشت و ویرایش
              </Button>
              <Button icon={Send} onClick={submit} loading={busy === 'submit'}>
                ارسال نهایی
              </Button>
            </>
          }
        >
          <p className="mb-3 text-sm font-bold">{type.title}</p>
          <dl className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {visibleFields(type, computeValues(type, values))
              .filter((f) => f.kind !== 'checkbox')
              .filter((f) => {
                const v = computeValues(type, values)[f.name]
                return f.required || f.prefill || !(v === undefined || v === '' || (Array.isArray(v) && v.length === 0))
              })
              .map((f) => {
                const v = computeValues(type, values)[f.name]
                return (
                  <div key={f.name} className="flex items-start justify-between gap-4 px-3 py-2">
                    <dt className="shrink-0 text-xs text-ink-500">{f.label}</dt>
                    <dd className="text-start text-[13px] font-medium text-ink-900" dir={f.kind === 'sheba' ? 'ltr' : undefined}>
                      {f.kind === 'sheba' ? String(v ?? '—') : displayValue(f, v, emp)}
                    </dd>
                  </div>
                )
              })}
            {confidential ? (
              <div className="flex items-center justify-between px-3 py-2">
                <dt className="text-xs text-ink-500">محرمانگی</dt>
                <dd className="text-[13px] font-medium">محرمانه</dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-ink-600">
            <Route size={14} className="mt-0.5 shrink-0" aria-hidden /> مسیر رسیدگی: {type.workflow.map((w) => w.label).join(' ← ')}
            {type.executionLabel ? ` ← ${type.executionLabel}` : ''}
          </p>
        </Dialog>
      ) : null}

      {/* Leave-page guard */}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        tone="warning"
        title="خروج بدون ذخیره؟"
        description="اطلاعاتی که در فرم وارد کرده‌اید ذخیره نشده است. اگر خارج شوید، این اطلاعات از بین می‌رود."
        confirmLabel="خروج بدون ذخیره"
        cancelLabel="ماندن در صفحه"
      />
    </>
  )
}

function RoutingCard({ type }: { type: RequestTypeDef }) {
  return (
    <Card>
      <p className="flex items-center gap-2 text-sm font-bold text-ink-900">
        <Route size={16} className="text-brand-700" aria-hidden /> مرجع رسیدگی
      </p>
      <p className="mt-1 text-xs leading-5 text-ink-500">درخواست شما به‌صورت خودکار و به ترتیب زیر ارجاع می‌شود:</p>
      <ol className="mt-3 space-y-2.5">
        {type.workflow.map((w, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-2xs font-bold text-brand-800">{formatNumber(i + 1)}</span>
            <span className="text-[13px]">
              <span className="block font-medium text-ink-900">{w.label}</span>
              <span className="block text-2xs text-ink-500">{PARTY_LABEL[w.party]}</span>
            </span>
          </li>
        ))}
        {type.executionLabel ? (
          <li className="flex items-start gap-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed border-ink-300 text-2xs text-ink-500">{formatNumber(type.workflow.length + 1)}</span>
            <span className="text-[13px]">
              <span className="block font-medium text-ink-900">{type.executionLabel}</span>
              <span className="block text-2xs text-ink-500">پس از تأیید؛ تأیید به معنی اجرای فوری نیست</span>
            </span>
          </li>
        ) : null}
      </ol>
      <div className="mt-4 flex items-center gap-2 border-t border-ink-100 pt-3 text-xs text-ink-600">
        <Clock size={14} aria-hidden /> زمان هدف رسیدگی: {formatNumber(type.slaDays)} روز کاری
      </div>
      <p className="mt-1.5 text-xs text-ink-500">پس از ارسال، شماره پیگیری دریافت می‌کنید.</p>
    </Card>
  )
}
