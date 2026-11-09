import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ChartNoAxesCombined, LockKeyhole, ReceiptText, Wallet, WalletCards } from 'lucide-react';
import { checkMagicLinkOnLoad, resetPassword, sendMagicLink, signInWithEmail, signInWithGoogle, signInWithMagicLink, signUpWithEmail } from '@/lib/firebase';
import { UsageAnalytics } from './UsageAnalytics';
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
  return <div className="fb-wordmark"><span><WalletCards size={20} strokeWidth={2.1} /></span><strong>FinBuddy</strong></div>;
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
    case 'auth/unauthorized-domain': return 'Google sign-in is unavailable on this address. Open the main FinBuddy site.';
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
    <main className="fb-login">
      <section className="fb-login-story">
        <Wordmark />
        <div className="fb-story-body">
          <p className="fb-kicker"><span /> PERSONAL FINANCE WORKSPACE</p>
          <h1>Know where<br />your money goes<span>.</span></h1>
          <p>Log everyday spending, set category budgets and see how the month adds up.</p>
          <ul>
            <li><ReceiptText size={19} /><span><strong>Everyday expenses</strong><small>Keep purchases, people and receipts together.</small></span></li>
            <li><Wallet size={19} /><span><strong>Monthly budgets</strong><small>See what’s left before the month ends.</small></span></li>
            <li><ChartNoAxesCombined size={19} /><span><strong>Spending insights</strong><small>Spot the categories that take the biggest share.</small></span></li>
          </ul>
        </div>
        <p className="fb-story-lock"><LockKeyhole size={15} /> Your workspace is tied to your account.</p>
      </section>
      <section className="fb-login-access" aria-labelledby="login-heading">
        <div className="fb-login-inner">
          <div className="fb-mobile-wordmark"><Wordmark /></div>
          <p className="fb-kicker">PERSONAL WORKSPACE</p>
          <h2 id="login-heading">{headings[mode]}</h2>
          <p>{mode === 'signin' ? 'Sign in to open your finance workspace.' : 'Use the email address for your FinBuddy account.'}</p>
          {mode === 'signin' && <>
            <button className="fb-button fb-secondary fb-google" type="button" disabled={busy} onClick={google}><span aria-hidden="true">G</span> Continue with Google</button>
            <div className="fb-login-divider"><span>or use email</span></div>
          </>}
          <form key={mode} onSubmit={submit}>
            {mode === 'signup' && <label>Name<input name="name" autoComplete="name" required maxLength={80} /></label>}
            <label>Email<input type="email" name="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            {(mode === 'signin' || mode === 'signup') && <label>Password<input name="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 6 : undefined} required /></label>}
            {error && <p className="fb-auth-error" role="alert">{error}</p>}
            {status && <p className="fb-auth-status" role="status">{status}</p>}
            <button className="fb-button fb-primary" disabled={busy} type="submit">{busy ? 'Please wait…' : submitLabels[mode]}<ArrowRight size={17} /></button>
          </form>
          <div className="fb-login-links">
            {mode === 'signin' ? <>
              <button disabled={busy} onClick={() => changeMode('signup')}>Create account</button>
              <button disabled={busy} onClick={() => changeMode('reset')}>Forgot password?</button>
              <button disabled={busy} onClick={() => changeMode('link')}>Email me a sign-in link</button>
            </> : <button disabled={busy} onClick={() => changeMode('signin')}>Back to sign in</button>}
          </div>
          <footer className="fb-login-legal"><a href="/docs/privacy-policy.html">Privacy</a><a href="/docs/terms-and-conditions.html">Terms</a><a href="/docs/">Help</a><UsageAnalytics /></footer>
        </div>
      </section>
    </main>
  );
}
