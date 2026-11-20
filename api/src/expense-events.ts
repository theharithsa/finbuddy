import { warn } from 'firebase-functions/logger';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { backendTelemetryEnabled, runtimeServiceAccount, telemetryAuthorization } from './deployment';
import { businessEventTarget, observeExpenseAudit } from './telemetry';
import { expenseEvent } from './expense-event-contract';

const maxDeliveryAgeMillis = 60 * 60 * 1000;

export const finbuddyExpenseAudit = backendTelemetryEnabled ? onDocumentWritten({
  serviceAccount: runtimeServiceAccount,
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

  await observeExpenseAudit(async span => {
    span.setAttribute('finbuddy.expense.change', action);
    const correlation = span.spanContext();
    const response = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/cloudevent+json',
        Authorization: target.authorization,
      },
      body: JSON.stringify(expenseEvent(event.source, event.id, occurredAt, action, target.environment,
        correlation, process.env.FINBUDDY_BUILD_COMMIT, /^finbuddy-release-[a-f0-9-]{36}$/.test(event.params.uid))),
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
