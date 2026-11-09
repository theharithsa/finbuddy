import { Landmark, Plus } from '@/components/brand/Icons';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/types';
import { money, type Holding } from '@/lib/household';
import type { Editor } from './HouseholdEditor';
import { MoneyRecordRow } from './MoneyRecordRow';

export function SavingsPage({ holdings, onEdit }: { holdings: Holding[]; onEdit?: (editor: Editor) => void }) {
  const total = holdings.reduce((sum, holding) => sum + holding.amountPaise, 0);
  return (
    <>
      <header className="m3-page-heading">
        <div><span className="m3-page-kicker">Set aside</span><h1>Savings &amp; investments</h1><p>Keep the latest values for the money you’ve put aside.</p></div>
        {onEdit && <Button onClick={() => onEdit({ kind: 'holdings' })}><Plus size={18} /> Add savings or investment</Button>}
      </header>

      <section className="m3-ledger-summary" aria-label="Recorded savings and investment value">
        <span className="m3-summary-icon"><Landmark size={24} /></span>
        <div><span>Total recorded value</span><strong>{money(total)}</strong></div>
        <span className="m3-summary-count">{holdings.length} {holdings.length === 1 ? 'entry' : 'entries'}</span>
      </section>

      <section className="money-page-list">
        <header className="money-panel-heading">
          <div><h2>What you’ve set aside</h2><p>Each date shows when that value was recorded.{onEdit && ' Tap an entry to update it.'}</p></div>
        </header>
        {holdings.length ? (
          <ul className="money-record-list">
            {[...holdings].sort((a, b) => a.name.localeCompare(b.name)).map((entry) => <li key={entry.id}>
              <MoneyRecordRow title={entry.name} description={entry.kind + ' · As of ' + formatDate(entry.asOf)} amount={money(entry.amountPaise)}
                editLabel={`Update value: ${entry.name}`} onEdit={onEdit ? () => onEdit({ kind: 'holdings', entry }) : undefined} />
            </li>)}
          </ul>
        ) : <p className="money-quiet">Pick one balance you already know. A name and its latest value are enough to get started.</p>}
      </section>
    </>
  );
}
