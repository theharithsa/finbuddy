import { useState } from 'react';
import { rumConfigured, rumPreference, setRumPreference } from '@/lib/operation-monitoring';

export function UsageAnalytics() {
  const [enabled, setEnabled] = useState(rumPreference);
  const [failed, setFailed] = useState(false);
  if (!rumConfigured) return null;

  return (
    <span>
      <button type="button" aria-pressed={enabled} onClick={() => {
        const next = !enabled;
        const saved = setRumPreference(next);
        if (saved) setEnabled(next);
        setFailed(!saved);
      }}>Usage analytics {enabled ? 'on' : 'off'}</button>
      {failed && <span role="status"> · Couldn’t save this preference</span>}
    </span>
  );
}
