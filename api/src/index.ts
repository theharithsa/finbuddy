import { pipeline } from 'node:stream/promises';
import { initializeApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onRequest, type Request, type Response } from 'firebase-functions/v2/https';
import { BillPaymentError } from '../shared/household';
import { DEFAULT_CATEGORIES, DEFAULT_INDIAN_APPS, getDefaultPeople } from '../shared/catalog';
import { documentId, pageQuery, paymentInput, resources, tokenCreate, tokenInfo, type ResourceName } from './contracts';
import { ApiError, requestData } from './errors';
import { backendTelemetryEnabled, isPreProduction, telemetryAuthorization } from './deployment';
import { idempotencyKey, monthQuery, openApi, operations, type Operation } from './openapi';
import { changeRecord, createRecord, getReceiptPath, getRecord, getSummary, indiaToday, listRecords, receiptBucket, recordPayment } from './records';
import { serveSwagger } from './swagger';
import { observe, reportFailure } from './telemetry';
import { authenticate, bearer, createToken, listTokens, requireRecentSignIn, revokeToken, sessionUser } from './tokens';

const app = initializeApp();
const db = getFirestore(app);
const auth = getAuth(app);
const spec = openApi();
const base = '/api/v1';

function matchPath(template: string, path: string): string | undefined {
  const actual = path.split('/');
  const expected = template.split('/');
  if (expected.length !== actual.length) return;
  let id = '';
  for (const [i, part] of expected.entries()) {
    if (part === '{id}') {
      if (!actual[i]) return;
      id = actual[i];
    } else if (part !== actual[i]) return;
  }
  return id;
}

function decodeId(encoded: string) {
  try {
    return requestData(documentId, decodeURIComponent(encoded));
  } catch {
    throw new ApiError(400, 'invalid_id', 'Use a valid record ID.');
  }
}

function notFound() { return new ApiError(404, 'not_found', 'That API route was not found.'); }

async function sendReceipt(user: UserRecord, id: string, response: Response) {
  const path = await getReceiptPath(db, user.uid, id);
  const bucket = getStorage(app).bucket(receiptBucket);
  const [metadata] = await bucket.file(path).getMetadata().catch((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 404) {
      throw new ApiError(404, 'receipt_not_found', 'No owner-scoped receipt was found.');
    }
    throw error;
  });
  const size = Number(metadata.size);
  if (!metadata.generation || !Number.isSafeInteger(size) || size < 1 || size > 10 * 1024 * 1024) {
    throw new ApiError(422, 'receipt_size', 'This receipt cannot be downloaded through the API.');
  }
  response.set('Content-Disposition', 'attachment; filename="finbuddy-receipt"').type('application/octet-stream');
  await pipeline(bucket.file(path, { generation: metadata.generation }).createReadStream({ decompress: false }), response);
}

function requestBody(request: Request): unknown {
  if (!request.is('application/json')) throw new ApiError(415, 'unsupported_media_type', 'Send application/json.');
  if (request.rawBody.length > 32 * 1024) throw new ApiError(413, 'body_too_large', 'JSON bodies are limited to 32 KiB.');
  return request.body;
}

function queryPage(request: Request) {
  const { limit, cursor } = requestData(pageQuery, request.query);
  return { limit: limit ? Number(limit) : 50, cursor };
}

