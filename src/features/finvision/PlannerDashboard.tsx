import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, Plus } from '@/components/brand/Icons';
import { money, type Holding } from '@/lib/household';
import type { Goal, Plan } from '../../../api/shared/planning';
import { goalForecast, monthAt, monthIndex, scheduleEstimate } from '../../../api/shared/planning-forecast';
import { displayMonth, estimateMoney } from './forecast-format';
import type { Edit } from './PlannerEditor';

interface Props {
  plan: Plan; holdings: Holding[]; month: string; left: number | null;
  editable: boolean; onEstimate: () => void; edit: (value: Edit) => void; onIncome?: () => void;
}

function Checkpoints({ goal, month, holdings, plan }: Pick<Props, 'month' | 'holdings' | 'plan'> & { goal: Goal }) {
  const start = monthIndex(month), end = monthIndex(goal.targetMonth);
  if (end <= start) return null;
  const steps = Math.min(3, end - start);
  const dates = Array.from({ length: steps + 1 }, (_, i) => monthAt(start + Math.round((end - start) * i / steps)));
  return <details className="forecast-checkpoints"><summary>See the balance along the way</summary>
    <table><caption className="sr-only">Estimated balance at the end of each month shown</caption><thead><tr><th>Month</th><th>Estimated balance</th></tr></thead>
      <tbody>{dates.map(date => <tr key={date}><th scope="row">{displayMonth(date)}</th><td>{estimateMoney(goalForecast(goal, holdings, plan.schedules, month, date).forecast.balancePaise)}</td></tr>)}</tbody></table>
  </details>;
}

