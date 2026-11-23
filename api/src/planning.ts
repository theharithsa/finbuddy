import { planningForecasts } from '../shared/planning-forecast';
import { randomUUID } from 'node:crypto';
import { reportPlanningTransfer } from './telemetry';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adoptionInput, emptyPlan, goal, goalInput, indiaDate, monthlyCash, individualProjection, planProblem, planSchema, planningId, schedule, scheduleInput, sourceKey, type Plan, type Preview } from '../shared/planning';
import { billSchema, currentOccurrences, householdPaths } from '../shared/household';
import { dataNamespace, isPreProduction } from './deployment';
import { ApiError, requestData } from './errors';
import { convertSource, sha, validateResolvedLinks } from './planning-import';

const ownerPlan = (db: Firestore, uid: string) => db.doc(dataNamespace + '/finvisionPlans/' + uid);
function pilotRef(db: Firestore, uid: string) {
  // Release fixtures exercise their own one-seat preprod gate. Only Admin can seed it.
  if (isPreProduction && /^finbuddy-release-[a-f0-9-]{36}$/.test(uid)) return db.doc(dataNamespace + '/finvisionFixtures/' + uid);
  return db.doc(dataNamespace + '/finvisionControl/pilot');
}
const pilot = z.object({ accepting: z.literal(true), limit: z.number().int().min(1).max(500), enrolled: z.number().int().nonnegative() });
function hasSeat(value: unknown) { const result = pilot.safeParse(value); return result.success && result.data.enrolled < result.data.limit; }
function unavailable() { return new ApiError(403, 'pilot_closed', 'New transfers are paused. Your existing plan is still available in FinVision.'); }
function changed() { return new ApiError(409, 'plan_changed', 'Your plan changed. Refresh and review before saving again.'); }
function readPlan(value: unknown) { return value === undefined ? emptyPlan() : planSchema.parse(value); }
function validatePlan(plan: Plan) {
  const message = planProblem(plan);
  if (message) throw new ApiError(409, 'planning_link', message);
  if (!planSchema.safeParse(plan).success || Buffer.byteLength(JSON.stringify(plan)) > 500_000) throw new ApiError(422, 'plan_limit', 'This plan exceeds the pilot size limit.');
}
export async function planningState(db: Firestore, uid: string) {
  const doc = await ownerPlan(db, uid).get();
  return { adopted: doc.exists, available: doc.exists || hasSeat((await pilotRef(db, uid).get()).data()), plan: readPlan(doc.data()) };
}

async function previewSource(db: Firestore, tx: Transaction, uid: string, requested?: string): Promise<Preview> {
  const root = isPreProduction ? db.doc(dataNamespace + '/finvisionFixtures/' + uid) : db.doc('Users/' + uid + '/FinVision/data');
  const working = await tx.get(root.collection('Personal_Details').doc('profile'));
  const scenarios = await tx.get(root.collection('Financial_Plans').select('name', 'planName').limit(101));
  if (scenarios.size > 100) throw new ApiError(422, 'scenario_limit', 'This account has more than 100 saved scenarios. Contact support to review the transfer.');
  const choices = scenarios.docs.map(d => ({ key: 'scenario:' + d.id, name: String(d.get('planName') || d.get('name') || 'Saved scenario').slice(0, 160) + ' · ' + d.id.slice(-8) }));
  if (working.exists) choices.unshift({ key: 'working', name: 'Current working plan' });
  if (!choices.length) choices.push({ key: 'empty', name: 'New plan' });
  const source = requestData(sourceKey, requested ?? choices[0].key);
  if (!choices.some(choice => choice.key === source)) throw changed();
  const selected = source.startsWith('scenario:') ? await tx.get(root.collection('Financial_Plans').doc(requestData(planningId, source.slice(9)))) : working;
  const stamp = selected.updateTime;
  const revision = stamp ? stamp.seconds + '.' + stamp.nanoseconds : 'empty';
  return { choices, source, ...convertSource(selected.data() ?? {}, source, revision, Number(indiaDate().slice(0, 4))) };
}

export async function previewAdoption(db: Firestore, uid: string, source?: string) {
  return db.runTransaction(async tx => {
    if ((await tx.get(ownerPlan(db, uid))).exists) throw changed();
    if (!hasSeat((await tx.get(pilotRef(db, uid))).data())) throw unavailable();
    return previewSource(db, tx, uid, source);
  }, { readOnly: true });
}

export async function adopt(db: Firestore, uid: string, body: unknown) {
  const input = requestData(adoptionInput, body);
  const ref = ownerPlan(db, uid);
  const receipt = ref.collection('history').doc('adoption');
  const key = sha(JSON.stringify([input.source, input.fingerprint, [...input.links].sort((a,b) => a.scheduleId.localeCompare(b.scheduleId))]));
  const eventId = randomUUID();
  const committed = await db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      const saved = await tx.get(receipt);
      if (saved.get('key') !== key) throw changed();
      return { plan: readPlan(existing.data()), eventId: String(saved.get('eventId')), replay: true };
    }
    if (!hasSeat((await tx.get(pilotRef(db, uid))).data())) throw unavailable();
    const preview = await previewSource(db, tx, uid, input.source);
    if (preview.fingerprint !== input.fingerprint) throw changed();
    if (preview.problems.length || !validateResolvedLinks(preview.plan, preview.dangling, input.links)) {
      throw new ApiError(409, 'review_required', 'Review each flagged row and resolve its links before transferring.');
    }
    const plan = { ...preview.plan, revision: 1 };
    validatePlan(plan);
    tx.create(receipt, { eventId, key, source: preview.source, fingerprint: preview.fingerprint, links: input.links, plan, createdAt: FieldValue.serverTimestamp() });
    tx.create(ref, plan);
    tx.update(pilotRef(db, uid), { enrolled: FieldValue.increment(1) });
    return { plan, eventId, replay: false };
  });
  reportPlanningTransfer(committed.eventId, committed.replay);
  return committed.plan;
}

