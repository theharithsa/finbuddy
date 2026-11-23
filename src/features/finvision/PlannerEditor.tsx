import { assetCategories, instruments } from './instruments';
import { useState } from 'react';
import { RecordDialog, EntryError } from '@/features/household/RecordDialog';
import { money, parsePaise, type Holding } from '@/lib/household';
import { goalInput, scheduleInput, type Goal, type Plan, type Schedule } from '../../../api/shared/planning';

export type Edit = { kind: 'goals'; item?: Goal } | { kind: 'schedules'; item?: Schedule };
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
  const label = edit.kind === 'goals' ? 'goal' : 'SIP';
  async function save(form: FormData) {
    const name = String(form.get('name') ?? '').trim();
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
      const result = scheduleInput.safeParse({ name, monthlyPaise: amount, startMonth: form.get('start'), endMonth: form.get('end') || null,
        type: form.get('type'), annualRate: Number(form.get('rate') ?? 0) / 100,
        goalId: selected.startsWith('goal:') ? selected.slice(5) : null, assetKey: selected.startsWith('asset:') ? selected.slice(6) : null });
      if (!result.success || (result.data.endMonth && result.data.endMonth < result.data.startMonth)) throw new EntryError('Check the investment type, rate and start and end months.');
      input = result.data;
    }
    await change(edit.kind, edit.item ? 'PATCH' : 'POST', id, input);
  }
  return <RecordDialog title={(edit.item ? 'Edit ' : 'Add ') + label} description={edit.kind === 'goals' ? 'Use the amount you expect to need by the target month.' : 'A monthly instruction. Your recorded savings change when you update a holding.'} submitLabel={'Save ' + label}
    onSave={save} onClose={close} onRemove={edit.item ? () => change(edit.kind, 'DELETE', id) : undefined} removeDescription={'Remove this ' + label + ' from your plan?'}>
    <label className="m3-field"><span>{edit.kind === 'goals' ? 'Goal name' : 'Investment name'}</span><input name="name" maxLength={160} defaultValue={edit.item?.name} required /></label>
    <label className="m3-field"><span>{edit.kind === 'goals' ? 'Target amount (₹)' : 'Planned each month (₹)'}</span><input type="text" inputMode="decimal" name="amount" defaultValue={g ? g.targetPaise / 100 : s ? s.monthlyPaise / 100 : ''} required /></label>
    {edit.kind === 'goals' ? <>
      <label className="m3-field"><span>Target month</span><input name="month" type="month" defaultValue={g?.targetMonth} required /></label>
      <details className="money-details" open={g?.allocations.length ? true : undefined}><summary>Link savings <small>Optional</small></summary>
        {holdings.length === 0 && <p>Add a balance in Savings when you’re ready.</p>}
        {g?.allocations.some(a => !holdings.some(h => h.id === a.holdingId)) && <p role="status">A linked holding was removed. Saving here removes its old link.</p>}
        {holdings.map(h => <HoldingShare key={h.id} holding={h} current={g?.allocations.find(a => a.holdingId === h.id)?.basisPoints}
          available={10000 - plan.goals.filter(other => other.id !== g?.id).flatMap(other => other.allocations).filter(a => a.holdingId === h.id).reduce((sum, a) => sum + a.basisPoints, 0)} />)}
      </details>
    </> : <>
      <label className="m3-field"><span>For which goal?</span><select name="link" defaultValue={s?.goalId ? 'goal:' + s.goalId : s?.assetKey ? 'asset:' + s.assetKey : ''}><option value="">Keep unlinked</option>
        {s?.assetKey && !assetCategories.some(a => a.key === s.assetKey) && <option value={'asset:'+s.assetKey}>{s.assetKey}</option>}
        <optgroup label="FinVision asset categories">{assetCategories.map(a => <option key={a.key} value={'asset:'+a.key}>{a.label}</option>)}</optgroup>
        {plan.goals.map(item => <option key={item.id} value={'goal:' + item.id}>{item.name}</option>)}</select></label>
      <details className="money-details"><summary>Schedule and projection assumptions</summary>
        <label className="m3-field"><span>Starts</span><input type="month" name="start" defaultValue={s?.startMonth ?? month} required /></label>
        <label className="m3-field"><span>Ends (optional)</span><input type="month" name="end" defaultValue={s?.endMonth ?? ''} /></label>
        <label className="m3-field"><span>Investment type</span><select name="type" defaultValue={s?.type ?? 'MF_SIP'}>{s && !instruments.some(i => i.key === s.type) && <option value={s.type}>{s.original?.instrumentLabel || s.type}</option>}{instruments.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}</select></label>
        <label className="m3-field"><span>Annual projection return (%)</span><input type="number" name="rate" step="any" min="0" max="200" defaultValue={(s?.annualRate ?? 0) * 100} /></label>
      </details>
    </>}
  </RecordDialog>;
}
