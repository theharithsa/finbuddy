import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Plus, Target } from '@/components/brand/Icons';
import { money, type Holding } from '@/lib/household';
import { EntryError } from '@/features/household/RecordDialog';
import { emptyPlan, goal, goalProgress, planProblem, planSchema, previewSchema, schedule, stateSchema, type Adoption, type Plan, type PlannerState, type Preview } from '../../../api/shared/planning';
import { AdoptionReview } from './AdoptionReview';
import { PlannerEditor, type Change, type Edit } from './PlannerEditor';
import './planner.css';

const problem = z.object({ error: z.object({ message: z.string() }) });
async function request(user: User, path: string, method = 'GET', body?: object, revision?: number, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch('/api/v1/finvision' + path, { method, signal, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: 'Bearer ' + await user.getIdToken(), ...(body && { 'Content-Type': 'application/json' }), ...(revision && { 'If-Match': String(revision) }) },
    ...(body && { body: JSON.stringify(body) }) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new EntryError('The planner is unavailable. Try again.');
  const value: unknown = await response.json();
  if (!response.ok) throw new EntryError(problem.safeParse(value).data?.error.message ?? 'The planner could not complete this request.');
  return value;
}
const explain = (error: unknown) => error instanceof EntryError ? error.message : 'Couldn’t load your plan. Check your connection and try again.';
interface Props { user?: User; demo?: Plan; onDemoChange?: (plan: Plan) => void; holdings: Holding[]; month: string; left: number | null; onIncome?: () => void }
export default function PlannerPage({ user, demo, onDemoChange, holdings, month, left, onIncome }: Props) {
  const [data, setData] = useState<PlannerState>();
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [edit, setEdit] = useState<Edit | null>(null);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    async function load(account: User) {
      const state = stateSchema.parse(await request(account, '', 'GET', undefined, undefined, controller.signal));
      const transfer = state.available && !state.adopted ? previewSchema.parse(await request(account, '/adoption', 'GET', undefined, undefined, controller.signal)) : undefined;
      if (!controller.signal.aborted) { setData(state); setPreview(transfer); setError(''); }
    }
    void load(user).catch(e => { if (!controller.signal.aborted) setError(explain(e)); });
    return () => controller.abort();
  }, [user, reload]);
  const plan = demo ?? data?.plan ?? emptyPlan();
  const ready = Boolean(demo || data?.adopted);
  async function choose(source: string) {
    if (!user || busy) return;
    setBusy(true); setError('');
    try { setPreview(previewSchema.parse(await request(user, '/adoption?source=' + encodeURIComponent(source)))); }
    catch (e) { setError(explain(e)); } finally { setBusy(false); }
  }
  async function transfer(input: Adoption): Promise<Plan> {
    if (!user) throw new EntryError('Sign in to move a plan.');
    const next = planSchema.parse(await request(user, '/adoption', 'POST', input));
    setData({ adopted: true, available: true, plan: next }); setPreview(undefined);
    return next;
  }
  async function confirm(input: Adoption) {
    if (busy) return;
    setBusy(true); setError('');
    try { await transfer(input); } catch (e) { setError(explain(e)); } finally { setBusy(false); }
  }
  const change: Change = async (kind, method, id, body) => {
    if (demo && onDemoChange) {
      const next = structuredClone(demo);
      if (kind === 'goals') {
        if (method === 'DELETE' && next.schedules.some(s => s.goalId === id)) throw new EntryError('Unlink this goal from its SIPs before removing it.');
        const old = next.goals.find(g => g.id === id);
        next.goals = next.goals.filter(g => g.id !== id);
        if (method !== 'DELETE') next.goals.push(goal.parse({ ...old, ...body, id }));
      } else {
        const old = next.schedules.find(s => s.id === id);
        next.schedules = next.schedules.filter(s => s.id !== id);
        if (method !== 'DELETE') next.schedules.push(schedule.parse({ ...old, ...body, id }));
      }
      const failure = planProblem(next);
      if (failure) throw new EntryError(failure);
      onDemoChange({ ...next, revision: next.revision + 1 }); return;
    }
    if (!user) throw new EntryError('Sign in to save.');
    let current = plan;
    if (!ready && preview?.source === 'empty') current = await transfer({ source: 'empty', fingerprint: preview.fingerprint, links: [] });
    const creating = method === 'POST';
    const next = planSchema.parse(await request(user, '/' + kind + (creating ? '' : '/' + encodeURIComponent(id)), method, creating ? { ...body, id } : body, current.revision));
    setData({ adopted: true, available: true, plan: next });
  };
  const ordered = [...plan.goals].sort((a,b) => a.targetMonth.localeCompare(b.targetMonth) || a.name.localeCompare(b.name));
  const nextGoal = ordered.find(g => goalProgress(g, holdings, month).gap > 0);
  const progress = nextGoal && goalProgress(nextGoal, holdings, month);
  return <div className="finvision-page">
    <header className="m3-page-heading"><div><span className="m3-page-kicker"><Target size={17}/> FinVision</span><h1>Goals &amp; savings</h1><p>Give the money you set aside a date and a purpose.</p></div>
      {ready && <Button onClick={() => setEdit({ kind: 'goals' })}><Plus size={17}/> Add goal</Button>}</header>
    {error && <p role="alert">{error} <Button variant="ghost" onClick={() => setReload(n => n + 1)}>Refresh plan</Button></p>}
    {!demo && !data && !error && <p role="status">Opening your plan…</p>}
    {data && !data.available && <section className="m3-panel"><h2>The goals pilot is full or paused</h2><p>Try the sample plan or continue using your existing FinVision workspace.</p><a href="/finvision?demo=1">Try the sample plan</a> · <a href="https://finvision-ai.web.app/">Open FinVision</a></section>}
    {!ready && preview && preview.source !== 'empty' && <AdoptionReview key={preview.fingerprint} preview={preview} busy={busy} choose={s => void choose(s)} confirm={input => void confirm(input)} />}
    {(ready || preview?.source === 'empty') && <>
      {nextGoal && progress ? <section className="money-hero planner-hero" aria-label="Next goal"><div className="money-hero-balance"><span className="money-hero-label">Next goal · {nextGoal.targetMonth}</span><h2>{nextGoal.name}</h2><strong className="money-hero-amount">{money(progress.gap)}</strong><p>still to set aside</p></div>
        <dl><div><dt>Already saved</dt><dd>{money(progress.saved)}</dd></div><div><dt>Needed each month</dt><dd>{progress.monthly === null ? 'Past target date' : money(progress.monthly)}</dd></div>
        <div><dt>Left after bills this month</dt><dd>{left === null ? 'Income needed' : money(left)}</dd></div></dl>
        <p>{left === null ? 'Add income received to compare your monthly goal with cash available.' : progress.monthly === null ? 'Review the date or adjust the amount you plan to save.' : left >= progress.monthly ? 'Your recorded cash left after bills covers this monthly amount.' : 'Your recorded cash left after bills is short by ' + money(progress.monthly - left) + ' this month.'}
        {left === null && onIncome && <Button variant="ghost" onClick={onIncome}>Add income</Button>}</p></section>
        : <section className="m3-panel"><h2>{ordered.length ? 'Your goals are funded' : 'What would you like to save for?'}</h2><p>{ready ? 'Start with a name, an amount and a month.' : 'Saving your first goal joins the personal planning pilot.'}</p><Button onClick={() => setEdit({kind:'goals'})}>Plan a goal</Button></section>}
      {ready && <><section className="m3-panel planner-list"><h2>Your goals</h2>{ordered.map(g => {
        const p = goalProgress(g, holdings, month);
        return <button key={g.id} type="button" onClick={() => setEdit({kind:'goals', item:g})}><strong>{g.name}</strong><span>{money(p.saved)} of {money(g.targetPaise)} · {g.targetMonth}</span>{p.missing.length > 0 && <small>A holding was removed. Review its link.</small>}</button>;
      })}</section><section className="m3-panel planner-list"><h2>Recurring investments</h2><p>These are monthly instructions. Progress comes from your recorded holding balances.</p>
        {plan.schedules.map(s => <button key={s.id} type="button" onClick={() => setEdit({kind:'schedules', item:s})}><strong>{s.name}</strong><span>{money(s.monthlyPaise)} / month · {s.goalId ? plan.goals.find(g => g.id === s.goalId)?.name : s.assetKey || 'Unlinked'} · from {s.startMonth}{s.endMonth && ' to ' + s.endMonth}</span></button>)}
        <Button variant="secondary" onClick={() => setEdit({kind:'schedules'})}><Plus size={16}/> Add SIP</Button></section></>}
    </>}
    {edit && <PlannerEditor edit={edit} plan={plan} holdings={holdings} month={month} change={change} close={() => {setEdit(null); if (user) setReload(n=>n+1);}} />}
  </div>;
}
