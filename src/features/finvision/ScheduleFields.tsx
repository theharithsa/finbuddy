import { useState } from 'react';
import { parsePaise, type Holding } from '@/lib/household';
import { planningMonth, type Goal, type Schedule } from '../../../api/shared/planning';
import { depositForecast, goalForecast, monthAt, monthIndex } from '../../../api/shared/planning-forecast';
import { displayMonth, estimateMoney } from './forecast-format';
import { assetCategories, instruments } from './instruments';

interface Props { item?: Schedule; schedules?: Schedule[]; holdings?: Holding[]; type: string; goals: Goal[]; goalId?: string; month: string; calculator?: boolean; onTypeChange?: (type: string) => void }

export function ScheduleFields({ item, schedules = [], holdings = [], type: initialType, goals, goalId, month, calculator, onTypeChange }: Props) {
  const [type, setType] = useState(item?.type ?? initialType);
  const [amount, setAmount] = useState(item ? String(item.monthlyPaise / 100) : '');
  const [rate, setRate] = useState(item?.annualRate ? String(Number((item.annualRate * 100).toPrecision(12))) : '');
  const [start, setStart] = useState(item?.startMonth ?? month);
  const [end, setEnd] = useState(item?.endMonth ?? '');
  const [months, setMonths] = useState('');
  const [link, setLink] = useState(item ? (item.goalId ? 'goal:' + item.goalId : item.assetKey ? 'asset:' + item.assetKey : '') : goalId ? 'goal:' + goalId : '');
  const [until, setUntil] = useState(item?.endMonth ? 'date' : !item && !goalId && initialType === 'RD' ? 'term' : 'goal');
  const [includePast, setIncludePast] = useState(item?.includePastInstalments ?? false);
  const [paidCurrent, setPaidCurrent] = useState(Boolean(item?.balanceThroughMonth && item.balanceThroughMonth >= month));
  const target = goals.find(g => 'goal:' + g.id === link);
  const term = Number(months);
  const lastIndex = monthIndex(start) + term - 1;
  const last = until === 'date' ? end : until === 'term' && Number.isInteger(term) && term > 0 && lastIndex <= monthIndex('9999-12') && planningMonth.safeParse(start).success ? monthAt(lastIndex) : '';
  const through = last || (until === 'goal' && target?.targetMonth);
  const monthlyPaise = parsePaise(amount);
  const terms = { type, monthlyPaise: monthlyPaise ?? 0, annualRate: Number(rate) / 100, startMonth: start, endMonth: last || null };
  const valid = Boolean(monthlyPaise && planningMonth.safeParse(start).success && terms.annualRate >= 0 && terms.annualRate <= 2 && (!last || last >= start));
  const estimate = valid && through ? depositForecast(terms, start, through) : null;
  const otherDate = valid && last && target && target.targetMonth !== last ? depositForecast(terms, start, target.targetMonth) : null;
  const includeEarlier = start < month && includePast;
  const hypothetical: Schedule = { ...terms, id: item?.id ?? '', name: '', goalId: target?.id ?? null, assetKey: null,
    includePastInstalments: includeEarlier, balanceThroughMonth: !includeEarlier && paidCurrent && start <= month ? month : null };
  const goalBalance = estimate && target && target.targetMonth >= month ?
    goalForecast(target, holdings, [...schedules.filter(s => s.id !== item?.id), hypothetical], month).forecast : null;
  return <>
    {!calculator && <label className="m3-field"><span>Investment type</span><select name="type" value={type} onChange={e => { setType(e.target.value); onTypeChange?.(e.target.value); }}>{item && !instruments.some(i => i.key === item.type) && <option value={item.type}>{item.original?.instrumentLabel || item.type}</option>}{instruments.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}</select></label>}
    <label className="m3-field"><span>Monthly deposit (₹)</span><input inputMode="decimal" type="text" name="amount" value={amount} onChange={e => setAmount(e.target.value)} required /></label>
    <label className="m3-field"><span>{type === 'RD' ? 'Annual interest rate (%)' : 'Expected annual return (%)'}</span><input type="number" name="rate" step="any" min="0" max="200" value={rate} onChange={e => setRate(e.target.value)}/><small>Leave blank to count deposits alone.</small></label>
    {!calculator && <label className="m3-field"><span>For which goal?</span><select name="link" value={link} onChange={e => setLink(e.target.value)}><option value="">Keep unlinked</option>
      {goals.map(g => <option key={g.id} value={'goal:' + g.id}>{g.name}</option>)}
      {item?.assetKey && !assetCategories.some(a => a.key === item.assetKey) && <option value={'asset:' + item.assetKey}>{item.assetKey}</option>}
      <optgroup label="Asset categories">{assetCategories.map(a => <option key={a.key} value={'asset:' + a.key}>{a.label}</option>)}</optgroup></select></label>}
    <div className="forecast-dates"><label className="m3-field"><span>First deposit month</span><input type="month" name="start" value={start} onChange={e => setStart(e.target.value)} required /></label>
      <label className="m3-field"><span>Deposit term</span><select name="until" value={until} onChange={e => setUntil(e.target.value)}>{!calculator && <option value="goal">{target ? 'Until goal date' : 'Ongoing'}</option>}<option value="term">Number of months</option><option value="date">Choose end month</option></select></label></div>
    {until === 'date' && <label className="m3-field"><span>Last deposit month</span><input type="month" value={end} min={start} onChange={e => setEnd(e.target.value)} required /></label>}
    {until === 'term' && <label className="m3-field"><span>Number of monthly deposits</span><input type="number" inputMode="numeric" min="1" step="1" value={months} onChange={e => setMonths(e.target.value)} required /></label>}
    <input type="hidden" name="end" value={last}/>
    <div className="forecast-preview" role="status" aria-label="Deposit estimate" aria-live="polite">
      {estimate ? <><span>Estimated {last ? 'maturity' : 'value at goal'} · {displayMonth(estimate.throughMonth)}</span><strong>{estimateMoney(estimate.valuePaise)}</strong>
        <small>{estimate.instalments} {estimate.instalments === 1 ? 'instalment' : 'instalments'} · {estimateMoney(estimate.principalPaise)} deposited · {estimateMoney(estimate.interestPaise)} estimated {type === 'RD' ? 'interest' : 'growth'}</small>
        {otherDate && target && <small>Deposit value at the goal date · {estimateMoney(otherDate.valuePaise)}</small>}
        {goalBalance && target && <small>With this deposit, {target.name} is projected to reach <b>{estimateMoney(goalBalance.balancePaise)}</b> by {displayMonth(target.targetMonth)}.</small>}</> :
        <small>{!monthlyPaise ? 'Enter the monthly amount to see your estimate.' : 'Choose a goal date or a valid deposit term to see your estimate.'}</small>}
    </div>
    {!calculator && <label className="m3-field"><span>Deposit name (optional)</span><input name="name" maxLength={160} defaultValue={item?.name} placeholder={instruments.find(i => i.key === type)?.label ?? 'Monthly investment'}/></label>}
    {!calculator && start <= month && <details className="money-details" open={item?.includePastInstalments || Boolean(item?.balanceThroughMonth && item.balanceThroughMonth >= month) || undefined}>
      <summary>Instalments already paid</summary>
      {start < month && <label className="planner-choice"><input type="checkbox" name="includePast" checked={includePast} onChange={e => setIncludePast(e.target.checked)}/> Count earlier instalments towards my goal. I paid them and have excluded them from my linked savings.</label>}
      {!(start < month && includePast) && <label className="planner-choice"><input type="checkbox" name="paidCurrent" checked={paidCurrent} onChange={e => setPaidCurrent(e.target.checked)}/> This month’s deposit is already in my linked savings.</label>}
    </details>}
  </>;
}
