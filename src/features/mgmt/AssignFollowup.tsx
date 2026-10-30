import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button, DatePicker, Dialog, Field, Input, Select, useToast } from '@/components/ui'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { toISODate } from '@/lib/jalali'
import type { TaskLink, TaskPriority } from '@/types/domain'
import { TASK_PRIORITY } from '@/config/status'
import { useMgmt } from './useMgmt'

/** "Assign an owner and a deadline" for any item that needs follow-up — creates a task linked to the record. */
export function AssignFollowupDialog({ open, onClose, link, defaultTitle, projectId }: { open: boolean; onClose: () => void; link: TaskLink; defaultTitle: string; projectId?: string }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const users = db.users.filter((u) => u.status === 'active' && (m.role === 'org' ? u.orgId === m.user?.orgId : u.companyId === m.user?.companyId))
  const [title, setTitle] = useState(defaultTitle)
  const [assignee, setAssignee] = useState(m.user?.id ?? '')
  const [due, setDue] = useState(toISODate(new Date(Date.now() + 2 * 86_400_000)))
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="تعیین مسئول پیگیری"
      description="یک وظیفه متصل به همین رکورد ایجاد می‌شود تا پیگیری آن مسئول و مهلت مشخص داشته باشد."
      icon={UserPlus}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button
            loading={busy}
            disabled={!title.trim() || !assignee || !due}
            onClick={async () => {
              setBusy(true)
              try {
                await actions.createTask({ title, assigneeId: assignee, dueAt: due, priority, scope: m.role, scopeId: m.entityId, link, projectId })
                toast.success('مسئول پیگیری تعیین شد', 'وظیفه در فهرست وظایف ثبت شد.')
                onClose()
              } catch (e) {
                toast.fromError(e)
              } finally {
                setBusy(false)
              }
            }}
          >
            ثبت وظیفه
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="عنوان" required>
          {(p) => <Input id={p.id} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="مسئول" required>
            {(p) => <Select id={p.id} value={assignee} onChange={(e) => setAssignee(e.target.value)} options={users.map((u) => ({ value: u.id, label: u.name }))} />}
          </Field>
          <Field label="مهلت" required>
            {(p) => <DatePicker id={p.id} value={due} onChange={setDue} min={toISODate(new Date())} clearable={false} />}
          </Field>
        </div>
        <Field label="اولویت">
          {(p) => <Select id={p.id} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} options={(Object.keys(TASK_PRIORITY) as TaskPriority[]).map((k) => ({ value: k, label: TASK_PRIORITY[k].label }))} />}
        </Field>
        <p className="rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600">رکورد مرتبط: {link.label}</p>
      </div>
    </Dialog>
  )
}
