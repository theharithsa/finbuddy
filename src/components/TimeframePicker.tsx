import { useId, useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { localDate, monthRange, shiftMonth } from '@/lib/finance-period';
import { formatDate } from '@/lib/types';

export interface DateRange {
  from: string;
  to: string;
}

interface TimeframePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  className?: string;
}

export const ALL_DATES: DateRange = { from: '0001-01-01', to: '9999-12-31' };

function rollingRange(days: number, now: Date): DateRange {
  const start = new Date(now);
  start.setDate(start.getDate() - days + 1);
  return { from: localDate(start), to: localDate(now) };
}

export function TimeframePicker({ dateRange, onDateRangeChange, className }: TimeframePickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const today = localDate();
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const now = new Date();
  const presets = [
    { label: 'This month', range: monthRange(month) },
    { label: 'Last month', range: monthRange(shiftMonth(month, -1)) },
    { label: 'Last 30 days', range: rollingRange(30, now) },
    { label: 'Last 90 days', range: rollingRange(90, now) },
    { label: 'This year', range: { from: `${year}-01-01`, to: `${year}-12-31` } },
    { label: 'All time', range: ALL_DATES },
  ];
  const selected = presets.find(({ range }) => range.from === dateRange.from && range.to === dateRange.to);
  const label = selected?.label || (dateRange.from && dateRange.to ? `${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}` : 'Select period');

  function setRange(range: DateRange) {
    onDateRangeChange(range);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      if (next) {
        setFrom(dateRange.from === ALL_DATES.from ? today : dateRange.from);
        setTo(dateRange.to === ALL_DATES.to ? today : dateRange.to);
      }
      setOpen(next);
    }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={`m3-date-trigger ${className ?? ''}`} aria-label={`Date range: ${label}`}>
          <CalendarDays size={17} /><span>{label}</span><ChevronDown size={17} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="m3-date-popover">
        <div className="m3-date-popover-title">Date range</div>
        <div className="m3-chip-set">
          {presets.map((preset) => (
            <button type="button" className="m3-chip" key={preset.label} aria-pressed={preset === selected} onClick={() => setRange(preset.range)}>
              {preset === selected && <Check size={15} />}{preset.label}
            </button>
          ))}
        </div>
        <form className="m3-custom-date" onSubmit={(event) => { event.preventDefault(); if (from && to && from <= to) setRange({ from, to }); }}>
          <div className="m3-date-popover-title">Custom dates</div>
          <div className="m3-date-fields">
            <div className="m3-field"><label htmlFor={`${id}-from`}>From</label><input id={`${id}-from`} type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></div>
            <div className="m3-field"><label htmlFor={`${id}-to`}>To</label><input id={`${id}-to`} type="date" value={to} onChange={(event) => setTo(event.target.value)} min={from || undefined} required /></div>
          </div>
          <Button type="submit" disabled={!from || !to || from > to}>Apply dates</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
