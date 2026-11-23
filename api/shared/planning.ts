import { z } from 'zod';
import { maxPaise } from './household';

export const planningId = z.string().min(1).max(320).refine(value => !value.includes('/') && value !== '.' && value !== '..' && !/^__.*__$/.test(value) && !Array.from(value).some(c => c.charCodeAt(0) < 32));
export const planningMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const label = z.string().trim().min(1).max(160);
const amount = z.number().int().min(1).max(maxPaise);
export const allocation = z.strictObject({ holdingId: planningId, basisPoints: z.number().int().min(1).max(10000) });
export const goalInput = z.strictObject({
  name: label, targetPaise: amount, targetMonth: planningMonth, allocations: z.array(allocation).max(30),
});
export const goal = goalInput.extend({
  id: planningId,
  original: z.object({ todayValue: z.number(), inflationRate: z.number(), targetYear: z.number().int(), referenceYear: z.number().int(), type: z.string(), visibility: z.string() }).optional(),
});
export const scheduleInput = z.strictObject({
  name: label, monthlyPaise: amount, startMonth: planningMonth, endMonth: planningMonth.nullable(),
  annualRate: z.number().min(0).max(2), type: label, goalId: planningId.nullable(), assetKey: label.nullable(),
});
export const schedule = scheduleInput.extend({
  id: planningId, original: z.object({ instrumentLabel: z.string(), investmentFamily: z.string(), investmentFamilyLabel: z.string(), assetClass: z.string(), customFamily: z.string(), customInstrument: z.string(), visibility: z.string() }).partial().optional(),
});
export const planSchema = z.object({ revision: z.number().int().nonnegative(), goals: z.array(goal).max(150), schedules: z.array(schedule).max(150) });
export type Goal = z.infer<typeof goal>;
export type Schedule = z.infer<typeof schedule>;
export type Plan = z.infer<typeof planSchema>;
export const emptyPlan = (): Plan => ({ revision: 0, goals: [], schedules: [] });
export const sourceKey = z.union([z.literal('working'), z.literal('empty'), z.string().startsWith('scenario:').max(329)]);
export const previewSchema = z.object({
  choices: z.array(z.object({ key: sourceKey, name: z.string() })), source: sourceKey, fingerprint: z.string(),
  plan: planSchema, problems: z.array(z.string()), dangling: z.array(z.object({ scheduleId: planningId, name: z.string() })),
});
export const adoptionInput = z.strictObject({
  source: sourceKey, fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  links: z.array(z.strictObject({ scheduleId: planningId, goalId: planningId.nullable() })).max(150),
});
export const stateSchema = z.object({ adopted: z.boolean(), available: z.boolean(), plan: planSchema });
export type PlannerState = z.infer<typeof stateSchema>;
export type Preview = z.infer<typeof previewSchema>;
export type Adoption = z.infer<typeof adoptionInput>;

export function indiaDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function monthlyCash(income: readonly { amountPaise: number }[], spentPaise: number, bills: readonly { expense?: unknown; bill: { amountPaise: number } }[]) {
  const earned = income.reduce((sum, row) => sum + row.amountPaise, 0);
  const billsPaise = bills.reduce((sum, row) => sum + (row.expense ? 0 : row.bill.amountPaise), 0);
  return { earned, billsPaise, left: earned - spentPaise - billsPaise, known: income.length > 0 };
}
function monthNumber(value: string) { return Number(value.slice(0, 4)) * 12 + Number(value.slice(5)); }

export function goalProgress(item: Goal, holdings: readonly { id: string; amountPaise: number }[], month: string) {
  const missing: string[] = [];
  let saved = 0;
  for (const share of item.allocations) {
    const holding = holdings.find(row => row.id === share.holdingId);
    if (holding) saved += Math.floor(holding.amountPaise * share.basisPoints / 10000);
    else missing.push(share.holdingId);
  }
  const gap = Math.max(0, item.targetPaise - saved);
  const months = monthNumber(item.targetMonth) - monthNumber(month) + 1;
  return { saved, gap, monthly: gap === 0 ? 0 : months > 0 ? Math.ceil(gap / months) : null, missing };
}

export function planProblem(plan: Plan): string | undefined {
  const used = new Map<string, number>();
  for (const item of plan.goals) {
    const selected = new Set<string>();
    for (const share of item.allocations) {
      if (selected.has(share.holdingId)) return 'Choose each holding once per goal.';
      selected.add(share.holdingId);
      const total = (used.get(share.holdingId) ?? 0) + share.basisPoints;
      if (total > 10000) return 'The total across goals exceeds 100% of this holding.';
      used.set(share.holdingId, total);
    }
  }
  for (const row of plan.schedules) {
    if (row.endMonth && row.endMonth < row.startMonth) return 'Choose an end month on or after the start.';
    if (row.goalId && row.assetKey) return 'Link the schedule to one goal or one asset category.';
    if (row.goalId && !plan.goals.some(g => g.id === row.goalId)) return 'Choose a current goal for this schedule.';
  }
  return undefined;
}

export function individualProjection(plan: Plan) {
  return {
    goals: plan.goals.map(g => ({ id: g.id, name: g.name, type: g.original?.type ?? 'OTHER', targetYear: Number(g.targetMonth.slice(0, 4)), targetMonth: g.targetMonth, todayValue: g.targetPaise / 100, inflationRate: 0, visibility: 'private' })),
    activeSavings: plan.schedules.map(s => ({ ...s.original, id: s.id, name: s.name, type: s.type, monthlyAmount: s.monthlyPaise / 100, annualRate: s.annualRate, startDate: s.startMonth, endDate: s.endMonth ?? '', linkType: s.goalId ? 'goal' : s.assetKey ? 'asset' : null, linkedGoalId: s.goalId, linkedAssetKey: s.assetKey, visibility: 'private' })),
  };
}
