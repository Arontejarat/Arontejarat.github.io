import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
let checks = 0
const test = (name, fn) => { fn(); checks++; console.log('✓ ' + name) }
try {
  const { createSeed } = await server.ssrLoadModule('/src/mock/seed.ts')
  const B = await server.ssrLoadModule('/src/mock/businessActions.ts')
  const A = await server.ssrLoadModule('/src/mock/actions.ts')
  const { businessFiles } = await server.ssrLoadModule('/src/mock/businessSelectors.ts')
  const { scopedContracts } = await server.ssrLoadModule('/src/mock/selectors.ts')
  const db = createSeed()
  const company = { name: 'مدیر شرکت', role: 'company', userId: 'u-c1', companyId: 'c1' }
  const org = { name: 'مدیر سازمان', role: 'org', userId: 'u-o1', orgId: 'o1' }
  const employee = { name: 'نیرو', role: 'employee', employeeId: 'e1' }
  const file = { id: 'test-file', storageKey: 'test-file', name: 'payroll.pdf', size: 100, mime: 'application/pdf', uploadedAt: new Date().toISOString() }
  const input = { kind: 'statement', title: 'صورت‌وضعیت مهر', projectId: 'p1', period: '1405-07', description: '', attachment: file }
  const forbidden = (fn) => assert.throws(fn, { code: 'forbidden' })
  const statement = B.sendBusinessDocument(db, company, input)
  test('company sends statement to project organization', () => { assert.equal(statement.ownerId, 'c1'); assert.equal(statement.reviewStatus, 'pending'); assert.equal(db.notifications[0].audience.id, 'o1') })
  test('statement visible only in related organization scope', () => { assert.equal(businessFiles(db, { role: 'org', orgId: 'o1' }, 'statement').length, 1); assert.equal(businessFiles(db, { role: 'org', orgId: 'o2' }, 'statement').length, 0) })
  test('statement stays outside unrelated project-manager scope', () => assert.equal(businessFiles(db, { role: 'company', companyId: 'c1', projectIds: ['p3'] }, 'statement').length, 0))
  test('organization cannot send a company statement', () => forbidden(() => B.sendBusinessDocument(db, org, input)))
  test('company cannot send work report', () => forbidden(() => B.sendBusinessDocument(db, company, { ...input, kind: 'work_report' })))
  test('unknown document kind rejected', () => forbidden(() => B.sendBusinessDocument(db, org, { ...input, kind: 'unknown' })))
  test('out-of-company project rejected', () => forbidden(() => B.sendBusinessDocument(db, company, { ...input, projectId: 'p5' })))
  test('invalid month rejected', () => assert.throws(() => B.sendBusinessDocument(db, company, { ...input, period: '1405-13' }), { code: 'validation' }))
  test('file metadata without original rejected', () => assert.throws(() => B.sendBusinessDocument(db, company, { ...input, attachment: { ...file, storageKey: undefined } }), { code: 'validation' }))
  test('sender cannot approve own statement', () => forbidden(() => B.reviewBusinessDocument(db, company, statement.id, 'approved', '')))
  test('rejection requires reason', () => assert.throws(() => B.reviewBusinessDocument(db, org, statement.id, 'rejected', ''), { code: 'validation' }))
  test('recipient review saves result and notifies sender', () => { B.reviewBusinessDocument(db, org, statement.id, 'rejected', 'نیاز به اصلاح'); assert.equal(statement.reviewNote, 'نیاز به اصلاح'); assert.equal(db.notifications[0].audience.id, 'c1') })
  test('second conflicting review rejected', () => assert.throws(() => B.reviewBusinessDocument(db, org, statement.id, 'approved', ''), { code: 'conflict' }))
  test('organization work report reaches company', () => { const report = B.sendBusinessDocument(db, org, { ...input, kind: 'work_report' }); assert.equal(report.owner, 'org'); assert.equal(db.notifications[0].audience.role, 'company'); assert.equal(businessFiles(db, { role: 'company', companyId: 'c1' }, 'work_report').length, 1) })
  const completed = db.contracts.find((c) => c.kind === 'worker' && c.stage === 'completed' && c.companyId === 'c1')
  test('worker contract hidden before company forwarding', () => assert.ok(!scopedContracts(db, { role: 'org', orgId: completed.orgId }).some((c) => c.id === completed.id)))
  test('completed worker contract can be forwarded and viewed by organization', () => { B.shareWorkerContract(db, company, completed.id); assert.equal(completed.sharedWithOrg.versionHash, completed.versionHash); assert.ok(scopedContracts(db, { role: 'org', orgId: completed.orgId }).some((c) => c.id === completed.id)); assert.equal(db.notifications[0].link, '/org/contracts/' + completed.id) })
  test('duplicate forwarding rejected', () => assert.throws(() => B.shareWorkerContract(db, company, completed.id), { code: 'duplicate' }))
  test('unsigned contract cannot be forwarded', () => { const unsigned = db.contracts.find((c) => c.kind === 'worker' && c.stage === 'awaiting_worker' && c.companyId === 'c1'); assert.throws(() => B.shareWorkerContract(db, company, unsigned.id), { code: 'conflict' }) })
  db.payslips = db.payslips.filter((p) => !(p.employeeId === 'e1' && p.year === 1405 && p.month === 7))
  let payslip = B.uploadPayslip(db, company, { employeeId: 'e1', period: '1405-07', file })
  test('file-only payroll publishes without fabricated amounts', () => { assert.equal(payslip.source, 'file'); assert.equal(payslip.file.storageKey, file.storageKey); assert.equal(payslip.earnings.length, 0); assert.equal(payslip.payment, null); assert.equal(db.notifications[0].audience.id, 'e1') })
  test('replacement needs explicit correction note', () => assert.throws(() => B.uploadPayslip(db, company, { employeeId: 'e1', period: '1405-07', file, expectedVersion: 1 }), { code: 'validation' }))
  test('replacement preserves original binary metadata and versions', () => { payslip = B.uploadPayslip(db, company, { employeeId: 'e1', period: '1405-07', file: { ...file, storageKey: 'replacement' }, expectedVersion: 1, correctionNote: 'اصلاح فیش' }); assert.equal(payslip.version, 2); assert.equal(payslip.previous[0].file.storageKey, 'test-file'); assert.equal(payslip.previous[0].previous, undefined) })
  test('stale payroll update rejected', () => assert.throws(() => B.uploadPayslip(db, company, { employeeId: 'e1', period: '1405-07', file, expectedVersion: 1, correctionNote: 'اصلاح' }), { code: 'conflict' }))
  test('organization cannot upload payroll', () => forbidden(() => B.uploadPayslip(db, org, { employeeId: 'e1', period: '1405-07', file })))
  test('other-company employee payroll rejected', () => { const e = db.employees.find((e) => e.companyId === 'c2'); forbidden(() => B.uploadPayslip(db, company, { employeeId: e.id, period: '1405-07', file })) })
  test('insurance code alone is a reviewable personnel document', () => { const { version, doc } = A.uploadPersonnelDocument(db, employee, { typeId: 'insurance_registration', fileName: 'کد بیمه', size: 0, mime: 'text/plain', insuranceNumber: '۱۲۳۴۵۶۷۸' }); assert.equal(doc.typeId, 'insurance_registration'); assert.equal(version.insuranceNumber, '12345678'); assert.equal(version.status, 'pending') })
  test('invalid insurance code rejected', () => assert.throws(() => A.uploadPersonnelDocument(db, employee, { typeId: 'insurance_registration', fileName: 'کد بیمه', size: 0, mime: 'text/plain', insuranceNumber: 'abc' }), { code: 'validation' }))
  console.log(checks + ' workflow checks passed')
} finally { await server.close() }
