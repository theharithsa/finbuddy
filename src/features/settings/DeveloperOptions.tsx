import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { tokenCreate, tokenCreated, tokenInfo } from '../../../api/shared/developer';

const endpoint = '/api/v1/developer/tokens';
const failure = z.object({ error: z.object({ message: z.string() }) });
const tokenList = z.array(tokenInfo);
type Token = z.infer<typeof tokenInfo>;

async function tokenRequest(user: User, path = '', options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${endpoint}${path}`, {
    ...options,
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (response.status === 204) return;
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Developer Options is unavailable. Try again when the API is online.');
  }
  const body: unknown = await response.json();
  if (!response.ok) {
    const parsed = failure.safeParse(body);
    throw new Error(parsed.success ? parsed.data.error.message : 'FinBuddy could not complete the request.');
  }
  return body;
}

const displayDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });
function accessLabel(access: Token['access']) { return access === 'read' ? 'Read only' : 'Read and write'; }
function message(error: unknown) { return error instanceof Error && !(error instanceof z.ZodError) ? error.message : 'Try again in a moment.'; }

function TokenManager({ user }: { user: User }) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [revealed, setRevealed] = useState<string>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toRevoke, setToRevoke] = useState<Token>();
  const lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const secret = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const request = new AbortController();
    tokenRequest(user, '', { signal: request.signal }).then((value) => {
      if (!request.signal.aborted) setTokens(tokenList.parse(value));
    }).catch((cause: unknown) => {
      if (!request.signal.aborted) setError(message(cause));
    }).finally(() => {
      if (!request.signal.aborted) setLoading(false);
    });
    return () => request.abort();
  }, [user]);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (cause) {
      setError(message(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const data = tokenCreate.safeParse({
      name: fields.get('name'), access: fields.get('access'), days: Number(fields.get('days')),
    });
    if (!data.success) { setError('Enter a name and choose the token access and expiry.'); return; }
    void run(async () => {
      const { token, ...info } = tokenCreated.parse(await tokenRequest(user, '', { method: 'POST', body: JSON.stringify(data.data) }));
      setTokens((current) => [info, ...current]);
      setRevealed(token);
      form.current?.reset();
      setNotice('Token generated. Copy it before closing this section.');
    });
  }

  function revoke() {
    if (!toRevoke) return;
    const id = toRevoke.id;
    setToRevoke(undefined);
    void run(async () => {
      await tokenRequest(user, `/${id}`, { method: 'DELETE' });
      setTokens((current) => current.filter((token) => token.id !== id));
      if (revealed?.startsWith(`fbp_${id}.`)) setRevealed(undefined);
      setNotice('Token revoked.');
    });
  }

  async function copy() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed);
      setNotice('Token copied.');
    } catch {
      secret.current?.focus();
      secret.current?.select();
      setNotice('Copy the selected token.');
    }
  }

  return (
    <div className="developer-content">
      <p>Create a token for a script or integration you trust. Start with read-only access.</p>
      <a href="/api/v1/docs" target="_blank" rel="noopener noreferrer">Open Swagger API reference</a>
      <form className="developer-form" ref={form} onSubmit={create}>
        <label className="m3-field"><span>Token name</span><input name="name" placeholder="Monthly expense export" maxLength={60} required /></label>
        <label className="m3-field"><span>Access</span><select name="access" defaultValue="read"><option value="read">Read only</option><option value="read-write">Read and write</option></select></label>
        <label className="m3-field"><span>Expires in</span><select name="days" defaultValue="30"><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
        <Button type="submit" disabled={busy || loading}>Generate token</Button>
      </form>
      {revealed && (
        <div className="developer-reveal">
          <label className="m3-field"><span>Copy this token now. FinBuddy shows it only once.</span>
            <input ref={secret} value={revealed} readOnly autoComplete="off" spellCheck={false} />
          </label>
          <div className="developer-actions">
            <Button variant="outline" onClick={() => void copy()}>Copy token</Button>
            <Button variant="ghost" onClick={() => { setRevealed(undefined); setNotice(''); }}>Hide token</Button>
          </div>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <h3>Active tokens</h3>
      {loading ? <p role="status">Loading tokens…</p> : tokens.length === 0 ? (!error && <p>No active tokens.</p>) : (
        <ul className="developer-tokens">
          {tokens.map((token) => (
            <li key={token.id}>
              <div><strong>{token.name}</strong><p>{accessLabel(token.access)} · Expires {displayDate.format(new Date(token.expiresAt))}</p></div>
              <Button variant="ghost" disabled={busy} onClick={() => setToRevoke(token)} aria-label={`Revoke ${token.name}`}>Revoke</Button>
            </li>
          ))}
        </ul>
      )}
      <AlertDialog open={Boolean(toRevoke)} onOpenChange={(open) => { if (!open) setToRevoke(undefined); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {toRevoke?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Integrations using this token will lose access immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={revoke}>Revoke token</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function DeveloperOptions({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="m3-panel developer-options" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Developer Options</summary>
      {open && <TokenManager key={user.uid} user={user} />}
    </details>
  );
}