export async function projection(db: Firestore, uid: string) {
  const doc = await ownerPlan(db, uid).get();
  const plan = readPlan(doc.data());
  return { adopted: doc.exists, revision: plan.revision, ...individualProjection(plan) };
}

export async function planningSummary(db: Firestore, uid: string) {
  const plan = readPlan((await ownerPlan(db, uid).get()).data());
  const ids = [...new Set(plan.goals.flatMap(g => g.allocations.map(a => a.holdingId)))];
  const base = db.collection(dataNamespace + '/users/' + uid + '/' + householdPaths.holdings);
  const docs = ids.length ? await db.getAll(...ids.map(id => base.doc(id)), { fieldMask: ['amountPaise'] }) : [];
  const holdings = docs.flatMap(d => d.exists && Number.isSafeInteger(d.get('amountPaise')) ? [{ id: d.id, amountPaise: Number(d.get('amountPaise')) }] : []);
  const today = indiaDate();
  const month = today.slice(0, 7);
  const owner = db.doc(dataNamespace + '/users/' + uid);
  const limit = 2000;
  const [ledger, income, bills, payments] = await Promise.all([
    owner.collection('expenses').select('amount','date').limit(limit+1).get(),
    owner.collection(householdPaths.income).where('date','>=',month+'-01').where('date','<=',today).select('amountPaise').limit(limit+1).get(),
    owner.collection(householdPaths.bills).limit(limit+1).get(), owner.collection(householdPaths.payments).select('expenseId').limit(limit+1).get(),
  ]);
  if ([ledger,income,bills,payments].some(q=>q.size>limit)) throw new ApiError(422,'summary_limit','The summary exceeds the pilot read limit.');
  const entries = ledger.docs.flatMap(d => typeof d.get('date') === 'string' && typeof d.get('amount') === 'number'
    ? [{id:d.id, date:String(d.get('date')).slice(0,10), amountPaise:Math.round(Number(d.get('amount'))*100)}] : []);
  const spent = entries.filter(e=>e.date.startsWith(month) && e.date<=today).reduce((sum,e)=>sum+e.amountPaise,0);
  const occurrences = currentOccurrences(bills.docs.flatMap(d=>{const b=billSchema.safeParse(d.data()); return b.success ? [{...b.data,id:d.id}] : [];}),
    payments.docs.map(d=>({id:d.id,expenseId:String(d.get('expenseId'))})), entries,month,today);
  const cash = monthlyCash(income.docs.flatMap(d=>Number.isSafeInteger(d.get('amountPaise')) ? [{amountPaise:Number(d.get('amountPaise'))}] : []),spent,occurrences);
  return { month, revision: plan.revision, cashAvailablePaise:cash.known ? cash.left : null, ...planningForecasts(plan, holdings, month) };
}

export async function changePlanning(db: Firestore, uid: string, kind: 'goals' | 'schedules', method: string, id: string, version: string | undefined, body?: unknown) {
  if (!version || !/^[1-9]\d{0,12}$/.test(version)) throw new ApiError(400, 'revision_required', 'Send the plan revision in If-Match.');
  const ref = ownerPlan(db, uid);
  return db.runTransaction(async tx => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new ApiError(409, 'adoption_required', 'Start or transfer your plan in FinBuddy first.');
    const plan = readPlan(doc.data());
    if (plan.revision !== Number(version)) throw changed();
    const current = plan[kind].find(r => r.id === id);
    if (method === 'POST' ? current : !current) throw new ApiError(409, 'item_changed', 'Refresh the plan and check this item.');
    if (method === 'DELETE') {
      if (kind === 'goals' && plan.schedules.some(s => s.goalId === id)) throw new ApiError(409, 'goal_in_use', 'Unlink this goal from its SIPs before removing it.');
      if (kind === 'goals') plan.goals = plan.goals.filter(g => g.id !== id);
      else plan.schedules = plan.schedules.filter(s => s.id !== id);
    } else if (kind === 'goals') {
      const input = method === 'POST' ? requestData(goalInput, body) : requestData(goalInput.partial(), body);
      const updated = requestData(goal, { ...current, ...input, id });
      if (input.allocations?.length) {
        const holding = db.collection(dataNamespace + '/users/' + uid + '/' + householdPaths.holdings);
        const docs = await tx.getAll(...input.allocations.map(a => holding.doc(a.holdingId)));
        if (docs.some(d => !d.exists)) throw new ApiError(409, 'holding_missing', 'Choose a current holding for each allocation.');
      }
      plan.goals = [...plan.goals.filter(g => g.id !== id), updated];
    } else {
      const input = method === 'POST' ? requestData(scheduleInput, body) : requestData(scheduleInput.partial(), body);
      plan.schedules = [...plan.schedules.filter(s => s.id !== id), requestData(schedule, { ...current, ...input, id })];
    }
    plan.revision++;
    validatePlan(plan);
    tx.set(ref, plan);
    return plan;
  });
}
