import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/household';
import type { Adoption, Preview } from '../../../api/shared/planning';

export function AdoptionReview({ preview, busy, choose, confirm }: { preview: Preview; busy: boolean; choose: (source: string) => void; confirm: (input: Adoption) => void }) {
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  return <section className="m3-panel planner-review">
    <h2>Bring your FinVision plan here</h2><p>Review one plan. After you move it, edit its goals and SIPs here. Your individual FinVision projections will use these updates.</p>
    <label className="m3-field"><span>Plan to move</span><select disabled={busy} value={preview.source} onChange={e => choose(e.target.value)}>{preview.choices.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}</select></label>
    <h3>{preview.plan.goals.length} goals · {preview.plan.schedules.length} recurring investments</h3>
    <ul>{preview.plan.goals.map(g => <li key={g.id}><strong>{g.name}</strong> · {money(g.targetPaise)} by {g.targetMonth}
      {g.original && <small> From ₹{g.original.todayValue.toLocaleString('en-IN')} in {g.original.referenceYear}, at {Number((g.original.inflationRate * 100).toFixed(3))}% annual inflation. A year-only goal uses December.</small>}</li>)}
      {preview.plan.schedules.map(s => <li key={s.id}>{s.name} · {money(s.monthlyPaise)} planned monthly from {s.startMonth}{s.assetKey ? ' · Asset category ' + s.assetKey : ''}</li>)}</ul>
    {preview.problems.map(p => <p role="alert" key={p}>{p}</p>)}
    {preview.dangling.map(row => <label className="m3-field" key={row.scheduleId}><span>Choose a link for {row.name}</span>
      <select value={resolutions[row.scheduleId] ?? ''} onChange={e => setResolutions({...resolutions,[row.scheduleId]:e.target.value})}>
        <option value="">Choose</option><option value="-">Keep unlinked</option>{preview.plan.goals.map(g => <option key={g.id} value={'g:' + g.id}>{g.name}</option>)}</select></label>)}
    <Button disabled={busy || preview.problems.length > 0 || preview.dangling.some(s => !resolutions[s.scheduleId])} onClick={() => confirm({ source: preview.source, fingerprint: preview.fingerprint,
      links: preview.dangling.map(s => ({ scheduleId: s.scheduleId, goalId: resolutions[s.scheduleId] === '-' ? null : resolutions[s.scheduleId].slice(2) })) })}>Move this plan to FinBuddy</Button>
  </section>;
}
