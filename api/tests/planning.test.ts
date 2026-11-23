import assert from 'node:assert/strict';
import { test } from 'node:test';
import { goalProgress, indiaDate, individualProjection, monthlyCash, planProblem } from '../shared/planning';
import { convertSource, validateResolvedLinks } from '../src/planning-import';

const data = { goals: [{id:'a',name:'Future fees',todayValue:100000,targetYear:2028,type:'EDUCATION',inflationRate:0.10}],
  activeSavings:[{id:'s',name:'SIP',type:'MF_SIP',monthlyAmount:5000,annualRate:0,startDate:'2026-11',endDate:'',linkType:'goal',linkedGoalId:'a',assetClass:'equity'}] };
test('review freezes future costs, decimal INR, dates and original recurring links', () => {
  const a = convertSource(data,'working','v1',2026);
  assert.deepEqual(a.problems,[]); assert.deepEqual(a.dangling,[]);
  assert.equal(a.plan.goals[0].targetPaise,12100000);
  assert.equal(a.plan.schedules[0].monthlyPaise,500000);
  assert.equal(a.plan.schedules[0].original?.assetClass,'equity');
  const projected=individualProjection(a.plan);
  assert.equal(projected.goals[0].inflationRate,0); assert.equal(projected.goals[0].todayValue,121000);
  assert.equal(projected.activeSavings[0].linkedGoalId,'a'); assert.equal(projected.activeSavings[0].visibility,'private');
  assert.equal(a.fingerprint,convertSource(data,'working','v1',2026).fingerprint);
  assert.notEqual(a.fingerprint,convertSource(data,'working','v2',2026).fingerprint);
});
test('half an FD funds the goal once; instructions, overdue targets and missing holdings stay distinct',()=>{
  const g={id:'a',name:'Reserve',targetMonth:'2027-08',targetPaise:12000000,allocations:[{holdingId:'fd',basisPoints:5000}]};
  assert.deepEqual(goalProgress(g,[{id:'fd',amountPaise:8000000}],'2026-11'),{saved:4000000,gap:8000000,monthly:800000,missing:[]});
  assert.equal(goalProgress(g,[],'2027-09').monthly,null);
  assert.equal(goalProgress(g,[{id:'fd',amountPaise:30000000}],'2027-09').monthly,0);
  assert.deepEqual(goalProgress(g,[],'2026-11').missing,['fd']);
  assert.ok(planProblem({revision:1,goals:[g,{...g,id:'b',allocations:[{holdingId:'fd',basisPoints:5001}]}],schedules:[]}));
  assert.deepEqual(monthlyCash([{amountPaise:100000}],25000,[{bill:{amountPaise:500},expense:{}},{bill:{amountPaise:15000}}]),{earned:100000,billsPaise:15000,left:60000,known:true});
  assert.equal(monthlyCash([],0,[]).known,false);
  assert.equal(indiaDate(new Date('2026-11-30T19:00:00Z')),'2026-12-01');
});
test('dangling links require explicit resolution; invalid and duplicate rows cannot transfer',()=>{
  const preview=convertSource({...data,goals:[]},'scenario:s','v1',2026);
  assert.equal(preview.dangling.length,1);
  assert.equal(validateResolvedLinks(preview.plan,preview.dangling,[]),false);
  assert.equal(validateResolvedLinks(preview.plan,preview.dangling,[{scheduleId:'s',goalId:null}]),true);
  assert.equal(preview.plan.schedules[0].goalId,null);
  assert.equal(convertSource({goals:[data.goals[0],data.goals[0],{}]},'working','v',2026).problems.length,2);
});