export function PlannerDashboard({ plan, holdings, month, left, editable, edit, onIncome, onEstimate }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const goals = [...plan.goals].sort((a, b) => a.targetMonth.localeCompare(b.targetMonth) || a.name.localeCompare(b.name));
  const selected = goals.find(g => g.id === selectedId) ?? goals.find(g => g.targetMonth >= month) ?? goals[0];
  const progress = selected && goalForecast(selected, holdings, plan.schedules, month);
  const forecast = progress?.forecast;
  const active = plan.schedules.filter(s => s.startMonth <= month && (!s.endMonth || s.endMonth >= month));
  const contribution = active.reduce((sum, s) => sum + s.monthlyPaise, 0);
  const recorded = holdings.reduce((sum, h) => sum + h.amountPaise, 0);
  const overdue = selected && selected.targetMonth < month;
  return <>
    <div className="planner-actions">{editable ? <>
      <Button onClick={() => edit({kind:'schedules',type:'RD',goalId:selected?.id})}><Plus size={16}/> Add recurring deposit</Button>
      <Button variant="secondary" onClick={() => edit({kind:'goals'})}><Plus size={16}/> Add goal</Button>
    </> : <Button variant="secondary" onClick={onEstimate}>Estimate a recurring deposit</Button>}</div>
    <dl className="planner-stats" aria-label="Planning overview">
      <div><dt>Recorded savings</dt><dd>{money(recorded)}</dd><small>Latest holding balances</small></div>
      <div><dt>Planned this month</dt><dd>{editable ? money(contribution) : 'No active plan'}</dd><small>{editable ? active.length + ' active ' + (active.length === 1 ? 'contribution' : 'contributions') : 'Estimate a deposit above'}</small></div>
      <div><dt>Left after bills</dt><dd>{left === null ? 'Income needed' : money(left)}</dd>
        {left === null && onIncome ? <button type="button" onClick={onIncome}>Add income</button> : <small>{displayMonth(month)}</small>}</div>
    </dl>
    {selected && progress && forecast ? <section className="planner-outlook" aria-label="Goal outlook">
      <div className="planner-outlook-head"><div><span className="m3-page-kicker">Goal outlook</span><h2>{selected.name}</h2></div>
        {goals.length > 1 && <label className="m3-field"><span>View goal</span><select value={selected.id} onChange={e => setSelectedId(e.target.value)}>{goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}</div>
      <div className="planner-outlook-body"><div>
        <p>{overdue ? 'Recorded towards this goal' : 'Estimated by ' + displayMonth(selected.targetMonth)}</p>
        <strong className="forecast-total">{overdue ? money(progress.saved) : estimateMoney(forecast.balancePaise)}</strong>
        <p>Target {money(selected.targetPaise)} · {displayMonth(selected.targetMonth)}</p>
        <progress max={selected.targetPaise} value={Math.min(progress.saved, selected.targetPaise)} aria-label={'Recorded savings for ' + selected.name} />
        <small>{money(progress.saved)} recorded so far</small>
      </div><dl className="forecast-breakdown"><div><dt>Linked savings</dt><dd>{money(progress.saved)}</dd></div>
        {Boolean(forecast.pastPrincipalPaise) && <div><dt>Earlier instalments included</dt><dd>{estimateMoney(forecast.pastPrincipalPaise)}</dd></div>}
        <div><dt>Future deposits</dt><dd>{estimateMoney(forecast.principalPaise)}</dd></div><div><dt>Estimated interest or growth</dt><dd>{estimateMoney(forecast.interestPaise)}</dd></div>
      </dl></div>
      <p className="forecast-verdict">{overdue ? 'The target month has passed. Review your recorded balance or move the date.' :
        forecast.shortfallPaise === null || forecast.balancePaise === null ? 'This amount exceeds the supported estimate range. Review the rate and term.' :
        forecast.shortfallPaise === 0 ? (forecast.balancePaise === selected.targetPaise ? 'On track to meet this goal.' : 'On track to pass the target by ' + money(forecast.balancePaise - selected.targetPaise) + '.') :
        'Estimated gap of ' + money(forecast.shortfallPaise) + '. An extra ' + estimateMoney(forecast.extraMonthlyPaise) + ' per month would cover it.'}</p>
      {progress.missing.length > 0 && <p>A linked holding was removed. Edit the goal to update its savings.</p>}
      <Checkpoints goal={selected} month={month} holdings={holdings} plan={plan} />
    </section> : editable && <section className="m3-panel"><h2>What are you saving for?</h2><p>Add a target amount and a month. A deposit can also have its own maturity date.</p></section>}
    {editable && <div className="planner-panels">
      <section className="m3-panel planner-list" aria-label="Your goals"><div className="planner-section-heading"><h2>Your goals</h2></div>
        {!goals.length && <p>Start with one goal, like school fees or a family emergency fund.</p>}
        {goals.map(g => { const f = goalForecast(g, holdings, plan.schedules, month);
          return <button className="planner-record" type="button" key={g.id} aria-label={'Edit ' + g.name} onClick={() => edit({kind:'goals',item:g})}>
            <strong>{g.name}</strong><span>{money(f.saved)} saved of {money(g.targetPaise)}</span><small>{g.targetMonth < month ? 'Target date passed' : 'Estimated ' + estimateMoney(f.forecast.balancePaise)} · {displayMonth(g.targetMonth)}</small><ChevronRight size={16}/></button>; })}
      </section>
      <section className="m3-panel planner-list" aria-label="Recurring contributions"><div className="planner-section-heading"><h2>Recurring contributions</h2></div>
        {!plan.schedules.length && <p>Add a monthly deposit or SIP to see what it could contribute.</p>}
        {plan.schedules.map(s => { const estimate = scheduleEstimate(s, goals, month).maturity;
          const linked = goals.find(g => g.id === s.goalId);
          return <button className="planner-record" type="button" key={s.id} aria-label={'Edit ' + s.name} onClick={() => edit({kind:'schedules',item:s})}>
            <strong>{s.name}</strong><span>{money(s.monthlyPaise)} / month{linked && ' · ' + linked.name}</span>
            <small>{estimate ? estimateMoney(estimate.valuePaise) + ' estimated by ' + displayMonth(estimate.throughMonth) : 'Choose an end month or link a goal for an estimate'}</small><ChevronRight size={16}/></button>; })}
        <Button variant="ghost" onClick={() => edit({kind:'schedules',type:'MF_SIP',goalId:selected?.id})}><Plus size={16}/> Add SIP</Button>
      </section></div>}
    {editable && <details className="forecast-method"><summary>How these estimates work</summary><p>Deposits start at the beginning of each month, including this month unless you mark it as already recorded. RD interest compounds quarterly. Other investments use the annual return you enter. A blank rate counts deposits alone.</p>
      <p>Linked holding balances stay at their recorded value. Earlier instalments count towards a goal only when you select that option on the deposit. At maturity the estimate stops growing. A balance shown before maturity may be subject to your bank’s withdrawal terms. Estimates exclude tax and bank-specific rounding.</p></details>}
  </>;
}