async function dispatch(operation: Operation, request: Request, response: Response, id: string) {
  if (operation.access === 'public') {
    return jsonReply(response, 200, { status: 'ok' });
  }
  const token = bearer(request.get('Authorization'));
  if (operation.access === 'session') {
    const session = await sessionUser(auth, token);
    if (operation.id === 'list-tokens') {
      return jsonReply(response, 200, await listTokens(db, session.uid));
    }
    if (operation.id === 'create-token') {
      requireRecentSignIn(session);
      const body = requestData(tokenCreate, requestBody(request));
      return jsonReply(response, 201, await createToken(db, session.uid, body));
    }
    await revokeToken(db, session.uid, requestData(tokenInfo.shape.id, id));
    response.status(204);
    return () => response.end();
  }

  const user = await authenticate(db, auth, token, operation.access === 'write');
  switch (operation.id) {
    case 'profile':
      return jsonReply(response, 200, { uid: user.uid, name: user.displayName ?? null, email: user.email ?? null });
    case 'catalog':
      return jsonReply(response, 200, {
        categories: DEFAULT_CATEGORIES.map(({ name }) => name),
        platforms: DEFAULT_INDIAN_APPS.map(({ name, category }) => ({ name, category })),
        people: getDefaultPeople().map(({ id, name, relationship }) => ({ id, name, relationship })),
      });
    case 'summary': {
      const { month } = requestData(monthQuery, request.query);
      return jsonReply(response, 200, await getSummary(db, user.uid, month ?? indiaToday().slice(0, 7)));
    }
    case 'list-payments': {
      const { limit, cursor } = queryPage(request);
      return jsonReply(response, 200, await listRecords(db, user.uid, 'bill-payments', limit, cursor));
    }
    case 'record-payment':
      return jsonReply(response, 200, await recordPayment(db, user.uid, id, requestData(paymentInput, requestBody(request))));
    case 'download-receipt':
      await sendReceipt(user, id, response);
      return;
  }

  const route = operation.path.split('/')[1];
  if (!Object.hasOwn(resources, route)) throw notFound();
  const name = route as ResourceName;
  switch (operation.method) {
    case 'GET': {
      if (id) return jsonReply(response, 200, await getRecord(db, user.uid, name, id));
      const { limit, cursor } = queryPage(request);
      return jsonReply(response, 200, await listRecords(db, user.uid, name, limit, cursor));
    }
    case 'POST': {
      const key = requestData(idempotencyKey, request.get('Idempotency-Key'));
      const { created, data } = await createRecord(db, user, name, requestBody(request), key);
      return jsonReply(response, created ? 201 : 200, data);
    }
    case 'PATCH':
      return jsonReply(response, 200, await changeRecord(db, user.uid, name, id, { body: requestBody(request) }));
    case 'DELETE':
      await changeRecord(db, user.uid, name, id, { delete: true });
      response.status(204);
      return () => response.end();
  }
}

function jsonReply(response: Response, status: number, body: unknown) {
  response.status(status);
  return () => response.json(body);
}

function errorReply(error: unknown, response: Response, operation: string) {
  if (response.headersSent || response.destroyed) {
    reportFailure(operation);
    response.destroy();
    return;
  }
  const known = error instanceof ApiError ? error : error instanceof BillPaymentError
    ? new ApiError({ missing: 404, conflict: 409, invalid: 400 }[error.kind], `bill_${error.kind}`, error.message)
    : new ApiError(500, 'server_error', 'FinBuddy could not complete this request.');
  if (known.status === 500) reportFailure(operation);
  if (known.status === 401) response.set('WWW-Authenticate', 'Bearer');
  response.locals.finbuddyErrorType = known.code;
  return jsonReply(response, known.status, { error: { code: known.code, message: known.message } });
}

export const finbuddyApi = onRequest({
  region: 'asia-south1', invoker: 'public', maxInstances: isPreProduction ? 1 : 4, concurrency: 20,
  timeoutSeconds: 30, memory: '256MiB', secrets: backendTelemetryEnabled ? [telemetryAuthorization] : [],
}, async (request, response) => {
  response.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  const path = request.path.startsWith(`${base}/`) ? request.path.slice(base.length) : '';
  if (request.method === 'GET') {
    try {
      if (path === '/openapi.json') {
        response.json(spec);
        return;
      }
      if (await serveSwagger(path, response)) return;
    } catch (error) {
      errorReply(error, response, 'swagger')?.();
      return;
    }
  }
  for (const operation of operations) {
    if (operation.method !== request.method) continue;
    const match = matchPath(operation.path, path);
    if (match === undefined) continue;
    const reply = await observe(operation.method, `${base}${operation.path}`, request.headers, () => ({
      status: response.statusCode, errorType: response.locals.finbuddyErrorType,
    }), async () => {
      try {
        return await dispatch(operation, request, response, match ? decodeId(match) : '');
      } catch (error) {
        return errorReply(error, response, operation.id);
      }
    });
    try {
      reply?.();
    } catch (error) {
      errorReply(error, response, operation.id)?.();
    }
    return;
  }
  errorReply(notFound(), response, 'unknown')?.();
});

export { finbuddyExpenseAudit } from './expense-events';
