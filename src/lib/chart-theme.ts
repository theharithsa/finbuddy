import { defaultFont, fonts, type Theme } from '@/lib/appearance';

// ApexCharts needs resolved colors when it computes gradients and hover states.
const palettes = {
  light: {
    primary: '#5b4ba3', secondary: '#605976', tertiary: '#78536b', quaternary: '#ba1a1a',
    positive: '#286247', caution: '#795400', text: '#1d1923', textMuted: '#4a4456',
    grid: '#cec4d6', background: '#f6f0fb',
    scale: ['#e8deff', '#cbbdff', '#a693e5', '#7868bc', '#493983'],
  },
  dark: {
    primary: '#cbbdff', secondary: '#cbc0df', tertiary: '#efb8d4', quaternary: '#ffb4ab',
    positive: '#a4d8b8', caution: '#f3ca78', text: '#e9e1ef', textMuted: '#cec4d7',
    grid: '#4a4355', background: '#1e1926',
    scale: ['#443481', '#6756b1', '#8f7dd2', '#ad9bec', '#e8deff'],
  },
};

export function getChartTheme(theme: Theme) {
  const fallback = palettes[theme];
  const style = getComputedStyle(document.documentElement);
  const token = (name: string, value: string) => style.getPropertyValue('--m3-' + name).trim() || value;
  const colors = {
    primary: token('primary', fallback.primary),
    secondary: token('secondary', fallback.secondary),
    tertiary: token('tertiary', fallback.tertiary),
    quaternary: token('error', fallback.quaternary),
    positive: token('positive', fallback.positive),
    caution: token('caution', fallback.caution),
    text: token('on-surface', fallback.text),
    textMuted: token('on-surface-variant', fallback.textMuted),
    grid: token('outline-variant', fallback.grid),
    background: token('surface-low', fallback.background),
    scale: fallback.scale.map((color, index) => token('chart-scale-' + index, color)),
  };
  return {
    colors,
    fontFamily: style.getPropertyValue('--app-font').trim() || fonts[defaultFont].family,
    seriesColors: [colors.primary, colors.tertiary, colors.positive, colors.caution, colors.quaternary, colors.secondary],
    seriesLabelColor: theme === 'dark' ? '#201732' : '#fff',
  };
}
