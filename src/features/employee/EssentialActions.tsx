import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, ButtonLink, Callout, Card, CardHeader, StatusBadge, useToast } from '@/components/ui'
import { useActions, useCurrentEmployee } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { essentialPersonnel } from '@/mock/hrRules'
import { DOC_STATUS } from '@/config/status'
import { formatDate } from '@/lib/format'
export function EssentialActions() {
  const db = useDB(); const emp = useCurrentEmployee(); const actions = useActions(); const toast = useToast(); const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const state = essentialPersonnel(db, emp)
  const messages: Record<string, string> = { active: '', missing: 'قرارداد کار معتبر برای شما ثبت نشده است.', expired: 'اعتبار قرارداد شما در ' + formatDate(state.contract?.endDate) + ' پایان یافته است.', pending_signature: 'قرارداد شما آماده امضاست؛ برای تکمیل پرونده آن را مطالعه و امضا کنید.', preparing: 'قرارداد در مرحله تهیه یا تکمیل امضای شرکت است.', future: 'قرارداد تکمیل شده اما تاریخ شروع آن هنوز نرسیده است.' }
  const prepare = async () => { if (busy) return; setBusy(true); try { await actions.requestContractPreparation(); toast.success('پیگیری صدور / تمدید برای شرکت ثبت شد'); navigate('/me/documents/contracts') } catch (e) { toast.fromError(e) } finally { setBusy(false) } }
  return <Card><CardHeader title="اقدامات ضروری من" description="وضعیت قرارداد و مدارک لازم، با مسیر مستقیم تکمیل پرونده." />
    <div className="mb-5 flex flex-wrap gap-2">{[['مدارک پرسنلی', '/me/documents/personnel'], ['قراردادهای کار', '/me/documents/contracts'], ['فیش‌های حقوقی', '/me/documents/payslips'], ['بیمه من', '/me/insurance'], ['اطلاعات فردی', '/me/profile/personal'], ['درخواست‌های من', '/me/requests'], ['اطلاعات فرزندان', '/me/family']].map(([label, to]) => <ButtonLink key={to} to={to} size="sm" variant="outline">{label}</ButtonLink>)}</div>
    <div className="space-y-4">{state.state !== 'active' ? <Callout tone={['expired', 'missing'].includes(state.state) ? 'warning' : 'info'} title={messages[state.state]} action={state.state === 'pending_signature' && state.contract ? <ButtonLink to={'/me/documents/contracts/' + state.contract.id + '/sign'} size="sm">مشاهده و امضا</ButtonLink> : ['missing', 'expired'].includes(state.state) ? <Button size="sm" loading={busy} onClick={prepare}>درخواست {state.state === 'expired' ? 'تمدید' : 'صدور'} قرارداد</Button> : <ButtonLink size="sm" to={state.contract ? '/me/documents/contracts/' + state.contract.id : '/me/documents/contracts'}>پیگیری قرارداد</ButtonLink>}>قرارداد را شرکت صادر می‌کند؛ اقدام شما مستقیماً به مسئول شرکت ارجاع می‌شود.</Callout> : <p className="text-sm text-ink-700">قرارداد امضاشده معتبر دارید.</p>}
      {state.documents.length ? <section><h2 className="mb-2 text-sm font-bold">چک‌لیست مدارک موردنیاز</h2><ul className="divide-y divide-ink-100">{state.documents.map((d) => <li key={d.type.id} className="flex flex-wrap items-center gap-3 py-3"><span className="min-w-40 flex-1 text-sm font-medium">{d.type.title}</span><StatusBadge meta={DOC_STATUS[d.status]} size="sm" /><ButtonLink size="sm" variant="outline" to={d.status === 'pending' && d.doc ? '/me/documents/personnel/' + d.doc.id : '/me/documents/personnel/upload?type=' + d.type.id}>{d.status === 'pending' ? 'پیگیری بررسی' : d.status === 'not_submitted' ? 'بارگذاری مدرک' : d.status === 'expired' ? 'تمدید مدرک' : 'اصلاح مدرک'}</ButtonLink></li>)}</ul></section> : <p className="text-sm text-ink-700">همه مدارک الزامی تأیید و معتبر هستند.</p>}
    </div></Card>
}
