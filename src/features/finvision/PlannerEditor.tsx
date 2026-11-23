import { instruments } from './instruments';
import { ScheduleFields } from './ScheduleFields';
import { useState } from 'react';
import { RecordDialog, EntryError } from '@/features/household/RecordDialog';
import { money, parsePaise, type Holding } from '@/lib/household';
import { goalInput, scheduleInput, type Goal, type Plan, type Schedule } from '../../../api/shared/planning';

export type Edit = { kind: 'goals'; item?: Goal } | { kind: 'schedules'; item?: Schedule; type?: string; goalId?: string };
export type Change = (kind: Edit['kind'], method: 'POST' | 'PATCH' | 'DELETE', id: string, body?: object) => Promise<void>;

function HoldingShare({ holding, current, available }: { holding: Holding; current?: number; available: number }) {
  const [linked, setLinked] = useState(current !== undefined);
  return <div className="planner-share">
    <label><input type="checkbox" name="holding" value={holding.id} checked={linked} disabled={!linked && available === 0} onChange={e => setLinked(e.target.checked)} /> {holding.name} · {money(holding.amountPaise)}</label>
    <small>Value recorded {holding.asOf} · {available / 100}% available for this goal</small>
    {linked && <label className="m3-field"><span>Share of {holding.name} (%)</span><input type="number" name={'share:' + holding.id} min="0.01" max={available / 100} step="0.01" defaultValue={(current ?? available) / 100} required /></label>}
  </div>;
}

export function PlannerEditor({ edit, plan, holdings, month, change, close }: { edit: Edit; plan: Plan; holdings: Holding[]; month: string; change: Change; close: () => void }) {
  const [id] = useState(() => edit.item?.id ?? crypto.randomUUID());
  const g = edit.kind === 'goals' ? edit.item : undefined;
  const s = edit.kind === 'schedules' ? edit.item : undefined;
  const defaultType = edit.kind === 'schedules' ? s?.type ?? edit.type ?? 'MF_SIP' : '';
  const [chosenType,setChosenType] = useState(defaultType);
  const label = edit.kind === 'goals' ? 'goal' : chosenType === 'RD' ? 'recurring deposit' : 'investment';
  async function save(form: FormData) {
    const name = String(form.get('name') ?? '').trim() || (edit.kind === 'schedules' ? instruments.find(i => i.key === form.get('type'))?.label ?? 'Monthly investment' : '');
    const amount = parsePaise(form.get('amount'));
    if (!name || !amount) throw new EntryError('Enter a name and a positive rupee amount with up to two decimal places.');
    let input: object;
    if (edit.kind === 'goals') {
      const allocations = form.getAll('holding').map(value => ({ holdingId: String(value), basisPoints: Math.round(Number(form.get('share:' + value)) * 100) }));
      const result = goalInput.safeParse({ name, targetPaise: amount, targetMonth: form.get('month'), allocations });
      if (!result.success) throw new EntryError('Choose a target month and a share between 0.01% and 100% for each linked holding.');
      input = result.data;
    } else {
      const selected = String(form.get('link') ?? '');
      if (form.get('until') !== 'goal' && !form.get('end')) throw new EntryError('Enter the last deposit month or a whole number of months.');
      if (form.get('until') === 'goal' && form.get('type') === 'RD' && !selected.startsWith('goal:') && !edit.item) throw new EntryError('Choose a goal or enter a deposit term to see its maturity.');
      const result = scheduleInput.safeParse({ name, monthlyPaise: amount, startMonth: form.get('start'), endMonth: form.get('end') || null,
        includePastInstalments: form.get('includePast') === 'on', balanceThroughMonth: form.get('paidCurrent') === 'on' ? month : null,
        type: form.get('type'), annualRate: Number(form.get('rate') ?? 0) / 100,
        goalId: selected.startsWith('goal:') ? selected.slice(5) : null, assetKey: selected.startsWith('asset:') ? selected.slice(6) : null });
      if (!result.success || (result.data.endMonth && result.data.endMonth < result.data.startMonth)) throw new EntryError('Check the investment type, rate and start and end months.');
      input = result.data;
    }
    await change(edit.kind, edit.item ? 'PATCH' : 'POST', id, input);
  }
  return <RecordDialog title={(edit.item ? 'Edit ' : 'Add ') + label} description={edit.kind === 'goals' ? 'Use the amount you expect to need by the target month.' : 'Enter the amount you set aside each month to see what it could grow to.'} submitLabel={'Save ' + label}
    onSave={save} onClose={close} onRemove={edit.item ? () => change(edit.kind, 'DELETE', id) : undefined} removeDescription={'Remove this ' + label + ' from your plan?'}>
    {edit.kind === 'goals' ? <>
      <label className="m3-field"><span>Goal name</span><input name="name" maxLength={160} defaultValue={g?.name} required /></label>
      <label className="m3-field"><span>Target amount (₹)</span><input type="text" inputMode="decimal" name="amount" defaultValue={g ? g.targetPaise / 100 : ''} required /></label>
      <label className="m3-field"><span>Target month</span><input name="month" type="month" defaultValue={g?.targetMonth} required /></label>
      <details className="money-details" open={g?.allocations.length ? true : undefined}><summary>Link savings <small>Optional</small></summary>
        {holdings.length === 0 && <p>Add a balance in Savings when you’re ready.</p>}
        {g?.allocations.some(a => !holdings.some(h => h.id === a.holdingId)) && <p role="status">A linked holding was removed. Saving here removes its old link.</p>}
        {holdings.map(h => <HoldingShare key={h.id} holding={h} current={g?.allocations.find(a => a.holdingId === h.id)?.basisPoints}
          available={10000 - plan.goals.filter(other => other.id !== g?.id).flatMap(other => other.allocations).filter(a => a.holdingId === h.id).reduce((sum, a) => sum + a.basisPoints, 0)} />)}
      </details>
    </> : <ScheduleFields item={s} type={defaultType} goals={plan.goals} schedules={plan.schedules} holdings={holdings} onTypeChange={setChosenType} goalId={edit.goalId} month={month} />}
  </RecordDialog>;
}
