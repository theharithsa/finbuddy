import { money } from '@/lib/household';

const monthFormat = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export const displayMonth = (value: string) => monthFormat.format(new Date(value + '-01T12:00:00Z'));
export const estimateMoney = (paise: number | null) => paise === null ? 'Outside estimate range' : money(paise);
