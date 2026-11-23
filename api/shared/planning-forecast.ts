import { goalProgress, type Goal, type Plan, type Schedule } from './planning';

type DepositTerms = Pick<Schedule, 'type' | 'monthlyPaise' | 'annualRate' | 'startMonth' | 'endMonth'>;
type HoldingBalance = { id: string; amountPaise: number };

export function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1;
}

export function monthAt(index: number): string {
  return String(Math.floor(index / 12)).padStart(4, '0') + '-' + String(index % 12 + 1).padStart(2, '0');
}

function safePaise(amount: number): number | null {
  const rounded = Math.round(amount);
  return Number.isSafeInteger(rounded) && rounded >= 0 ? rounded : null;
}

/** A beginning-of-month instalment earns through the end of the last included month. */
export function depositForecast(terms: DepositTerms, from: string, through: string, recordedThrough?: string | null) {
  const first = Math.max(monthIndex(terms.startMonth), monthIndex(from), recordedThrough ? monthIndex(recordedThrough) + 1 : 0);
  const last = terms.endMonth && terms.endMonth < through ? terms.endMonth : through;
  const instalments = Math.max(0, monthIndex(last) - first + 1);
  const principalPaise = terms.monthlyPaise * instalments;
  const logRate = terms.type === 'RD' ? Math.log1p(terms.annualRate / 4) / 3 : Math.log1p(terms.annualRate) / 12;
  const valuePaise = !instalments || !logRate ? safePaise(principalPaise) :
    safePaise(terms.monthlyPaise * (Math.expm1(instalments * logRate) / Math.expm1(logRate)) * Math.exp(logRate));
  return { instalments, throughMonth: last, principalPaise: safePaise(principalPaise), interestPaise: valuePaise === null ? null : valuePaise - principalPaise, valuePaise };
}

export function scheduleEstimate(row: Schedule, goals: readonly Goal[], month: string) {
  const target = goals.find(item => item.id === row.goalId)?.targetMonth;
  const end = row.endMonth ?? target;
  return {
    id: row.id,
    maturity: end ? depositForecast(row, row.startMonth, end) : null,
    atGoal: target ? depositForecast(row, row.startMonth, target) : null,
    remaining: end ? depositForecast(row, month, end, row.balanceThroughMonth) : null,
  };
}

/** Recorded balances have no assumed yield. Unconfirmed historic contributions stay out of goal totals. */
export function goalForecast(goal: Goal, holdings: readonly HoldingBalance[], schedules: readonly Schedule[], month: string, through = goal.targetMonth) {
  const progress = goalProgress(goal, holdings, month);
  let principalPaise: number | null = 0, pastPrincipalPaise: number | null = 0;
  let interestPaise: number | null = 0;
  let monthlyPlannedPaise = 0;
  for (const row of schedules) {
    if (row.goalId !== goal.id) continue;
    const remaining = depositForecast(row, month, through, row.balanceThroughMonth);
    const estimate = row.includePastInstalments ? depositForecast(row, row.startMonth, through) : remaining;
    principalPaise = principalPaise === null || remaining.principalPaise === null ? null : safePaise(principalPaise + remaining.principalPaise);
    pastPrincipalPaise = pastPrincipalPaise === null || estimate.principalPaise === null || remaining.principalPaise === null ? null :
      safePaise(pastPrincipalPaise + (estimate.principalPaise - remaining.principalPaise));
    interestPaise = interestPaise === null || estimate.interestPaise === null ? null : safePaise(interestPaise + estimate.interestPaise);
    if (row.startMonth <= month && month <= through && (!row.endMonth || month <= row.endMonth)) monthlyPlannedPaise += row.monthlyPaise;
  }
  const balancePaise = principalPaise === null || pastPrincipalPaise === null || interestPaise === null ? null : safePaise(progress.saved + principalPaise + pastPrincipalPaise + interestPaise);
  const remainingMonths = Math.max(0, monthIndex(through) - monthIndex(month) + 1);
  const shortfallPaise = balancePaise === null ? null : Math.max(0, goal.targetPaise - balancePaise);
  const extraMonthlyPaise = remainingMonths && shortfallPaise !== null ? Math.ceil(shortfallPaise / remainingMonths) : null;
  return { ...progress, forecast: { principalPaise, pastPrincipalPaise, interestPaise, balancePaise, shortfallPaise, extraMonthlyPaise, monthlyPlannedPaise } };
}

export function planningForecasts(plan: Plan, holdings: readonly HoldingBalance[], month: string) {
  return {
    goals: plan.goals.map(item => ({ id: item.id, ...goalForecast(item, holdings, plan.schedules, month) })),
    schedules: plan.schedules.map(row => scheduleEstimate(row, plan.goals, month)),
  };
}
