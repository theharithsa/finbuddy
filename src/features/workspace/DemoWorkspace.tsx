import { useRef, useState } from 'react';
import { BillsPage } from '@/features/household/BillsPage';
import { MoneyHome } from '@/features/household/MoneyHome';
import { SavingsPage } from '@/features/household/SavingsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { localDate, monthRange, periodExpenses, shiftMonth, totalAmount } from '@/lib/finance-period';
import { billPaymentKey, listBillOccurrences, type Household } from '@/lib/household';
import { getAllCategories, type Budget, type Expense } from '@/lib/types';
import { ComingSoonPage } from './ComingSoonPage';
import { Ledger } from './Ledger';
import { Overview } from './Overview';
import { WorkspaceShell, type WorkspacePage } from './WorkspaceShell';

const categories = getAllCategories();

function sampleHousehold(today: string): { household: Household; expenses: Expense[]; budgets: Budget[] } {
  const month = today.slice(0, 7);
  const previous = shiftMonth(month, -1);
  const day = Number(today.slice(-2));
  const recordedOn = (sampleDay: number) => month + '-' + String(Math.min(day, sampleDay)).padStart(2, '0');
  const dueOn = (sampleDay: number) => month + '-' + String(Math.min(Number(monthRange(month).to.slice(-2)), Math.max(day, sampleDay))).padStart(2, '0');
  const broadbandDue = recordedOn(5);
  const broadbandKey = billPaymentKey('broadband', broadbandDue);
  const expense = (id: string, description: string, category: string, amount: number, date: string): Expense =>
    ({ id, description, category, amount, date, createdAt: date + 'T12:00:00' });

  return {
    household: {
      income: [
        { id: 'salary', name: 'Salary', amountPaise: 8_400_000, date: recordedOn(1) },
        { id: 'previous-salary', name: 'Salary', amountPaise: 8_200_000, date: previous + '-01' },
      ],
      bills: [
        { id: 'broadband', name: 'Broadband', amountPaise: 75_000, dueDate: broadbandDue, repeat: 'monthly' },
        { id: 'emi', name: 'Two-wheeler EMI', amountPaise: 320_000, dueDate: dueOn(23), repeat: 'monthly' },
        { id: 'school', name: 'School fees', amountPaise: 450_000, dueDate: dueOn(26), repeat: 'once' },
        { id: 'rent', name: 'Rent', amountPaise: 1_800_000, dueDate: monthRange(month).to, repeat: 'monthly' },
      ],
      holdings: [
        { id: 'emergency', name: 'Emergency savings', kind: 'Savings', amountPaise: 7_500_000, asOf: today },
        { id: 'sip', name: 'Monthly SIP', kind: 'Mutual fund / SIP', amountPaise: 10_000_000, asOf: today },
        { id: 'fixed', name: 'Bank fixed deposit', kind: 'FD / RD', amountPaise: 5_000_000, asOf: today },
      ],
      payments: [{ id: broadbandKey, expenseId: 'internet', dueDate: broadbandDue }],
    },
    expenses: [
      expense('groceries', 'Household groceries', 'Shopping', 8270, recordedOn(4)),
      expense('travel', 'Fuel and travel', 'Transportation', 3480, recordedOn(7)),
      { ...expense('internet', 'Broadband', 'Bills & Utilities', 750, broadbandDue), billPaymentKey: broadbandKey },
      expense('chai', 'Chai and breakfast', 'Food & Dining', 240, recordedOn(9)),
      expense('previous-groceries', 'Household groceries', 'Shopping', 7400, previous + '-01'),
      expense('previous-fuel', 'Fuel', 'Transportation', 3200, previous + '-02'),
    ],
    budgets: [
      { id: 'shopping', category: 'Shopping', limit: 10000, spent: 0 },
      { id: 'transport', category: 'Transportation', limit: 5000, spent: 0 },
      { id: 'food', category: 'Food & Dining', limit: 4500, spent: 0 },
    ],
  };
}

export default function DemoWorkspace() {
  const [today] = useState(localDate);
  const [{ household, expenses, budgets }] = useState(() => sampleHousehold(today));
  const currentMonth = today.slice(0, 7);
  const [page, setPage] = useState<WorkspacePage>('home');
  const [homeMonth, setHomeMonth] = useState(currentMonth);
  const [overviewMonth, setOverviewMonth] = useState(currentMonth);
  const [range, setRange] = useState(() => monthRange(currentMonth));
  const mainRef = useRef<HTMLElement>(null);
  const homeRange = monthRange(homeMonth);
  const through = homeMonth === currentMonth ? today : homeRange.to;
  const occurrences = listBillOccurrences(household.bills, household.payments, expenses, currentMonth, today);
  const homeBills = homeMonth === currentMonth ? occurrences : listBillOccurrences(household.bills, household.payments, expenses, homeMonth, through);

  function navigate(next: WorkspacePage) {
    setPage(next);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  }

  function openLedger(month: string) {
    setRange(monthRange(month));
    navigate('expenses');
  }

  return (
    <WorkspaceShell page={page} mainRef={mainRef} onNavigate={navigate}>
      {page === 'home' && <MoneyHome
        monthLabel={new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(homeRange.from + 'T12:00:00'))}
        currentMonth={homeMonth === currentMonth} today={through}
        income={household.income.filter(({ date }) => date >= homeRange.from && date <= through)}
        spentPaise={Math.round(totalAmount(periodExpenses(expenses, homeRange.from, through)) * 100)}
        bills={homeBills} holdings={household.holdings}
        onMonthChange={(direction) => setHomeMonth(shiftMonth(homeMonth, direction))}
        onExpenses={() => openLedger(homeMonth)} onBills={() => navigate('bills')} onSavings={() => navigate('savings')}
      />}
      {page === 'expenses' && <Ledger expenses={expenses} categories={categories} people={[]} range={range} onRangeChange={setRange} />}
      {page === 'bills' && <BillsPage bills={household.bills} occurrences={occurrences} today={today} />}
      {page === 'savings' && <SavingsPage holdings={household.holdings} />}
      {page === 'dashboard' && <Overview expenses={expenses} budgets={budgets} categories={categories} month={overviewMonth}
        onMonthChange={setOverviewMonth} onOpenLedger={() => openLedger(overviewMonth)} />}
      {page === 'settings' && <SettingsPage />}
      {page === 'explorer' && <ComingSoonPage title="Metrics Explorer" description="For monthly spending patterns, open Overview from More." onHome={() => navigate('home')} />}
    </WorkspaceShell>
  );
}
