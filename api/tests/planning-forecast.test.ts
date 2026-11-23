import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Goal, Schedule } from '../shared/planning';
import { depositForecast, goalForecast, planningForecasts, scheduleEstimate } from '../shared/planning-forecast';

const rd: Schedule = { id: 'rd', name: 'School RD', monthlyPaise: 500000, startMonth: '2026-01', endMonth: '2026-12', annualRate: .07, type: 'RD', goalId: 'fees', assetKey: null };
const goal: Goal = { id: 'fees', name: 'School fees', targetMonth: '2026-12', targetPaise: 7000000, allocations: [{ holdingId: 'fd', basisPoints: 5000 }] };

test('twelve ₹5,000 RD instalments at 7% nominal compounded quarterly mature at ₹62,310.66', () => {
  assert.deepEqual(depositForecast(rd,'2026-01','2026-12'), { instalments:12, throughMonth:'2026-12', principalPaise:6000000, interestPaise:231066, valuePaise:6231066 });
  assert.equal(depositForecast({...rd,annualRate:0},'2026-01','2026-12').valuePaise,6000000);
  assert.equal(depositForecast(rd,'2026-01','2027-12').valuePaise,6231066);
  assert.equal(depositForecast(rd,'2027-01','2027-01').valuePaise,0);
  assert.equal(depositForecast(rd,'2026-01','2025-12').instalments,0);
  assert.equal(depositForecast({...rd,annualRate:0,monthlyPaise:12345},'2026-12','2026-12').valuePaise,12345);
});
test('maturity and the earlier goal month have independent values, open schedules need a horizon', () => {
  const estimate = scheduleEstimate(rd,[{...goal,targetMonth:'2026-03'}],'2026-02');
  assert.equal(estimate.atGoal?.instalments,3);
  assert.equal(estimate.maturity?.instalments,12);
  assert.equal(estimate.remaining?.instalments,11);
  assert.equal(scheduleEstimate({...rd,endMonth:null},[goal],'2026-02').maturity?.instalments,12);
  assert.equal(scheduleEstimate({...rd,endMonth:null,goalId:null},[goal],'2026-02').maturity,null);
  assert.equal(scheduleEstimate({...rd,type:'MF_SIP'},[goal],'2026-02').maturity?.valuePaise,Math.round(Array.from({length:12},(_,i)=>500000*Math.pow(1.07,(i+1)/12)).reduce((a,b)=>a+b,0)));
});
test('goal combines allocated balances with future instalments only, respecting multiple goals and schedules', () => {
  const r = {...rd,annualRate:0};
  const h = [{id:'fd',amountPaise:200000}];
  const p = planningForecasts({revision:8,goals:[goal,{...goal,id:'b',allocations:[]}],schedules:[r,{...r,id:'b',goalId:'b'},{...r,id:'x',monthlyPaise:10000},{...r,id:'none',goalId:null}]},h,'2026-07');
  assert.equal(p.goals[0].saved,100000); assert.equal(p.goals[0].forecast.balancePaise,3160000);
  assert.equal(p.goals[0].forecast.extraMonthlyPaise,640000); assert.equal(p.goals[1].forecast.balancePaise,3000000);
  const paid=goalForecast(goal,h,[{...r,balanceThroughMonth:'2026-07'}],'2026-07');
  assert.equal(paid.forecast.balancePaise,2600000);
  assert.equal(goalForecast(goal,h,[{...r,balanceThroughMonth:'2026-07'}],'2026-08').forecast.balancePaise,2600000);
  const all=goalForecast(goal,[],[{...rd,includePastInstalments:true}],'2026-07');
  assert.equal(all.forecast.pastPrincipalPaise,3000000); assert.equal(all.forecast.principalPaise,3000000); assert.equal(all.forecast.balancePaise,6231066);
  assert.equal(goalForecast(goal,h,[r],'2027-01').forecast.extraMonthlyPaise,null);
});
test('unsupported magnitudes produce explicit unavailable estimates and preserve recorded savings', () => {
  const huge={...rd,monthlyPaise:100000000000,startMonth:'0001-01',endMonth:'9999-12',annualRate:2};
  const end=depositForecast(huge,'0001-01','9999-12');
  assert.equal(end.valuePaise,null); assert.equal(end.principalPaise,null);
  const result=goalForecast({...goal,targetMonth:'9999-12'},[],[huge],'0001-01');
  assert.equal(result.forecast.balancePaise,null); assert.equal(result.forecast.shortfallPaise,null); assert.equal(result.saved,0);
  assert.equal(depositForecast(huge,'9999-12','9999-12','9999-12').valuePaise,0);
});
