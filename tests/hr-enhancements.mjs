import assert from 'node:assert/strict'
import { createServer } from 'vite'
const s = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
let passed = 0
const test = (name, fn) => { fn(); passed++; console.log('✓ ' + name) }
try {
  const { createSeed, DB_VERSION } = await s.ssrLoadModule('/src/mock/seed.ts')
  const { migrateDB } = await s.ssrLoadModule('/src/mock/migrate.ts')
  const A = await s.ssrLoadModule('/src/mock/hrActions.ts')
  const B = await s.ssrLoadModule('/src/mock/contractBatch.ts')
  const R = await s.ssrLoadModule('/src/mock/hrRules.ts')
  const { uploadPayslip } = await s.ssrLoadModule('/src/mock/businessActions.ts')
  const J = await s.ssrLoadModule('/src/lib/jalali.ts')
  const { socialSecurityProvider } = await s.ssrLoadModule('/src/services/socialSecurity.ts')
  const company = { name: 'مدیر شرکت', role: 'company', userId: 'u-c1', companyId: 'c1' }
  const hr = { name: 'منابع انسانی', role: 'company', userId: 'u-c3', companyId: 'c1' }
  const other = { name: 'شرکت دیگر', role: 'company', userId: 'u-c8', companyId: 'c2' }
  const emp = { name: 'نیرو', role: 'employee', employeeId: 'e1' }
  const db = migrateDB(createSeed())
  const file = { id: 'proof', storageKey: 'original-proof', name: 'proof.pdf', size: 1024, mime: 'application/pdf', uploadedAt: new Date().toISOString() }
  const forbidden = (fn) => assert.throws(fn, { code: 'forbidden' })
  test('v5 migration preserves all records, IDs, documents and custom data', () => {
    const old = createSeed(); old.version = 5; old.requests[0].values.custom = 'keep'; const ids = old.contracts.map((c) => c.id); delete old.documentTemplates; delete old.hrPolicies; delete old.insuranceRecords; delete old.contractBatches; delete old.ruleEvents;
    const migrated = migrateDB(old); assert.equal(migrated.version, DB_VERSION); assert.deepEqual(migrated.contracts.map((c) => c.id), ids); assert.equal(migrated.requests[0].values.custom, 'keep'); assert.equal(migrated.employees[0].children[0].birthDate, old.employees[0].children[0].birthDate); assert.equal(old.version, 5)
    assert.deepEqual(migrateDB(migrated), migrated)
  })
  test('future-schema database is not downgraded', () => assert.throws(() => migrateDB({ ...db, version: 999 })))
  test('essential dashboard distinguishes missing contract and required documents', () => { const d = structuredClone(db); d.contracts = []; d.documents = []; const r = R.essentialPersonnel(d, d.employees[0]); assert.equal(r.state, 'missing'); assert.ok(r.documents.length); assert.ok(r.documents.every((x) => x.status === 'not_submitted')) })
  const e = db.employees[0]
  const base = db.contracts.find((c) => c.kind === 'worker' && c.employeeId === e.id)
  test('expired completed contract never counts as active', () => { const d = structuredClone(db); d.contracts = [{ ...base, stage: 'completed', startDate: '2020-01-01', endDate: '2020-02-01' }]; assert.equal(R.essentialPersonnel(d, d.employees[0]).state, 'expired') })
  test('pending signature has its own status/action', () => { const d = structuredClone(db); d.contracts = [{ ...base, stage: 'awaiting_worker', employeeSignature: undefined, endDate: '2090-01-01' }]; assert.equal(R.essentialPersonnel(d, d.employees[0]).state, 'pending_signature') })
  test('signed current contract is active; future signed contract is separate', () => { const d = structuredClone(db); const c = { ...base, stage: 'completed', startDate: '2020-01-01', endDate: '2090-01-01', parties: [{ role: 'worker', required: true, signedAt: '2020-01-01' }, { role: 'company', required: true, signedAt: '2020-01-01' }] }; d.contracts = [c]; assert.equal(R.essentialPersonnel(d, d.employees[0]).state, 'active'); c.startDate = '2080-01-01'; assert.equal(R.essentialPersonnel(d, d.employees[0]).state, 'future') })
  test('contract preparation request deduplicates follow-up task', () => { A.requestContractPreparation(db, emp); A.requestContractPreparation(db, emp); assert.equal(db.tasks.filter((t) => t.ruleId === 'contract_preparation' && t.link.id === e.id).length, 1) })
  const childInput = { firstName: 'آرمان', lastName: 'رضایی', nationalId: '', relation: 'son', birthDate: J.jalaliToISO(1395, 2, 15), documents: [file] }
  let child
  test('new child registration persists birth date, certificate and pending review', () => { child = A.saveChild(db, emp, e.id, childInput); assert.equal(child.status, 'pending'); assert.equal(child.documents[0].storageKey, file.storageKey); assert.ok(child.registeredAt); assert.ok(db.tasks.some((t) => t.ruleId === 'family_review' && t.link.id === child.id)); assert.equal(db.notifications[0].audience.role, 'company') })
  test('employee cannot edit another employee child', () => forbidden(() => A.saveChild(db, emp, 'e2', childInput)))
  test('foreign company cannot review family information', () => forbidden(() => A.reviewChild(db, other, e.id, child.id, 'approved', '', child.version)))
  test('birth certificate is required', () => assert.throws(() => A.saveChild(db, emp, e.id, { ...childInput, firstName: 'دیگر', documents: [] }), { code: 'validation' }))
  test('future and invalid birth dates rejected', () => { for (const birthDate of ['2090-01-01', '2025-02-31', 'bad']) assert.throws(() => A.saveChild(db, emp, e.id, { ...childInput, birthDate }), { code: 'validation' }) })
  test('HR corrections require a reason', () => assert.throws(() => A.reviewChild(db, hr, e.id, child.id, 'needs_correction', '', child.version), { code: 'validation' }))
  test('HR can request correction; employee replaces certificate with preserved history', () => { A.reviewChild(db, hr, e.id, child.id, 'needs_correction', 'تصویر واضح‌تر', child.version); child = A.saveChild(db, emp, e.id, { ...childInput, documents: [{ ...file, storageKey: 'new-proof' }] }, child.id, child.version); assert.equal(child.status, 'pending'); assert.ok(child.history.some((h) => h.before?.includes('original-proof'))); assert.ok(db.tasks.some((t) => t.ruleId === 'family_review' && t.link.id === child.id && t.status === 'todo')) })
  test('stale family changes rejected', () => assert.throws(() => A.saveChild(db, emp, e.id, childInput, child.id, 1), { code: 'conflict' }))
  test('HR approval closes task and employee cannot overwrite verified child', () => { A.reviewChild(db, hr, e.id, child.id, 'approved', '', child.version); assert.ok(db.tasks.filter((t) => t.ruleId === 'family_review' && t.link.id === child.id).every((t) => t.status === 'done')); forbidden(() => A.saveChild(db, emp, e.id, childInput, child.id, child.version)) })
  test('age rule checks actual Jalali birthday and not approximate days', () => { assert.equal(R.ageThresholdDate(J.jalaliToISO(1387, 8, 22), 18), J.jalaliToISO(1405, 8, 22)); const d = structuredClone(db); d.ruleEvents = []; d.employees[0].children = [{ ...child, birthDate: J.jalaliToISO(1387, 8, 22) }]; const before = d.notifications.length; R.evaluateFamilyRules(d, J.jalaliToISO(1405, 8, 21)); assert.equal(d.notifications.length, before); R.evaluateFamilyRules(d, J.jalaliToISO(1405, 8, 22)); assert.equal(d.notifications.length, before + 2); R.evaluateFamilyRules(d, J.jalaliToISO(1405, 8, 23)); assert.equal(d.notifications.length, before + 2); const restored = migrateDB(JSON.parse(JSON.stringify(d))); R.evaluateFamilyRules(restored, J.jalaliToISO(1405, 9, 1)); assert.equal(restored.notifications.length, before + 2) })
  test('Esfand leap birthday uses last valid day on non-leap anniversary', () => { let y = 1380; while (!J.isLeapJalaliYear(y) || J.isLeapJalaliYear(y + 18)) y++; assert.equal(R.ageThresholdDate(J.jalaliToISO(y, 12, 30), 18), J.jalaliToISO(y + 18, 12, 29)) })
  test('company policy is configurable, company-isolated and does not change benefits', () => { const before = e.bankAccounts; A.saveHRPolicy(db, company, { companyId: 'c1', childAgeThreshold: 20, childNationalIdRequired: false }); assert.equal(R.policyFor(db, 'c1').childAgeThreshold, 20); assert.deepEqual(e.bankAccounts, before); forbidden(() => A.saveHRPolicy(db, other, { companyId: 'c1', childAgeThreshold: 18, childNationalIdRequired: false })) })
  const insuranceInput = { year: 1404, month: 1, days: 31, employer: 'کارفرمای نمونه', registrationNumber: '۱۲۳۴', documents: [file] }
  let ins
  test('insurance manual entry accepts a 31-day month and stores support file', () => { ins = A.saveInsurance(db, emp, e.id, insuranceInput); assert.equal(ins.days, 31); assert.equal(ins.registrationNumber, '1234'); assert.equal(ins.status, 'pending') })
  test('insurance rejects 31 days in a 30-day Jalali month', () => assert.throws(() => A.saveInsurance(db, emp, e.id, { ...insuranceInput, month: 8 }), { code: 'validation' }))
  test('Esfand insurance cap respects leap year', () => { let y = 1403; while (J.isLeapJalaliYear(y)) y--; assert.throws(() => A.saveInsurance(db, emp, e.id, { ...insuranceInput, year: y, month: 12, days: 30 }), { code: 'validation' }) })
  test('negative and fractional insurance days rejected', () => { for (const days of [-1, 1.5, NaN]) assert.throws(() => A.saveInsurance(db, emp, e.id, { ...insuranceInput, days }), { code: 'validation' }) })
  test('zero days allowed, employer and period duplicates prevented', () => { A.saveInsurance(db, emp, e.id, { ...insuranceInput, employer: 'کارفرمای دوم', days: 0 }); assert.throws(() => A.saveInsurance(db, emp, e.id, insuranceInput), { code: 'duplicate' }) })
  test('foreign employee and foreign company cannot edit insurance', () => { forbidden(() => A.saveInsurance(db, emp, 'e2', insuranceInput)); forbidden(() => A.saveInsurance(db, other, e.id, insuranceInput)) })
  test('HR can return, employee resubmit, HR approve and edit with history', () => { A.reviewInsurance(db, hr, ins.id, 'needs_correction', 'روزها اصلاح شود', ins.version); ins = A.saveInsurance(db, emp, e.id, { ...insuranceInput, days: 28 }, ins.id, ins.version); A.reviewInsurance(db, hr, ins.id, 'approved', 'بررسی دستی شرکت', ins.version); forbidden(() => A.saveInsurance(db, emp, e.id, insuranceInput, ins.id, ins.version)); ins = A.saveInsurance(db, hr, e.id, { ...insuranceInput, days: 29 }, ins.id, ins.version); assert.equal(ins.status, 'pending'); assert.ok(ins.history.some((h) => h.before?.includes('28'))) })
  test('insurance export is company scoped and unavailable to employee', () => { assert.ok(A.exportInsurance(db, hr).every((r) => r.companyId === 'c1')); assert.equal(A.exportInsurance(db, other).length, 0); forbidden(() => A.exportInsurance(db, emp)) })
  test('official Social Security provider explicitly unavailable', () => assert.equal(socialSecurityProvider.available, false))
  await assert.rejects(() => socialSecurityProvider.inquireHistory(e.id), /هنوز/)
  const format = db.documentTemplates.find((t) => t.companyId === 'c1')
  test('company cannot modify other-company template or impersonate companyId', () => { forbidden(() => A.saveDocumentTemplate(db, other, format, format.version)); forbidden(() => A.saveDocumentTemplate(db, company, { ...db.documentTemplates.find((t) => t.companyId === 'c2'), companyId: 'c1' }, 1)) })
  test('HR without template privilege cannot change format', () => forbidden(() => A.saveDocumentTemplate(db, hr, format, format.version)))
  test('template changes are version checked', () => assert.throws(() => A.saveDocumentTemplate(db, company, format, 0), { code: 'conflict' }))
  const period = '1404-01'
  db.payslips = db.payslips.filter((p) => !(p.employeeId === e.id && p.year === 1404 && p.month === 1))
  const pay = uploadPayslip(db, company, { employeeId: e.id, period, file, templateId: format.id })
  test('payslip original preserved and company format snapshotted', () => { const before = structuredClone(pay.documentFormat); A.saveDocumentTemplate(db, company, { ...format, header: 'سربرگ جدید' }, format.version); assert.deepEqual(pay.documentFormat, before); assert.equal(A.payslipFile(db, emp, pay.id).storageKey, 'original-proof'); assert.deepEqual(pay.earnings, []) })
  test('other employee/company cannot download payroll', () => { forbidden(() => A.payslipFile(db, { ...emp, employeeId: 'e2' }, pay.id)); forbidden(() => A.payslipFile(db, other, pay.id)) })
  const updatedFormat = db.documentTemplates.find((t) => t.id === format.id)
  db.contracts = db.contracts.filter((c) => c.kind !== 'worker')
  const batchInput = { batchId: 'batch-test', employeeIds: ['e1', 'e2'], contractType: 'قرارداد موقت', startDate: J.jalaliToISO(1406, 1, 1), endDate: J.jalaliToISO(1406, 1, 31), templateId: updatedFormat.id, templateVersion: updatedFormat.version, description: 'شرح نمونه', salary: 100000000, workingConditions: '۴۴ ساعت', projectId: '' }
  test('bulk preview validates authorized selected employees and format', () => assert.equal(B.previewContractBatch(db, company, batchInput).filter((r) => !r.error).length, 2))
  test('invalid date range rejected before any records created', () => { const n = db.contracts.length; assert.throws(() => B.createContractBatch(db, company, { ...batchInput, endDate: batchInput.startDate }), { code: 'validation' }); assert.equal(db.contracts.length, n) })
  test('HR cannot perform bulk issuance without explicit permission', () => forbidden(() => B.createContractBatch(db, hr, batchInput)))
  const batch = B.createContractBatch(db, company, batchInput)
  test('bulk creates separate contracts, correct owners and independent signatures', () => { assert.equal(batch.results.length, 2); const cs = batch.results.map((r) => db.contracts.find((c) => c.id === r.contractId)); assert.notEqual(cs[0].id, cs[1].id); assert.equal(cs[0].companyId, 'c1'); assert.equal(cs[0].employeeId, 'e1'); cs[0].parties[0].signedAt = 'now'; assert.equal(cs[1].parties[0].signedAt, undefined); assert.equal(cs[0].stage, 'draft'); assert.equal(cs[0].documentFormat.header, 'سربرگ جدید'); assert.ok(cs[0].createdAt) })
  test('retrying successful batch is idempotent and preserves contracts', () => { const n = db.contracts.length; B.createContractBatch(db, company, batchInput); assert.equal(db.contracts.length, n) })
  test('reusing batch token with changed config rejected', () => assert.throws(() => B.createContractBatch(db, company, { ...batchInput, salary: 50 }), { code: 'conflict' }))
  test('overlapping intervals reported, not duplicated in new batch', () => { const b = B.createContractBatch(db, company, { ...batchInput, batchId: 'overlap' }); assert.ok(b.results.every((r) => !r.contractId && r.error.includes('همپوشانی'))) })
  const foreign = db.employees.find((e) => e.companyId === 'c2')
  const partialInput = { ...batchInput, batchId: 'partial', employeeIds: ['e3', foreign.id] }
  const partial = B.createContractBatch(db, company, partialInput)
  test('partial batch reports scoped failure without discarding success', () => { assert.ok(partial.results.find((r) => r.employeeId === 'e3').contractId); assert.ok(partial.results.find((r) => r.employeeId === foreign.id).error); assert.ok(!partial.results.find((r) => r.employeeId === foreign.id).contractId) })
  test('failed-row retry keeps prior successes and never adopts new employees', () => { const n = db.contracts.length; B.createContractBatch(db, company, { ...partialInput, employeeIds: [foreign.id] }); assert.equal(db.contracts.length, n); assert.ok(partial.results.find((r) => r.employeeId === 'e3').contractId); assert.throws(() => B.createContractBatch(db, company, { ...partialInput, employeeIds: ['e4'] }), { code: 'conflict' }) })
  test('contract format snapshot remains stable after template updates', () => { const c = db.contracts.find((c) => c.batchId === batch.id); const before = structuredClone(c.documentFormat); A.saveDocumentTemplate(db, company, { ...updatedFormat, footer: 'پاورقی جدید' }, updatedFormat.version); assert.deepEqual(c.documentFormat, before) })
  test('essential checklist updates from missing to pending to approved without conflating states', () => {
    const d = structuredClone(db); d.documents = [];
    const initial = R.essentialPersonnel(d, d.employees[0]); const typeId = initial.documents[0].type.id;
    d.documents.push({ id: 'test-doc', employeeId: e.id, typeId, versions: [{ version: 1, status: 'pending', fileName: 'proof.pdf', mime: 'application/pdf', size: 100, uploadedAt: new Date().toISOString(), uploadedBy: 'test', receiptNo: 'R' }] });
    assert.equal(R.essentialPersonnel(d, d.employees[0]).documents.find((x) => x.type.id === typeId).status, 'pending');
    d.documents[0].versions[0].status = 'rejected'; assert.equal(R.essentialPersonnel(d, d.employees[0]).documents.find((x) => x.type.id === typeId).status, 'rejected');
    d.documents[0].versions[0].status = 'approved'; assert.ok(!R.essentialPersonnel(d, d.employees[0]).documents.some((x) => x.type.id === typeId));
  })
  test('company cap can reduce but never increase insurance month length', () => {
    const d = structuredClone(db); A.saveHRPolicy(d, company, { companyId: 'c1', childAgeThreshold: 18, childNationalIdRequired: false, insuranceMonthlyCap: 20 });
    assert.throws(() => A.saveInsurance(d, emp, e.id, { ...insuranceInput, employer: 'cap-test', days: 21 }), { code: 'validation' });
    A.saveHRPolicy(d, company, { companyId: 'c1', childAgeThreshold: 18, childNationalIdRequired: false, insuranceMonthlyCap: 31 });
    assert.throws(() => A.saveInsurance(d, emp, e.id, { ...insuranceInput, employer: 'cap-test', month: 8, days: 31 }), { code: 'validation' });
  })
  test('failed valid-scope row can succeed on retry after cause is fixed without regenerating successes', () => {
    const d = structuredClone(db); const a = d.employees.find((e) => e.id === 'e4'); const b = d.employees.find((e) => e.id === 'e5'); a.employmentStatus = 'terminated'; b.employmentStatus = 'active';
    const t = d.documentTemplates.find((t) => t.companyId === 'c1'); const input = { ...batchInput, templateVersion: t.version, batchId: 'retry-fixed', employeeIds: [a.id, b.id] };
    const initial = B.createContractBatch(d, company, input); const firstSuccess = initial.results.find((r) => r.employeeId === b.id).contractId;
    assert.ok(firstSuccess); assert.ok(initial.results.find((r) => r.employeeId === a.id).error);
    a.employmentStatus = 'active'; const retry = B.createContractBatch(d, company, { ...input, employeeIds: [a.id] });
    assert.ok(retry.results.find((r) => r.employeeId === a.id).contractId); assert.equal(retry.results.find((r) => r.employeeId === b.id).contractId, firstSuccess); assert.equal(d.contracts.filter((c) => c.batchId === input.batchId).length, 2);
  })
  test('historical insurance company ownership survives an employee company change', () => {
    const d = structuredClone(db); const worker = d.employees.find((x) => x.id === e.id); worker.companyId = 'c2'; worker.orgId = 'o1';
    const r = d.insuranceRecords.find((r) => r.id === ins.id);
    forbidden(() => A.reviewInsurance(d, other, r.id, 'approved', '', r.version));
    forbidden(() => A.saveInsurance(d, other, worker.id, insuranceInput, r.id, r.version));
    assert.ok(!A.exportInsurance(d, other).some((x) => x.id === r.id));
  })
  test('project-limited company admin cannot access an out-of-scope employee or issue their contract', () => {
    const d = structuredClone(db); d.users.find((u) => u.id === company.userId).projectScope = ['p1'];
    forbidden(() => A.authorizedEmployee(d, company, 'e1', 'family.review'));
    const t = d.documentTemplates.find((t) => t.companyId === 'c1'); const preview = B.previewContractBatch(d, company, { ...batchInput, templateVersion: t.version, employeeIds: ['e1'] });
    assert.ok(preview[0].error); assert.equal(preview[0].name, 'خارج از محدوده دسترسی');
  })
  test('previous payroll original can be authorized independently after file replacement', () => {
    const current = db.payslips.find((p) => p.id === pay.id);
    uploadPayslip(db, company, { employeeId: e.id, period, file: { ...file, storageKey: 'new-original' }, expectedVersion: current.version, correctionNote: 'اصلاح فایل' });
    assert.equal(A.payslipFile(db, emp, pay.id, 1).storageKey, 'original-proof'); assert.equal(A.payslipFile(db, emp, pay.id).storageKey, 'new-original');
  })
  console.log(passed + ' HR enhancement checks passed')
} finally { await s.close() }
