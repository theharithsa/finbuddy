import {
  Book, CalendarDays, Dining, Education, Entertainment, FileText, Health, Heart,
  House, Shopping, Sparkles, Transport, Travel, User, Users, Wallet, Zap,
} from './Icons';
import { Button } from '@/components/ui/button';

const itemIcons = {
  dining: Dining, transport: Transport, shopping: Shopping, entertainment: Entertainment,
  utilities: Zap, health: Health, education: Education, travel: Travel,
  home: House, money: Wallet, calendar: CalendarDays, book: Book,
  note: FileText, star: Sparkles, person: User, family: Users, heart: Heart,
} as const;

type ItemIconName = keyof typeof itemIcons;

const legacyIcons = new Map<string, ItemIconName>([
  ['🍽️', 'dining'], ['🚗', 'transport'], ['🛍️', 'shopping'], ['🎬', 'entertainment'],
  ['⚡', 'utilities'], ['🏥', 'health'], ['📚', 'education'], ['✈️', 'travel'],
  ['📝', 'note'], ['🏠', 'home'], ['💰', 'money'], ['⭐', 'star'],
  ['👤', 'person'], ['💑', 'heart'], ['👨‍👩‍👧‍👦', 'family'], ['👶', 'person'],
  ['👴', 'person'], ['👫', 'family'], ['👥', 'family'],
]);

export const categoryIcons: { id: ItemIconName; label: string }[] = [
  { id: 'dining', label: 'Food' }, { id: 'transport', label: 'Transport' }, { id: 'shopping', label: 'Shopping' },
  { id: 'entertainment', label: 'Entertainment' }, { id: 'utilities', label: 'Utilities' },
  { id: 'health', label: 'Health' }, { id: 'education', label: 'Education' }, { id: 'travel', label: 'Travel' },
  { id: 'home', label: 'Home' }, { id: 'money', label: 'Money' }, { id: 'calendar', label: 'Calendar' },
  { id: 'book', label: 'Books' }, { id: 'note', label: 'Other' },
];

export const personIcons: { id: ItemIconName; label: string }[] = [
  { id: 'person', label: 'Person' }, { id: 'family', label: 'Group' }, { id: 'heart', label: 'Heart' },
  { id: 'home', label: 'Home' }, { id: 'star', label: 'Star' },
];

export function resolveItemIcon(value: string) {
  return legacyIcons.get(value) ?? (Object.prototype.hasOwnProperty.call(itemIcons, value) ? value as ItemIconName : undefined);
}

export function ItemIcon({ value = 'note', size = 20 }: { value?: string; size?: number }) {
  const name = resolveItemIcon(value);
  const Icon = name ? itemIcons[name] : undefined;
  return Icon ? <Icon size={size} /> : <span aria-hidden="true">{value}</span>;
}

export function ItemIconPicker({ value, options, onChange }: {
  value: string;
  options: { id: ItemIconName; label: string }[];
  onChange: (icon: ItemIconName) => void;
}) {
  const selected = resolveItemIcon(value);
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">Icon</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(({ id, label }) => (
          <Button key={id} type="button" size="icon" variant={selected === id ? 'secondary' : 'outline'}
            aria-label={label} aria-pressed={selected === id} title={label} onClick={() => onChange(id)}>
            <ItemIcon value={id} />
          </Button>
        ))}
      </div>
      {!selected && value && <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">Current icon <ItemIcon value={value} /></p>}
    </fieldset>
  );
}
