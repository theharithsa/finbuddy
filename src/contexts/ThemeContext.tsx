import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import {
  defaultFont, defaultPalette, fonts, isAppearanceOption, loadAppearanceFont, palettes,
  type DisplayMode, type Font, type Palette, type Theme,
} from '@/lib/appearance';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeState {
  theme: Theme;
  displayMode: DisplayMode;
  font: Font;
  palette: Palette;
  setTheme: (mode: DisplayMode) => void;
  setFont: (font: Font) => void;
  setPalette: (palette: Palette) => void;
  toggleTheme: () => void;
  resetAppearance: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const darkPreference = '(prefers-color-scheme: dark)';

function readSetting(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function storeSetting(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Apply the change for this session. */ }
}

function systemPrefersDark() {
  return window.matchMedia?.(darkPreference).matches ?? false;
}

export function ThemeProvider({ children, defaultTheme = 'light', storageKey = 'finbuddy-ui-theme' }: ThemeProviderProps) {
  const fontKey = storageKey + '-font';
  const paletteKey = storageKey + '-palette';
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    const saved = readSetting(storageKey);
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : defaultTheme;
  });
  const [font, setFont] = useState<Font>(() => {
    const saved = readSetting(fontKey);
    return isAppearanceOption(fonts, saved) ? saved : defaultFont;
  });
  const [palette, setPalette] = useState<Palette>(() => {
    const saved = readSetting(paletteKey);
    return isAppearanceOption(palettes, saved) ? saved : defaultPalette;
  });
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const theme = displayMode === 'system' ? systemDark ? 'dark' : 'light' : displayMode;

  useEffect(() => {
    const preference = window.matchMedia?.(darkPreference);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    preference?.addEventListener('change', onChange);
    return () => preference?.removeEventListener('change', onChange);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.dataset.palette = palette;
    root.style.setProperty('--app-font', fonts[font].family);
    const surface = getComputedStyle(root).getPropertyValue('--m3-surface').trim();
    if (surface) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface);
  }, [font, palette, theme]);

  useEffect(() => {
    void loadAppearanceFont(font).catch(() => { /* The font stack includes a local fallback. */ });
  }, [font]);

  function updateTheme(mode: DisplayMode) {
    setDisplayMode(mode);
    storeSetting(storageKey, mode);
  }

  function updateFont(value: Font) {
    setFont(value);
    storeSetting(fontKey, value);
  }

  function updatePalette(value: Palette) {
    setPalette(value);
    storeSetting(paletteKey, value);
  }

  function resetAppearance() {
    updateTheme(defaultTheme);
    updateFont(defaultFont);
    updatePalette(defaultPalette);
  }

  return (
    <ThemeContext.Provider value={{
      theme, displayMode, font, palette, setTheme: updateTheme, setFont: updateFont, setPalette: updatePalette,
      toggleTheme: () => updateTheme(theme === 'dark' ? 'light' : 'dark'),
      resetAppearance,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
