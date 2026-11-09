type Operation =
  | 'expense.create' | 'expense.update' | 'expense.delete'
  | 'budget.create' | 'budget.update' | 'budget.delete'
  | 'ai.ask'
  | 'auth.google' | 'auth.email' | 'auth.signup' | 'auth.reset' | 'auth.magic_link';

interface RumClassic {
  disable: () => void;
  enable: () => void;
  disableSessionReplay: () => void;
  setAutomaticActionDetection: (enabled: boolean) => void;
  enterAction: (name: string) => number;
  leaveAction: (id: number) => void;
  reportCustomError: (key: string, value: string, hint?: string, parentingInfo?: number) => void;
}

const knownErrors = new Set([
  'functions/unauthenticated', 'functions/unavailable', 'functions/deadline-exceeded',
  'permission-denied', 'unavailable', 'unauthenticated', 'invalid-argument', 'not-found',
  'auth/network-request-failed', 'auth/popup-blocked', 'auth/popup-closed-by-user',
  'auth/invalid-credential', 'auth/unauthorized-domain', 'auth/too-many-requests',
]);

function errorCode(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  return typeof code === 'string' && knownErrors.has(code) ? code : 'unexpected';
}

const preferenceKey = 'finbuddy-usage-analytics';
const tagUrl: string = import.meta.env.VITE_FINBUDDY_RUM_URL ?? '';
export const rumConfigured = /^https:\/\/js-cdn\.dynatrace\.com\/jstag\/[a-zA-Z0-9/_-]+_complete\.js$/.test(tagUrl);

function getRum() {
  return (window as Window & { dtrum?: RumClassic }).dtrum;
}

export function rumPreference(): boolean {
  try {
    return rumConfigured && localStorage.getItem(preferenceKey) === 'granted';
  } catch {
    return false;
  }
}

export function initializeRum() {
  if (!rumPreference()) return;
  try {
    const configure = () => {
      const rum = getRum();
      rum?.disableSessionReplay();
      rum?.setAutomaticActionDetection(false);
      if (rumPreference()) rum?.enable();
      else rum?.disable();
    };
    if (getRum()) {
      configure();
    } else if (!document.getElementById('finbuddy-rum')) {
      const script = document.createElement('script');
      script.id = 'finbuddy-rum';
      script.src = tagUrl;
      script.crossOrigin = 'anonymous';
      script.addEventListener('load', configure, { once: true });
      script.addEventListener('error', () => script.remove(), { once: true });
      document.head.append(script);
    }
  } catch {
    // The workspace is available when telemetry is unavailable.
  }
}

function disableRum() {
  try { getRum()?.disable(); } catch { /* RUM is best effort. */ }
}

export function setRumPreference(enabled: boolean): boolean {
  try {
    localStorage.setItem(preferenceKey, enabled ? 'granted' : 'denied');
  } catch {
    if (!enabled) disableRum();
    return false;
  }
  if (enabled) initializeRum();
  else disableRum();
  return true;
}

export function reportRuntimeFailure() {
  try {
    if (rumPreference()) getRum()?.reportCustomError('finbuddy.operation', 'render-failed');
  } catch { /* RUM is best effort. */ }
}

export async function observeOperation<T>(operation: Operation, execute: () => Promise<T>): Promise<T> {
  const rum = rumPreference() ? getRum() : undefined;
  let action: number | undefined;
  try { action = rum?.enterAction(operation); } catch { /* RUM is best effort. */ }
  try {
    return await execute();
  } catch (error) {
    try { rum?.reportCustomError('finbuddy.operation', errorCode(error), undefined, action); } catch { /* RUM is best effort. */ }
    throw error;
  } finally {
    try { if (action !== undefined) rum?.leaveAction(action); } catch { /* RUM is best effort. */ }
  }
}
