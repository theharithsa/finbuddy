import { ChevronRight, Landmark, Plus } from '@/components/brand/Icons';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/types';
import { money, type Holding } from '@/lib/household';
import type { Editor } from './HouseholdEditor';

export function SavingsPage({ holdings, onEdit }: { holdings: Holding[]; onEdit: (editor: Editor) => void }) {
  const total = holdings.reduce((sum, holding) => sum + holding.amountPaise, 0);
  return (
    <>
      <header className="m3-page-heading">
        <div><h1>Savings &amp; investments</h1><p>See the money you’ve set aside for later.</p></div>
        <Button onClick={() => onEdit({ kind: 'holdings' })}><Plus size={18} /> Add savings or investment</Button>
      </header>

      <section className="m3-ledger-summary" aria-label="Recorded savings and investment value">
        <span className="m3-summary-icon"><Landmark size={24} /></span>
        <div><span>Total recorded value</span><strong>{money(total)}</strong></div>
        <span className="m3-summary-count">{holdings.length} {holdings.length === 1 ? 'entry' : 'entries'}</span>
      </section>

      <section className="m3-panel money-panel">
        <header className="money-panel-heading">
          <div><h2>What you’ve set aside</h2><p>Tap an entry to update its value. Each date shows when that value was recorded.</p></div>
        </header>
        {holdings.length ? (
          <ul className="money-record-list">
            {[...holdings].sort((a, b) => a.name.localeCompare(b.name)).map((entry) => <li key={entry.id}>
              <button type="button" aria-label={`Update value: ${entry.name}`} onClick={() => onEdit({ kind: 'holdings', entry })}>
                <span><strong>{entry.name}</strong><small>{entry.kind} · As of {formatDate(entry.asOf)}</small></span>
                <strong>{money(entry.amountPaise)}</strong><ChevronRight size={18} />
              </button>
            </li>)}
          </ul>
        ) : <p className="money-quiet">Add any savings or investment with a name and the latest value you know.</p>}
      </section>
    </>
  );
}
