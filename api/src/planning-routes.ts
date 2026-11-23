import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import { adoptionInput, goal, goalInput, planSchema, planningId, previewSchema, schedule, scheduleInput, sourceKey, stateSchema } from '../shared/planning';
import { ApiError, requestData } from './errors';
import { adopt, changePlanning, planningState, planningSummary, previewAdoption, projection } from './planning';
import type { Operation } from './openapi';

const tag = 'FinVision';
const version = { name: 'If-Match', in: 'header' as const, required: true, schema: z.string().regex(/^[1-9]\d*$/) };
const recordId = { name: 'id', in: 'path' as const, required: true, schema: planningId };
const projectionGoal = z.object({ id: planningId, name: z.string(), type: z.string(), targetYear: z.number(), targetMonth: z.string(), todayValue: z.number(), inflationRate: z.literal(0), visibility: z.literal('private') });
const projectionSchedule = z.object({ id: planningId, name: z.string(), type: z.string(), monthlyAmount: z.number(), annualRate: z.number(), startDate: z.string(), endDate: z.string(), linkType: z.enum(['goal','asset']).nullable(), linkedGoalId: planningId.nullable(), linkedAssetKey: z.string().nullable(), visibility: z.literal('private') }).extend(schedule.shape.original.unwrap().shape);
const estimatedPaise = z.number().int().nonnegative().nullable();
const deposit = z.object({ instalments: z.number().int(), throughMonth: z.string(), principalPaise: estimatedPaise, interestPaise: estimatedPaise, valuePaise: estimatedPaise });
const scheduleEstimate = z.object({ id: planningId, maturity: deposit.nullable(), atGoal: deposit.nullable(), remaining: deposit.nullable() });
const forecast = z.object({ principalPaise: estimatedPaise, pastPrincipalPaise: estimatedPaise, interestPaise: estimatedPaise, balancePaise: estimatedPaise, shortfallPaise: estimatedPaise, extraMonthlyPaise: estimatedPaise, monthlyPlannedPaise: z.number() });
const progress = z.object({ id: planningId, saved: z.number(), gap: z.number(), monthly: z.number().nullable(), missing: z.array(planningId), forecast });

export const planningOperations: Operation[] = [
  { id: 'planning-state', path: '/finvision', method: 'GET', tag, access: 'planning-read', summary: 'Check enrolment and read the owner’s plan', response: stateSchema },
  { id: 'planning-summary', path: '/finvision/summary', method: 'GET', tag, access: 'planning-read', summary: 'Read goal progress, estimated balances and deposit maturities in paise', response: z.object({ month: z.string(), revision: z.number(), cashAvailablePaise: z.number().nullable(), goals: z.array(progress), schedules: z.array(scheduleEstimate) }) },
  { id: 'planning-preview', path: '/finvision/adoption', method: 'GET', tag, access: 'session', summary: 'Preview one working plan or saved scenario', parameters: [{name:'source', in:'query',schema:sourceKey}], response: previewSchema },
  { id: 'planning-adopt', path: '/finvision/adoption', method: 'POST', tag, access: 'session', summary: 'Confirm the reviewed transfer exactly once', request: adoptionInput, response: planSchema },
  { id: 'planning-projection', path: '/finvision/projection', method: 'GET', tag, access: 'session', summary: 'Read current individual projection inputs', response: z.object({ adopted:z.boolean(), revision:z.number(), goals:z.array(projectionGoal), activeSavings:z.array(projectionSchedule) }) },
];
for (const [kind, schema, item] of [['goals', goalInput, goal], ['schedules', scheduleInput, schedule]] as const) {
  const path = '/finvision/' + kind;
  planningOperations.push(
    { id: 'planning-list-' + kind, path, method: 'GET', tag, access: 'planning-read', summary: 'Read owned ' + kind, response: z.array(item) },
    { id: 'planning-get-' + kind, path: path + '/{id}', method: 'GET', tag, access: 'planning-read', summary: 'Read one owned item', parameters: [recordId], response: item },
    { id: 'planning-add-' + kind, path, method: 'POST', tag, access: 'planning-write', summary: 'Add one item with a stable client ID', parameters: [version], request: schema.extend({id:planningId}), response: planSchema },
    { id: 'planning-edit-' + kind, path: path + '/{id}', method: 'PATCH', tag, access: 'planning-write', summary: 'Update one item at the reviewed revision', parameters: [recordId, version], request: schema.partial(), response: planSchema },
    { id: 'planning-remove-' + kind, path: path + '/{id}', method: 'DELETE', tag, access: 'planning-write', summary: 'Remove an item at the reviewed revision', parameters: [recordId, version], response: planSchema },
  );
}

export async function planningDispatch(db: Firestore, uid: string, op: Operation, id: string, version: string | undefined, query: unknown, body?: unknown) {
  switch (op.id) {
    case 'planning-state': return planningState(db, uid);
    case 'planning-summary': return planningSummary(db, uid);
    case 'planning-projection': return projection(db, uid);
    case 'planning-preview': return previewAdoption(db, uid, requestData(z.strictObject({ source: sourceKey.optional() }), query).source);
    case 'planning-adopt': return adopt(db, uid, body);
  }
  const kind = op.path.split('/')[2];
  if (kind !== 'goals' && kind !== 'schedules') throw new ApiError(404, 'not_found', 'Unknown planner resource.');
  if (op.method === 'GET') {
    const items = (await planningState(db, uid)).plan[kind];
    if (!id) return items;
    const found = items.find(item => item.id === id);
    if (!found) throw new ApiError(404,'not_found','That planning item is unavailable.');
    return found;
  }
  if (op.method === 'POST') {
    const { id: newId, ...input } = requestData(z.object({ id: planningId }).passthrough(), body);
    return changePlanning(db, uid, kind, op.method, newId, version, input);
  }
  return changePlanning(db, uid, kind, op.method, id, version, body);
}
