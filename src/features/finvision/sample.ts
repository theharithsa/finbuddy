import type { Plan } from '../../../api/shared/planning';

export function samplePlan(month: string): Plan {
  const date = new Date(month + '-01T12:00:00Z'); date.setUTCMonth(date.getUTCMonth() + 9);
  return { revision: 1, goals: [{ id: 'family', name: 'Family emergency fund', targetPaise: 12_000_000, targetMonth: date.toISOString().slice(0, 7), allocations: [{ holdingId: 'fixed', basisPoints: 5000 }] }],
    schedules: [{ id: 'monthly', name: 'Monthly family SIP', monthlyPaise: 500_000, type: 'MF_SIP', annualRate: 0, startMonth: month, endMonth: null, goalId: 'family', assetKey: null }] };
}
