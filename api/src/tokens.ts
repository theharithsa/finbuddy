import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Auth, DecodedIdToken, UserRecord } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { documentId, tokenCreate, tokenInfo } from './contracts';
import { ApiError } from './errors';

const maxTokens = 10;
const tokenPattern = /^fbp_([a-f0-9]{32})\.([A-Za-z0-9_-]{43})$/;
const storedToken = tokenInfo.extend({ owner: documentId, digest: z.string().regex(/^[a-f0-9]{64}$/) });
const ownerTokens = z.object({ tokens: z.array(tokenInfo).max(maxTokens) });
type Token = z.infer<typeof tokenInfo>;
type Access = Token['access'];

function invalidToken() {
  return new ApiError(401, 'invalid_token', 'Provide an active FinBuddy API token.');
}

export function bearer(header: string | undefined): string {
  const match = header?.match(/^Bearer ([^\s,]{1,4096})$/i);
  if (!match) throw invalidToken();
  return match[1];
}

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function sessionUser(auth: Auth, token: string): Promise<DecodedIdToken> {
  if (token.split('.').length !== 3) throw new ApiError(401, 'sign_in_required', 'Sign in to FinBuddy to manage tokens.');
  try {
    const session = await auth.verifyIdToken(token, true);
    if (!documentId.safeParse(session.uid).success) throw new Error('Invalid UID');
    return session;
  } catch {
    throw new ApiError(401, 'sign_in_required', 'Sign in to FinBuddy to manage tokens.');
  }
}

export function requireRecentSignIn(session: DecodedIdToken, now = Date.now()): void {
  if (now - session.auth_time * 1000 > 15 * 60 * 1000) {
    throw new ApiError(403, 'recent_sign_in_required', 'Sign out and sign back in before generating an API token.');
  }
}

export async function authenticate(db: Firestore, auth: Auth, token: string, write: boolean): Promise<UserRecord> {
  const parts = tokenPattern.exec(token);
  if (!parts) throw invalidToken();
  const row = storedToken.safeParse((await db.collection('finbuddyApiTokens').doc(parts[1]).get()).data());
  if (!row.success || Date.parse(row.data.expiresAt) <= Date.now() ||
      !timingSafeEqual(Buffer.from(row.data.digest, 'hex'), Buffer.from(digest(token), 'hex'))) throw invalidToken();
  if (write && row.data.access !== 'read-write') {
    throw new ApiError(403, 'insufficient_access', 'This API token is read-only.');
  }
  let user: UserRecord;
  try {
    user = await auth.getUser(row.data.owner);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/user-not-found') throw invalidToken();
    throw error;
  }
  if (user.disabled || Date.parse(user.tokensValidAfterTime ?? '') > Date.parse(row.data.createdAt)) throw invalidToken();
  return user;
}

function readTokens(value: unknown): Token[] {
  return value === undefined ? [] : ownerTokens.parse(value).tokens;
}
function active(tokens: Token[], now: number): Token[] {
  return tokens.filter((token) => Date.parse(token.expiresAt) > now);
}

export async function listTokens(db: Firestore, uid: string): Promise<Token[]> {
  const doc = await db.collection('finbuddyDeveloper').doc(uid).get();
  return active(readTokens(doc.data()), Date.now());
}

export async function createToken(db: Firestore, uid: string, input: z.infer<typeof tokenCreate>) {
  const id = randomBytes(16).toString('hex');
  const token = `fbp_${id}.${randomBytes(32).toString('base64url')}`;
  const now = Date.now();
  const access: Access = input.access;
  const info = { id, name: input.name, access, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + input.days * 86_400_000).toISOString() };
  const owner = db.collection('finbuddyDeveloper').doc(uid);
  const lookup = db.collection('finbuddyApiTokens');
  await db.runTransaction(async (tx) => {
    const all = readTokens((await tx.get(owner)).data());
    const tokens = active(all, now);
    if (tokens.length >= maxTokens) throw new ApiError(409, 'token_limit', 'Revoke a token before creating another.');
    for (const old of all) {
      if (Date.parse(old.expiresAt) <= now) tx.delete(lookup.doc(old.id));
    }
    tx.create(lookup.doc(id), { ...info, owner: uid, digest: digest(token) });
    tx.set(owner, { tokens: [info, ...tokens] });
  });
  return { ...info, token };
}

export async function revokeToken(db: Firestore, uid: string, id: string): Promise<void> {
  const owner = db.collection('finbuddyDeveloper').doc(uid);
  await db.runTransaction(async (tx) => {
    const tokens = readTokens((await tx.get(owner)).data());
    if (!tokens.some((token) => token.id === id)) return;
    tx.delete(db.collection('finbuddyApiTokens').doc(id));
    tx.set(owner, { tokens: tokens.filter((token) => token.id !== id) });
  });
}
