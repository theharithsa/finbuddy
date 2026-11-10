import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts, isAppearanceOption, palettes, type DisplayMode } from '@/lib/appearance';
import type { User } from 'firebase/auth';
import { DeveloperOptions } from './DeveloperOptions';

const modes: { id: DisplayMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

export function SettingsPage({ user }: { user?: User }) {
  const { displayMode, font, palette, setFont, setTheme, setPalette, resetAppearance } = useTheme();

  return (
    <>
      <header className="m3-page-heading">
        <div><h1>Settings</h1><p>{user ? 'Make FinBuddy yours and connect your own tools.' : 'Choose how FinBuddy looks on this device.'}</p></div>
      </header>
      <section className="m3-panel appearance-panel" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <fieldset className="appearance-group">
          <legend>Display mode</legend>
          <div className="appearance-choices">
            {modes.map(({ id, label }) => (
              <label className="appearance-choice" key={id}>
                <input type="radio" name="display-mode" checked={displayMode === id} onChange={() => setTheme(id)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="appearance-group">
          <legend>Color palette</legend>
          <div className="appearance-choices">
            {Object.entries(palettes).map(([id, { name, swatch }]) => (
              <label className="appearance-choice" key={id}>
                <input type="radio" name="appearance-palette" checked={palette === id} onChange={() => {
                  if (isAppearanceOption(palettes, id)) setPalette(id);
                }} />
                <span className="appearance-swatch" style={{ background: swatch }} aria-hidden="true" />
                <span>{name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="m3-field appearance-font">
          <span>Font</span>
          <select value={font} onChange={({ target }) => {
            if (isAppearanceOption(fonts, target.value)) setFont(target.value);
          }}>
            {Object.entries(fonts).map(([id, { name }]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <div className="appearance-preview" aria-label="Appearance preview">
          <span>Preview</span>
          <p>Left after bills</p>
          <strong>₹24,500.00</strong>
        </div>
        <div className="appearance-footer"><Button variant="ghost" onClick={resetAppearance}>Reset appearance</Button></div>
      </section>
      {user && <DeveloperOptions user={user} />}
    </>
  );
}
