import { createHash } from 'node:crypto';
import { z } from 'zod';
import { emptyPlan, goal, planningId, schedule, type Plan, type Preview } from '../shared/planning';

type Row = Record<string, unknown>;
const row = z.record(z.string(), z.unknown());
const defaultRates: Record<string, number> = { EDUCATION: 0.11, PROPERTY: 0.07, VEHICLE: 0.05, TRAVEL: 0.06 };
const legacyGoal = z.object({
  name: z.string(), targetYear: z.number().int().min(1900).max(2200), todayValue: z.number().positive(),
  type: z.string().default('OTHER'), inflationRate: z.number().min(0).max(2).optional(), visibility: z.string().default('private'),
});
const legacyRates: Record<string, number> = { MF_SIP: 0.13, RD: 0.07, PPF: 0.071, NPS: 0.10 };
const legacySchedule = z.object({
  name: z.string(), type: z.string(), monthlyAmount: z.number().positive(), annualRate: z.number().min(0).max(2).nullish(),
  startDate: z.string().optional(), endDate: z.string().nullish(), linkType: z.enum(['goal', 'asset']).nullish(),
  linkedGoalId: planningId.nullish(), linkedAssetKey: z.string().nullish(),
});
export const sha = (value: string) => createHash('sha256').update(value).digest('hex');

export function convertSource(data: Row, source: string, revision: string, year: number) {
  const plan = emptyPlan();
  const problems: string[] = [];
  const dangling: Preview['dangling'] = [];
  const referenceYear = z.number().int().min(1900).max(2200).safeParse(data.planStartYear);
  const basis = referenceYear.success ? referenceYear.data : year;
  function rows(key: 'goals' | 'activeSavings', convert: (raw: Row, id: string) => void) {
    const entries = z.array(row).max(150).safeParse(data[key] === undefined ? [] : data[key]);
    if (!entries.success) { problems.push('Review the ' + key + ' list in FinVision before moving this plan (up to 150 rows).'); return; }
    const seen = new Set<string>();
    entries.data.forEach((raw, index) => {
      const id = planningId.safeParse(raw.id ?? ('import-' + sha(JSON.stringify([source, key, index])).slice(0, 32)));
      const issue = key === 'goals' ? 'Goal' : 'Investment';
      if (!id.success || seen.has(id.data)) { problems.push(issue + ' ' + (index + 1) + ' has an invalid or duplicate ID. Review it in FinVision.'); return; }
      seen.add(id.data);
      try { convert(raw, id.data); } catch { problems.push(issue + ' ' + (index + 1) + ' needs a valid name, amount, date or rate in FinVision.'); }
    });
  }
  rows('goals', (raw, id) => {
    const g = legacyGoal.parse(raw);
    const inflationRate = g.inflationRate ?? defaultRates[g.type] ?? 0.08;
    const targetPaise = Math.round(g.todayValue * Math.pow(1 + inflationRate, Math.max(0, g.targetYear - basis)) * 100);
    plan.goals.push(goal.parse({ id, name: g.name, targetPaise, targetMonth: g.targetYear + '-12', allocations: [],
      original: { todayValue: g.todayValue, inflationRate, referenceYear: basis, targetYear: g.targetYear, type: g.type, visibility: g.visibility } }));
  });
  rows('activeSavings', (raw, id) => {
    const s = legacySchedule.parse(raw);
    const original = schedule.shape.original.parse(raw);
    const item = schedule.parse({ id, name: s.name, monthlyPaise: Math.round(s.monthlyAmount * 100), type: s.type,
      annualRate: s.annualRate ?? legacyRates[s.type] ?? 0.10, startMonth: s.startDate || basis + '-01', endMonth: s.endDate || null,
      goalId: s.linkType === 'goal' ? s.linkedGoalId ?? null : null, assetKey: s.linkType === 'asset' ? s.linkedAssetKey ?? null : null, original });
    if (item.endMonth && item.endMonth < item.startMonth) throw new Error('Invalid range');
    if (s.linkType === 'asset' && !item.assetKey) throw new Error('Missing asset category');
    if (s.linkType === 'goal' && !plan.goals.some(g => g.id === item.goalId)) dangling.push({ scheduleId: id, name: item.name });
    plan.schedules.push(item);
  });
  return { plan, problems, dangling, fingerprint: sha(JSON.stringify([source, revision, basis, plan])) };
}

export function validateResolvedLinks(plan: Plan, dangling: Preview['dangling'], links: {scheduleId: string; goalId: string | null}[]) {
  const byId = new Map(links.map(l => [l.scheduleId, l.goalId]));
  if (byId.size !== links.length || links.length !== dangling.length || dangling.some(s => !byId.has(s.scheduleId))) return false;
  for (const s of plan.schedules) {
    if (byId.has(s.id)) s.goalId = byId.get(s.id) ?? null;
  }
  return true;
}
