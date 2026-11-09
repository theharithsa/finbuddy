export const fonts = {
  'google-sans': { name: 'Google Sans', family: '"Google Sans Variable", system-ui, sans-serif' },
  'source-code-pro': { name: 'Source Code Pro', family: '"Source Code Pro Variable", ui-monospace, monospace' },
  'source-sans-3': { name: 'Source Sans 3', family: '"Source Sans 3 Variable", system-ui, sans-serif' },
  lato: { name: 'Lato', family: 'Lato, system-ui, sans-serif' },
  'open-sans': { name: 'Open Sans', family: '"Open Sans Variable", system-ui, sans-serif' },
  ubuntu: { name: 'Ubuntu', family: 'Ubuntu, system-ui, sans-serif' },
  'source-serif-4': { name: 'Source Serif 4', family: '"Source Serif 4 Variable", Georgia, serif' },
  lora: { name: 'Lora', family: '"Lora Variable", Georgia, serif' },
  roboto: { name: 'Roboto', family: '"Roboto Variable", system-ui, sans-serif' },
} as const;

export const palettes = {
  lavender: { name: 'Lavender', swatch: '#5b4ba3' },
  ocean: { name: 'Ocean', swatch: '#12658a' },
  forest: { name: 'Forest', swatch: '#28664d' },
  marigold: { name: 'Marigold', swatch: '#916013' },
  rose: { name: 'Rose', swatch: '#9f3d61' },
} as const;

export type Font = keyof typeof fonts;
export type Palette = keyof typeof palettes;
export type Theme = 'dark' | 'light';
export type DisplayMode = Theme | 'system';

export const defaultFont: Font = 'google-sans';
export const defaultPalette: Palette = 'lavender';

const fontImports: Record<Exclude<Font, 'google-sans'>, () => Promise<unknown>> = {
  'source-code-pro': () => import('@fontsource-variable/source-code-pro'),
  'source-sans-3': () => import('@fontsource-variable/source-sans-3'),
  lato: () => Promise.all([
    import('@fontsource/lato/latin-400.css'),
    import('@fontsource/lato/latin-700.css'),
  ]),
  'open-sans': () => import('@fontsource-variable/open-sans'),
  ubuntu: () => Promise.all([
    import('@fontsource/ubuntu/latin-400.css'),
    import('@fontsource/ubuntu/latin-500.css'),
    import('@fontsource/ubuntu/latin-700.css'),
  ]),
  'source-serif-4': () => import('@fontsource-variable/source-serif-4'),
  lora: () => import('@fontsource-variable/lora'),
  roboto: () => import('@fontsource-variable/roboto'),
};

export function loadAppearanceFont(font: Font) {
  return font === 'google-sans' ? Promise.resolve() : fontImports[font]();
}

export function isAppearanceOption<T extends string>(options: Record<T, unknown>, value: string | null): value is T {
  return value !== null && Object.prototype.hasOwnProperty.call(options, value);
}
