import { createHash } from 'node:crypto';
import { isSpanContextValid } from '@opentelemetry/api';
import { warn } from 'firebase-functions/logger';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { backendTelemetryEnabled, telemetryAuthorization } from './deployment';
import { businessEventTarget, observeExpenseAudit } from './telemetry';

const provider = 'finbuddy.expense-audit';
const maxDeliveryAgeMillis = 60 * 60 * 1000;

export const finbuddyExpenseAudit = backendTelemetryEnabled ? onDocumentWritten({
  document: 'users/{uid}/expenses/{expenseId}',
  region: 'asia-south1',
  retry: true,
  maxInstances: 1,
  timeoutSeconds: 15,
  memory: '256MiB',
  secrets: [telemetryAuthorization],
}, async event => {
  const target = businessEventTarget;
  if (!event.data || !target) {
    warn('FinBuddy expense event delivery is unavailable');
    return;
  }
  const occurredAt = Date.parse(event.time);
  if (!Number.isFinite(occurredAt) || Date.now() - occurredAt > maxDeliveryAgeMillis) {
    warn('FinBuddy expense event exceeded its delivery window');
    return;
  }
  const { before, after } = event.data;
  const action = after.exists ? before.exists ? 'updated' : 'created' : 'removed';
  const key = createHash('sha256').update(event.source).update('\0').update(event.id).digest('hex');

  await observeExpenseAudit(async span => {
    span.setAttribute('finbuddy.expense.change', action);
    const correlation = span.spanContext();
    const response = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/cloudevent+json',
        Authorization: target.authorization,
      },
      body: JSON.stringify({
        specversion: '1.0',
        id: key,
        source: provider,
        type: `finbuddy.expense.${action}`,
        time: new Date(occurredAt).toISOString(),
        data: {
          'event.id': key,
          'event.provider': provider,
          'event.authority': 'server-confirmed',
          'service.namespace': 'finbuddy',
          'service.name': 'finbuddy-expense-audit',
          'deployment.environment.name': target.environment,
          'schema.version': 1,
          'transaction.id': key,
          'finbuddy.expense.change': action,
          'correlation.origin': 'firestore-audit',
          ...(isSpanContextValid(correlation) && { trace_id: correlation.traceId, span_id: correlation.spanId }),
        },
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(2500),
    });
    await response.body?.cancel();
    if (response.status === 202) return;
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      throw new Error('FinBuddy expense event ingest is temporarily unavailable');
    }
    warn('FinBuddy expense event ingest rejected the event', { status: response.status });
  });
}) : undefined;
