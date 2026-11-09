import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

function glyph(outline: string, tint?: string) {
  return function FinBuddyIcon({ size = 24, strokeWidth = 1.7, ...props }: IconProps) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
        focusable="false" aria-hidden="true" {...props}>
        {tint && <path d={tint} fill="currentColor" opacity=".19" stroke="none" />}
        <path d={outline} />
      </svg>
    );
  };
}

export const House = glyph('M3.5 10.5 10.8 4.6a2 2 0 0 1 2.4 0l7.3 5.9v8a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z M9.5 20v-5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5', 'M4 11 12 4.5l8 6.5v8.5H4z');
export const ReceiptText = glyph('M6 4.5h12v15l-3-1.6-3 1.6-3-1.6-3 1.6z M9 8.5h6 M9 12h6 M9 15.5h3', 'M6 5h12v6H6z');
export const Landmark = glyph('M4 8.5 11.3 4a1.3 1.3 0 0 1 1.4 0L20 8.5z M6.5 12v4.5 M12 12v4.5 M17.5 12v4.5 M4 19.5h16', 'M4 8.5 12 4l8 4.5z M5 17.5h14v2H5z');
export const CalendarDays = glyph('M5.5 6h13A2.5 2.5 0 0 1 21 8.5v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10A2.5 2.5 0 0 1 5.5 6z M7.5 4v4 M16.5 4v4 M3.5 10.5h17 M8 15l2 2 5-4', 'M4 6.5h16v4H4z');
export const Wallet = glyph('M20 10V8.5A2.5 2.5 0 0 0 17.5 6H6a2 2 0 0 1-.5-3.9l10-1 M4 4v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2 M15.5 10h6v6h-6a3 3 0 0 1 0-6z M16 13h.01', 'M15.5 10h6v6h-6a3 3 0 0 1 0-6z');
export const LayoutDashboard = glyph('M5 4.5h4.5A1.5 1.5 0 0 1 11 6v3.5A1.5 1.5 0 0 1 9.5 11H5a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5z M15.5 4.5H19A1.5 1.5 0 0 1 20.5 6v10A1.5 1.5 0 0 1 19 17.5h-3.5A1.5 1.5 0 0 1 14 16V6a1.5 1.5 0 0 1 1.5-1.5z M5 14h4.5A1.5 1.5 0 0 1 11 15.5V19A1.5 1.5 0 0 1 9.5 20.5H5A1.5 1.5 0 0 1 3.5 19v-3.5A1.5 1.5 0 0 1 5 14z', 'M15 5h4.5v12H15z');
export const Repeat2 = glyph('M4 10a4.5 4.5 0 0 1 4.5-4.5H19 M16.5 3 19 5.5 16.5 8 M20 14a4.5 4.5 0 0 1-4.5 4.5H5 M7.5 16 5 18.5 7.5 21');
export const Shapes = glyph('M5 5h5v5H5z M15 3.5l4.5 7h-9z M10 17.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z M17 13.5l4 4-4 4-4-4z', 'M17 13.5l4 4-4 4-4-4z M5 5h5v5H5z');
export const Users = glyph('M14 8a3.25 3.25 0 1 1-6.5 0A3.25 3.25 0 0 1 14 8z M4.5 19v-1a5 5 0 0 1 5-5H12a5 5 0 0 1 5 5v1z M16 5.2a3 3 0 0 1 0 5.6 M18 13.5a4.2 4.2 0 0 1 3 4V19', 'M4.5 19v-1a5 5 0 0 1 5-5H12a5 5 0 0 1 5 5v1z');
export const ChartNoAxesCombined = glyph('M4 5v13a2 2 0 0 0 2 2h14 M8 16v-3 M12 16V9 M16 16v-5 M20 16V6', 'M10.7 9h2.6v7h-2.6z M18.7 6h2.6v10h-2.6z');
export const Sparkles = glyph('M11 3c.6 5 3.5 7.9 8.5 8.5-5 .6-7.9 3.5-8.5 8.5-.6-5-3.5-7.9-8.5-8.5 5-.6 7.9-3.5 8.5-8.5z M18 4.5h4 M20 2.5v4 M18 19h3.5 M19.75 17.25v3.5', 'M11 3c.6 5 3.5 7.9 8.5 8.5-5 .6-7.9 3.5-8.5 8.5-.6-5-3.5-7.9-8.5-8.5 5-.6 7.9-3.5 8.5-8.5z');
export const Settings = glyph('M6 4v4m0 4v8 M12 4v9m0 4v3 M18 4v2m0 4v10 M8 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M14 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M20 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z');
export const Plus = glyph('M12 5v14 M5 12h14');
export const Menu = glyph('M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01');
export const ChevronDown = glyph('M6.5 9.5 12 15l5.5-5.5');
export const ChevronUp = glyph('M6.5 14.5 12 9l5.5 5.5');
export const ChevronLeft = glyph('m14.5 6.5-5.5 5.5 5.5 5.5');
export const ChevronRight = glyph('m9.5 6.5 5.5 5.5-5.5 5.5');
export const ArrowRight = glyph('M4.5 12h14 M13.5 6.5 19 12l-5.5 5.5');
export const ArrowLeft = glyph('M19.5 12h-14 M10.5 6.5 5 12l5.5 5.5');
export const ArrowDownLeft = glyph('M18.5 5.5 6 18 M6 9v9h9');
export const ArrowDownRight = glyph('M5.5 5.5 18 18 M9 18h9V9');
export const X = glyph('m6 6 12 12 M18 6 6 18');
export const Check = glyph('m5 12 4.5 4.5 9-9');
export const Circle = glyph('M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z', 'M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z');
export const Search = glyph('M16.5 10a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z M15 15l5 5', 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0z');
export const SlidersHorizontal = glyph('M4 7h5m4 0h7 M4 17h9m4 0h3 M13 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M17 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z');
export const Trash2 = glyph('M4.5 6.5h15 M9 6.5V4h6v2.5 M6.5 7l.8 11a2 2 0 0 0 2 2h5.4a2 2 0 0 0 2-2l.8-11 M10 10.5v5.5 M14 10.5v5.5', 'M7 7h10l-.8 12H7.8z');
export const Pencil = glyph('m5 15.5 10.7-10.7a2.1 2.1 0 0 1 3 3L8 18.5 4 19.5z M14 6.5l3.1 3.1 M11.5 20H20', 'm5 15.5 10.7-10.7 3 3L8 18.5 4 19.5z');
export const Paperclip = glyph('m8 13 5.5-5.5a2 2 0 1 1 2.8 2.8l-7 7a3.5 3.5 0 0 1-5-5l8-8a4.8 4.8 0 0 1 6.8 6.8l-8.6 8.6');
export const FileText = glyph('M6 3.5h8l4.5 4.5v12H6z M14 3.5V8h4.5 M9 12h6 M9 16h6', 'M14 3.5V8h4.5z');
export const EllipsisVertical = glyph('M12 5h.01 M12 12h.01 M12 19h.01');
export const CircleHelp = glyph('M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M9.4 9.5a2.65 2.65 0 0 1 5.3.2c0 1.7-2.7 2.1-2.7 3.8 M12 17h.01');
export const LogOut = glyph('M13 5.5H6.5A1.5 1.5 0 0 0 5 7v10a1.5 1.5 0 0 0 1.5 1.5H13 M9 12h11 M16 8l4 4-4 4', 'M5.5 6H11v12H5.5z');
export const LockKeyhole = glyph('M8 10V7a4 4 0 0 1 8 0v3 M7 10h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z M12 14v2.5', 'M5.5 11h13v8h-13z');
export const Moon = glyph('M19.7 15A8.4 8.4 0 0 1 9 4.3a8.4 8.4 0 1 0 10.7 10.7z M18 5v4 M16 7h4', 'M19.7 15A8.4 8.4 0 0 1 9 4.3a8.4 8.4 0 1 0 10.7 10.7z');
export const Sun = glyph('M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.2 5.2l1.4 1.4m10.8 10.8 1.4 1.4m0-13.6-1.4 1.4M6.6 17.4l-1.4 1.4', 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z');
export const AlertCircle = glyph('M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 7.5v5.3 M12 16.5h.01');
export const AlertTriangle = glyph('m10.3 5.1-7 12.3A1.6 1.6 0 0 0 4.7 20h14.6a1.6 1.6 0 0 0 1.4-2.6l-7-12.3a2 2 0 0 0-3.4 0z M12 9v4.5 M12 16.5h.01', 'M12 4.4 3.6 19h16.8z');
export const Clock = glyph('M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 7v5l3 2');
export const RefreshCw = glyph('M19.5 9a7.5 7.5 0 0 0-13-3l-2 2 M4.5 4v4.5H9 M4.5 15a7.5 7.5 0 0 0 13 3l2-2 M19.5 20v-4.5H15');
export const CircleGauge = glyph('M5 18a9 9 0 1 1 14 0H5z M12 13l4.5-4 M7 12h.01 M12 7h.01', 'M5 18a9 9 0 1 1 14 0H5z');
export const Book = glyph('M4.5 5.5h6l1.5 2 1.5-2h6v13h-6l-1.5 1.5-1.5-1.5h-6z M12 8v11.5 M7 10h2 M15 10h2', 'M13 6h6v12h-6z');
export const Calculator = glyph('M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M8 7h8v3H8z M8.5 14h.01 M12 14h.01 M15.5 14h.01 M8.5 17h.01 M12 17h.01 M15.5 17h.01', 'M8 7h8v3H8z');
export const Globe = glyph('M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M3.5 12h17 M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17z');
export const Lightbulb = glyph('M9 16c0-2.8-3-3.2-3-7a6 6 0 0 1 12 0c0 3.8-3 4.2-3 7z M9 19h6 M10.5 21h3', 'M9 16c0-2.8-3-3.2-3-7a6 6 0 0 1 12 0c0 3.8-3 4.2-3 7z');
export const Target = glyph('M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M17.5 12a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z M12 12h.01', 'M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z');
export const User = glyph('M15.5 7.7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z M5 19v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1z', 'M5 19v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1z');
export const Download = glyph('M12 4v11 M8.5 11.5 12 15l3.5-3.5 M5 16.5v2A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-2');
export const Tag = glyph('M4 5h8l8 8-7 7-9-9z M8 8.5h.01', 'M4 5h8l8 8-7 7-9-9z');
export const TrendingUp = glyph('m4 17 5.5-5.5 4 3.5L20 8 M15.5 8H20v4.5');
export const Palette = glyph('M20.5 11.5a8.5 8.5 0 1 0-8.5 8.5c2 0 2.3-1.7 1.4-2.8-.8-1.1-.2-2.5 1.2-2.5h2.8a3.1 3.1 0 0 0 3.1-3.2z M7 11h.01 M10 7.5h.01 M14 7h.01 M17.5 10h.01', 'M20.5 11.5a8.5 8.5 0 1 0-8.5 8.5c2 0 2.3-1.7 1.4-2.8-.8-1.1-.2-2.5 1.2-2.5h2.8a3.1 3.1 0 0 0 3.1-3.2z');
export const Share2 = glyph('M7.8 12.5 16 7 M7.8 13 16 18.4 M8 12.6a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M21 5.8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M21 19a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z');
export const Eye = glyph('M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z');
export const EyeOff = glyph('M3.5 4.5 20 20 M9.5 6.3A9 9 0 0 1 12 6c5.5 0 9 6 9 6a13 13 0 0 1-3 3.4 M14.7 17.7a9 9 0 0 1-2.7.3c-5.5 0-9-6-9-6a14 14 0 0 1 3-3.4');
export const BarChart3 = ChartNoAxesCombined;
export const PieChart = glyph('M11 4.5a8 8 0 1 0 8.5 8.5H11z M14 3.5V10h6.5A7 7 0 0 0 14 3.5z', 'M14 3.5V10h6.5A7 7 0 0 0 14 3.5z');
export const LineChart = glyph('M4.5 5v13A1.5 1.5 0 0 0 6 19.5h14 M7 15l4-5 3 2 5-6');
export const Table = glyph('M5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11A1.5 1.5 0 0 1 5.5 5z M4 10h16 M4 14.5h16 M10 10v9', 'M4.5 5.5h15V10h-15z');
export const Filter = glyph('M4 5h16l-6 7v6l-4 1v-7z', 'M4 5h16l-6 7v6l-4 1v-7z');
export const Database = glyph('M20 6.5c0 1.5-3.6 2.7-8 2.7S4 8 4 6.5 7.6 3.8 12 3.8s8 1.2 8 2.7z M4 6.5v11c0 1.5 3.6 2.7 8 2.7s8-1.2 8-2.7v-11 M4 12c0 1.5 3.6 2.7 8 2.7s8-1.2 8-2.7', 'M20 6.5c0 1.5-3.6 2.7-8 2.7S4 8 4 6.5 7.6 3.8 12 3.8s8 1.2 8 2.7z');
export const Rupee = glyph('M6 5h12 M6 9h12 M9 5a4 4 0 0 1 0 8H6l9 7');
export const Grid3x3 = glyph('M5 5h14v14H5z M5 9.7h14 M5 14.3h14 M9.7 5v14 M14.3 5v14');
export const Layers = glyph('m3.5 8.5 8.5-4.5 8.5 4.5L12 13z M3.5 12.5 12 17l8.5-4.5 M3.5 16.5 12 21l8.5-4.5', 'm3.5 8.5 8.5-4.5 8.5 4.5L12 13z');
export const Zap = glyph('M13.2 3.5 5 13h6l-.2 7.5L19 11h-6z', 'M13.2 3.5 5 13h6l-.2 7.5L19 11h-6z');
export const Hexagon = glyph('M12 3.5 19.5 8v8L12 20.5 4.5 16V8z M12 3.5V12m7.5-4L12 12l-7.5-4 M12 12v8.5', 'M12 3.5 19.5 8 12 12 4.5 8z');
export const Dining = glyph('M5 4v5a2 2 0 0 0 4 0V4 M7 4v16 M16 4c-2 2-2.5 5-2.5 8H18V4z M18 12v8', 'M16 4c-2 2-2.5 5-2.5 8H18V4z');
export const Transport = glyph('M5 10.5 7 6h10l2 4.5 M6 10.5h12a2 2 0 0 1 2 2V17H4v-4.5a2 2 0 0 1 2-2z M6 17v2 M18 17v2 M8 14h.01 M16 14h.01', 'M5 11h14v6H5z');
export const Shopping = glyph('M5 8h14l1 12H4z M9 10V7a3 3 0 0 1 6 0v3', 'M5 8h14l1 12H4z');
export const Entertainment = glyph('M4.5 10h15v9.5h-15z M4.5 10l-.9-4 14.9-3.3 1 4z M8 5l2.5 3.4 M13 4l2.5 3.4 M10.5 13l4 2.2-4 2.2z', 'M4.5 10h15v9.5h-15z');
export const Health = glyph('M8.5 5h7a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-7a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z M12 8.5v7 M8.5 12h7', 'M8.5 5h7a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-7a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z');
export const Education = glyph('m3 9 9-4 9 4-9 4z M6 11v5c2.5 3 9.5 3 12 0v-5 M21 9v5', 'm3 9 9-4 9 4-9 4z');
export const Travel = glyph('M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7 M6 7h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M8 19v1.5 M16 19v1.5 M9 11v4 M15 11v4', 'M5 8h14v10H5z');
export const Heart = glyph('M12 19.5 5.3 13a4.5 4.5 0 1 1 6.7-6 4.5 4.5 0 1 1 6.7 6z', 'M12 19.5 5.3 13a4.5 4.5 0 1 1 6.7-6 4.5 4.5 0 1 1 6.7 6z');

export {
  CalendarDays as Calendar, ReceiptText as Receipt, CircleGauge as Gauge, Rupee as DollarSign,
  Pencil as Edit2, Trash2 as Trash, Wallet as WalletCards,
};
