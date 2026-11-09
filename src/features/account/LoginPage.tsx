import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, Landmark, LockKeyhole, ReceiptText } from '@/components/brand/Icons';
import { checkMagicLinkOnLoad, resetPassword, sendMagicLink, signInWithEmail, signInWithGoogle, signInWithMagicLink, signUpWithEmail } from '@/lib/firebase';
import { UsageAnalytics } from './UsageAnalytics';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { observeOperation } from '@/lib/operation-monitoring';

type Mode = 'signin' | 'signup' | 'reset' | 'link' | 'complete-link';
const headings: Record<Mode, string> = {
  signin: 'Welcome to FinBuddy', signup: 'Create your account', reset: 'Reset your password',
  link: 'Sign in with an email link', 'complete-link': 'Confirm your email',
};
const submitLabels: Record<Mode, string> = {
  signin: 'Sign in', signup: 'Create account', reset: 'Send reset email',
  link: 'Send sign-in link', 'complete-link': 'Finish signing in',
};

export function Wordmark() {
  return <div className="m3-wordmark"><span><img src="/icons/buddy-mark-v1.png" alt="" width={33} height={33} /></span><strong>FinBuddy</strong></div>;
}

function getAuthError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  switch (code) {
    case 'auth/popup-blocked': return 'Your browser blocked the sign-in window. Use email or enable pop-ups and try again.';
    case 'auth/popup-closed-by-user': return 'Sign-in was canceled. You can try again.';
    case 'auth/network-request-failed': return 'Check your internet connection and try again.';
    case 'auth/weak-password': return 'Choose a stronger password and try again.';
    case 'auth/email-already-in-use': return 'An account already uses this email. Sign in or reset your password.';
    case 'auth/invalid-credential': return 'The email or password didn’t match. Try again or reset your password.';
    case 'auth/unauthorized-domain': return 'Google and email links require an authorized FinBuddy address. Sign in with your email and password, or open the main FinBuddy site.';
    default: return 'Couldn’t complete that request. Please try again.';
  }
}

export function LoginPage({ redirectError }: { redirectError: boolean }) {
  const [mode, setMode] = useState<Mode>(() => checkMagicLinkOnLoad() ? 'complete-link' : 'signin');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (redirectError) setError('Couldn’t complete Google sign-in. Please try again.');
  }, [redirectError]);

  function changeMode(next: Mode) {
    setMode(next);
    setError('');
    setStatus('');
  }

  async function run(execute: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await execute();
    } catch (failure) {
      setError(getAuthError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    await run(() => observeOperation('auth.google', () => signInWithGoogle()));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const address = email.trim();
    const password = String(values.get('password') ?? '');
    await run(async () => {
      switch (mode) {
        case 'signin': await observeOperation('auth.email', () => signInWithEmail(address, password)); break;
        case 'signup': await observeOperation('auth.signup', () => signUpWithEmail(address, password, String(values.get('name') ?? '').trim())); break;
        case 'reset':
          await observeOperation('auth.reset', () => resetPassword(address));
          setStatus('If an account exists for this address, you’ll receive a reset email.');
          break;
        case 'link':
          await observeOperation('auth.magic_link', () => sendMagicLink(address));
          setStatus('Check your inbox for a sign-in link.');
          break;
        case 'complete-link':
          await observeOperation('auth.magic_link', () => signInWithMagicLink(address));
          window.history.replaceState(null, '', window.location.pathname);
          break;
      }
    });
  }

  return (
    <main className="m3-login">
      <div className="m3-login-shell">
        <section className="m3-login-story" aria-labelledby="finbuddy-intro">
          <Wordmark />
          <div className="m3-story-body">
            <img className="m3-story-mascot" src="/icons/buddy-mark-v1.png" alt="" width={144} height={144} />
            <h1 id="finbuddy-intro">Know where your money goes.</h1>
            <p>See what came in, what you’ve spent, and what’s left after bills.</p>
            <ul className="m3-story-list">
              <li><ReceiptText size={18} /> Expenses</li>
              <li><CalendarDays size={18} /> Bills &amp; EMIs</li>
              <li><Landmark size={18} /> Savings</li>
            </ul>
          </div>
          <p className="m3-story-lock"><LockKeyhole size={16} /> Sign in to your personal workspace.</p>
        </section>
        <section className="m3-login-access" aria-labelledby="login-heading">
          <div className="m3-login-card">
            <div className="m3-login-toolbar"><div className="m3-mobile-wordmark"><Wordmark /></div><ThemeToggle /></div>
            <h2 id="login-heading">{headings[mode]}</h2>
            <p>{mode === 'signin' ? 'Sign in to start tracking expenses.' : 'Use the email address for your FinBuddy account.'}</p>
            {mode === 'signin' && <>
              <Button className="m3-google" variant="outline" type="button" disabled={busy} onClick={google}><img src="/icons/google-g.png" alt="" width={20} height={20} /> Continue with Google</Button>
              <div className="m3-login-divider"><span>or use email</span></div>
            </>}
            <form key={mode} onSubmit={submit}>
              {mode === 'signup' && <label className="m3-field"><span>Name</span><input name="name" autoComplete="name" required maxLength={80} /></label>}
              <label className="m3-field"><span>Email</span><input type="email" name="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              {(mode === 'signin' || mode === 'signup') && <label className="m3-field"><span>Password</span><input name="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 6 : undefined} required /></label>}
              {error && <p className="m3-field-error" role="alert">{error}</p>}
              {status && <p className="m3-login-status" role="status">{status}</p>}
              <Button disabled={busy} type="submit">{busy ? 'Please wait…' : submitLabels[mode]}<ArrowRight size={17} /></Button>
            </form>
            <div className="m3-login-links">
              {mode === 'signin' ? <>
                <button type="button" disabled={busy} onClick={() => changeMode('signup')}>Create account</button>
                <button type="button" disabled={busy} onClick={() => changeMode('reset')}>Forgot password?</button>
                <button type="button" disabled={busy} onClick={() => changeMode('link')}>Email me a sign-in link</button>
              </> : <button type="button" disabled={busy} onClick={() => changeMode('signin')}>Back to sign in</button>}
            </div>
            <footer className="m3-login-legal"><a href="/docs/privacy-policy.html">Privacy</a><a href="/docs/terms-and-conditions.html">Terms</a><a href="/docs/">Help</a><UsageAnalytics /></footer>
          </div>
        </section>
      </div>
    </main>
  );
}
