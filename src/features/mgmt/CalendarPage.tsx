import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarClock } from 'lucide-react'
import { Badge, Card, CardHeader, Checkbox, EmptyState, PageHeader, PageState , DeadlineBadge } from '@/components/ui'
import { useDB } from '@/mock/store'
import { activeParty, currentVersion, employeeById, fullName, projectInScope, requestType, scopedContracts, scopedDocuments, scopedRequests, signatureStatus } from '@/mock/selectors'
import { docType } from '@/config/documentTypes'
import { daysUntil, formatDate, formatDeadline } from '@/lib/format'
import type { Tone } from '@/config/status'
import { useMgmt } from './useMgmt'
import { MonthCalendar, type CalendarEvent } from './MonthCalendar'

const KINDS = {
  sign: { label: 'مهلت امضای قرارداد', tone: 'warning' as Tone },
  contractEnd: { label: 'پایان قرارداد پروژه', tone: 'danger' as Tone },
  task: { label: 'موعد وظایف', tone: 'brand' as Tone },
  request: { label: 'مهلت رسیدگی درخواست', tone: 'info' as Tone },
  doc: { label: 'مهلت اصلاح / انقضای مدرک', tone: 'accent' as Tone },
  project: { label: 'شروع و پایان پروژه', tone: 'neutral' as Tone },
}
type Kind = keyof typeof KINDS

export function CalendarPage() {
  const m = useMgmt()
  return (
    <>
      <PageHeader title="تقویم و مهلت‌ها" description="همه مهلت‌های اجرایی در یک تقویم: امضای قرارداد، پایان قراردادها، وظایف، رسیدگی به درخواست‌ها و مدارک." breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'تقویم' }]} />
      <PageState>{() => <Body />}</PageState>
    </>
  )
}

function Body() {
  const db = useDB()
  const m = useMgmt()
  const [on, setOn] = useState<Set<Kind>>(new Set(Object.keys(KINDS) as Kind[]))
  const events = useMemo(() => {
    const out: (CalendarEvent & { kind: Kind })[] = []
    scopedContracts(db, m.scope).forEach((c) => {
      if (c.signDeadline && signatureStatus(c) !== 'complete' && !['cancelled', 'superseded'].includes(c.stage)) out.push({ id: `s${c.id}`, kind: 'sign', date: c.signDeadline, title: `امضا: ${c.employeeId ? fullName(employeeById(db, c.employeeId)!) : c.number}`, tone: KINDS.sign.tone, to: `${m.base}/contracts/${c.id}` })
      if (c.kind === 'project') out.push({ id: `e${c.id}`, kind: 'contractEnd', date: c.endDate, title: `پایان ${c.number}`, tone: KINDS.contractEnd.tone, to: `${m.base}/contracts/${c.id}` })
    })
    db.tasks.filter((t) => t.scope === m.role && t.scopeId === m.entityId && t.status !== 'done').forEach((t) => out.push({ id: `t${t.id}`, kind: 'task', date: t.dueAt, title: t.title, tone: daysUntil(t.dueAt) < 0 ? 'danger' : KINDS.task.tone, to: `${m.base}/tasks?task=${t.id}` }))
    scopedRequests(db, m.scope)
      .filter((r) => activeParty(r) === m.role && r.dueAt)
      .forEach((r) => out.push({ id: `r${r.id}`, kind: 'request', date: r.dueAt!, title: `رسیدگی: ${requestType(db, r.typeId)?.title}`, tone: KINDS.request.tone, to: `${m.base}/requests/${r.id}` }))
    scopedDocuments(db, m.scope).forEach((d) => {
      const v = currentVersion(d)
      if (v.fixDeadline && ['needs_fix', 'rejected'].includes(v.status)) out.push({ id: `f${d.id}`, kind: 'doc', date: v.fixDeadline, title: `اصلاح ${docType(d.typeId)?.title} — ${fullName(employeeById(db, d.employeeId)!)}`, tone: KINDS.doc.tone, to: `${m.base}/documents?doc=${d.id}` })
      if (d.expiresAt && daysUntil(d.expiresAt) >= -7 && daysUntil(d.expiresAt) <= 60) out.push({ id: `x${d.id}`, kind: 'doc', date: d.expiresAt, title: `انقضای ${docType(d.typeId)?.title} — ${fullName(employeeById(db, d.employeeId)!)}`, tone: KINDS.doc.tone, to: `${m.base}/documents?doc=${d.id}` })
    })
    db.projects
      .filter((p) => projectInScope(m.scope, p) && p.status !== 'closed')
      .forEach((p) => {
        out.push({ id: `ps${p.id}`, kind: 'project', date: p.startDate, title: `شروع ${p.name}`, tone: 'neutral', to: `${m.base}/projects/${p.id}` })
        out.push({ id: `pe${p.id}`, kind: 'project', date: p.endDate, title: `پایان ${p.name}`, tone: 'neutral', to: `${m.base}/projects/${p.id}` })
      })
    return out
  }, [db, m.scope, m.role, m.entityId, m.base])
  const shown = events.filter((e) => on.has(e.kind))
  const upcoming = shown.filter((e) => daysUntil(e.date) >= -3 && daysUntil(e.date) <= 14).sort((a, b) => a.date.localeCompare(b.date))
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <Checkbox
              key={k}
              checked={on.has(k)}
              onChange={(v) => {
                const n = new Set(on)
                if (v) n.add(k)
                else n.delete(k)
                setOn(n)
              }}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Badge size="sm" tone={KINDS[k].tone}>
                    {events.filter((e) => e.kind === k).length.toLocaleString('fa-IR')}
                  </Badge>
                  {KINDS[k].label}
                </span>
              }
            />
          ))}
        </div>
        <MonthCalendar events={shown} />
      </div>
      <Card>
        <CardHeader title="مهلت‌های پیش‌رو" description="۱۴ روز آینده و موارد گذشته اخیر" icon={CalendarClock} />
        {upcoming.length === 0 ? (
          <EmptyState compact icon={CalendarClock} title="مهلت نزدیکی وجود ندارد" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {upcoming.map((e) => {
              const d = formatDeadline(e.date)
              return (
                <li key={e.id}>
                  <Link to={e.to!} className="flex items-start justify-between gap-2 py-2.5 hover:underline">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{e.title}</span>
                      <span className="block text-2xs text-ink-500">
                        {KINDS[e.kind].label}، {formatDate(e.date)}
                      </span>
                    </span>
                    <DeadlineBadge d={d}>
                      {d.text}
                    </DeadlineBadge>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
