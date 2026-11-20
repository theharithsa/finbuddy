import { createHash } from 'node:crypto';
import { isSpanContextValid, type SpanContext } from '@opentelemetry/api';

export function expenseEvent(source: string, id: string, occurredAt: number, change: 'created' | 'updated' | 'removed',
  environment: 'production' | 'pre-production', correlation: SpanContext, commit?: string, synthetic = false) {
  const key = createHash('sha256').update(source).update('\0').update(id).digest('hex');
  return {
    specversion: '1.0', id: key, source: 'finbuddy.expense-audit', type: `finbuddy.expense.${change}`,
    time: new Date(occurredAt).toISOString(), data: {
      'event.id': key, 'event.provider': 'finbuddy.expense-audit', 'event.authority': 'server-confirmed',
      'service.namespace': 'finbuddy', 'service.name': 'finbuddy-expense-audit',
      'deployment.environment.name': environment, 'schema.version': 1, 'transaction.id': key,
      'finbuddy.expense.change': change, 'correlation.origin': 'firestore-audit',
      'test.synthetic': synthetic,
      ...(commit && /^[a-f0-9]{40}$/.test(commit) ? { 'build.commit': commit } : {}),
      ...(isSpanContextValid(correlation) ? { trace_id: correlation.traceId, span_id: correlation.spanId } : {}),
    },
  };
}
