import {
  Bike, Book, CalendarDays, Child, CreditCard, Dining, Education, Entertainment, FileText,
  Fitness, Flame, Fuel, Groceries, Health, Heart, House, Milk, Music, Phone, ReceiptText,
  Shield, Shopping, Star, Tools, Transport, Travel, Tv, User, Users, Wallet, Water, Wifi, Zap,
} from './Icons';
import { Button } from '@/components/ui/button';

const itemIcons = {
  dining: Dining, transport: Transport, shopping: Shopping, entertainment: Entertainment,
  utilities: Zap, health: Health, education: Education, travel: Travel,
  home: House, money: Wallet, calendar: CalendarDays, book: Book,
  note: FileText, star: Star, person: User, family: Users, heart: Heart, child: Child,
  receipt: ReceiptText, water: Water, flame: Flame, phone: Phone, wifi: Wifi, tv: Tv,
  music: Music, fitness: Fitness, shield: Shield, fuel: Fuel, bike: Bike, groceries: Groceries,
  card: CreditCard, tools: Tools, milk: Milk,
} as const;

export type ItemIconName = keyof typeof itemIcons;

const legacyIcons = new Map<string, ItemIconName>([
  ['🍽', 'dining'], ['🚗', 'transport'], ['🛍', 'shopping'], ['🎬', 'entertainment'],
  ['⚡', 'utilities'], ['🏥', 'health'], ['📚', 'education'], ['✈', 'travel'],
  ['📝', 'note'], ['🏠', 'home'], ['💰', 'money'], ['⭐', 'star'],
  ['👤', 'person'], ['💑', 'heart'], ['👨‍👩‍👧‍👦', 'family'], ['👶', 'child'],
  ['👴', 'person'], ['👫', 'family'], ['👥', 'family'], ['🛒', 'groceries'],
  ['📱', 'phone'], ['💳', 'card'], ['🧾', 'receipt'], ['💧', 'water'], ['🔥', 'flame'],
  ['📺', 'tv'], ['🎵', 'music'], ['🛡', 'shield'], ['⛽', 'fuel'], ['🏍', 'bike'],
]);

export const categoryIcons: { id: ItemIconName; label: string }[] = [
  { id: 'dining', label: 'Food' }, { id: 'transport', label: 'Transport' }, { id: 'shopping', label: 'Shopping' },
  { id: 'entertainment', label: 'Entertainment' }, { id: 'utilities', label: 'Utilities' },
  { id: 'health', label: 'Health' }, { id: 'education', label: 'Education' }, { id: 'travel', label: 'Travel' },
  { id: 'home', label: 'Home' }, { id: 'money', label: 'Money' }, { id: 'calendar', label: 'Calendar' },
  { id: 'book', label: 'Books' }, { id: 'groceries', label: 'Groceries' },
  { id: 'receipt', label: 'Bill' }, { id: 'note', label: 'Other' },
];

export const personIcons: { id: ItemIconName; label: string }[] = [
  { id: 'person', label: 'Person' }, { id: 'family', label: 'Group' }, { id: 'heart', label: 'Heart' },
  { id: 'child', label: 'Child' }, { id: 'home', label: 'Home' }, { id: 'star', label: 'Star' },
];

export function resolveItemIcon(value: string) {
  return legacyIcons.get(value.replace(/\uFE0F|[\u{1F3FB}-\u{1F3FF}]/gu, ''))
    ?? (Object.prototype.hasOwnProperty.call(itemIcons, value) ? value as ItemIconName : undefined);
}

export function ItemIcon({ value, fallback = 'note', size = 20 }: { value?: string; fallback?: ItemIconName; size?: number }) {
  const Icon = itemIcons[resolveItemIcon(value ?? '') ?? fallback];
  return <Icon size={size} className="m3-item-glyph" />;
}

export function ItemIconPicker({ value, options, onChange }: {
  value: string;
  options: { id: ItemIconName; label: string }[];
  onChange: (icon: ItemIconName) => void;
}) {
  const selectedId = resolveItemIcon(value);
  const selected = options.find(({ id }) => id === selectedId);
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">Icon</legend>
      <div className="flex flex-wrap gap-1">
        {options.map(({ id, label }) => (
          <Button key={id} type="button" size="icon" variant="ghost" className="m3-icon-option"
            aria-label={label} aria-pressed={selected?.id === id} title={label} onClick={() => onChange(id)}>
            <ItemIcon value={id} />
          </Button>
        ))}
      </div>
      {selected
        ? <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">Selected icon · {selected.label}</p>
        : value && <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">Current icon <ItemIcon value={value} /></p>}
    </fieldset>
  );
}
