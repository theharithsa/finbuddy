import { performance } from 'node:perf_hooks';
import type { IncomingHttpHeaders } from 'node:http';
import { ROOT_CONTEXT, SpanKind, SpanStatusCode, context, propagation, trace, type Span } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { AggregationTemporality, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { error, warn } from 'firebase-functions/logger';
import { backendTelemetryEnabled, telemetryAuthorization, telemetryEnvironment } from './deployment';

const baseEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/+$/, '');
const traceEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  || (baseEndpoint && baseEndpoint + '/v1/traces');
const traceHeaders = process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS || process.env.OTEL_EXPORTER_OTLP_HEADERS;
const authorization = backendTelemetryEnabled ? process.env[telemetryAuthorization]?.trim() : undefined;
const stage = telemetryEnvironment ?? process.env.FINBUDDY_DEPLOYMENT_ENVIRONMENT;
const serviceName = process.env.FUNCTION_TARGET === 'finbuddyExpenseAudit' ? 'finbuddy-expense-audit' : 'finbuddy-api';
const timeoutMillis = 1500;
const traceUrlPattern = /^https:\/\/[a-z0-9-]+\.live\.dynatrace\.com\/api\/v2\/otlp\/v1\/traces$/;
const baseUrlPattern = /^https:\/\/[a-z0-9-]+\.live\.dynatrace\.com\/api\/v2\/otlp$/;

export const businessEventTarget = authorization && telemetryEnvironment && baseEndpoint && baseUrlPattern.test(baseEndpoint)
  ? { url: new URL('/api/v2/bizevents/ingest', baseEndpoint), authorization, environment: telemetryEnvironment }
  : undefined;

function makeRuntime() {
  if (process.env.FUNCTIONS_EMULATOR === 'true' || (!authorization && !traceHeaders) || !traceEndpoint) return;
  if (!traceUrlPattern.test(traceEndpoint)) {
    warn('FinBuddy API telemetry endpoint is invalid');
    return;
  }

  try {
    const resource = resourceFromAttributes({
      'service.name': serviceName,
      'service.namespace': 'finbuddy',
      'deployment.environment.name': stage === 'production' || stage === 'pre-production' ? stage : undefined,
      'cloud.provider': 'gcp',
      'cloud.platform': 'gcp_cloud_functions',
      'cloud.region': 'asia-south1',
      'cloud.account.id': process.env.GCLOUD_PROJECT,
      'service.version': process.env.K_REVISION,
      'build.commit': process.env.FINBUDDY_BUILD_COMMIT,
    });
    const headers = authorization ? { Authorization: authorization } : undefined;
    const traces = new NodeTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({
        url: traceEndpoint, headers, timeoutMillis,
      }), { maxExportBatchSize: 32, maxQueueSize: 128, exportTimeoutMillis: 2000 })],
    });
    if (!authorization || !baseEndpoint || !baseUrlPattern.test(baseEndpoint)) {
      traces.register();
      return { traces };
    }

    const logs = new LoggerProvider({
      resource,
      processors: [new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: baseEndpoint + '/v1/logs', headers, timeoutMillis }),
        maxExportBatchSize: 32, maxQueueSize: 128, exportTimeoutMillis: 2000,
      })],
    });
    const metrics = new MeterProvider({
      resource,
      readers: [new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: baseEndpoint + '/v1/metrics', headers, timeoutMillis,
          temporalityPreference: AggregationTemporality.DELTA,
        }),
        exportIntervalMillis: 30_000,
        exportTimeoutMillis: 2000,
      })],
    });
    const meter = metrics.getMeter(serviceName);
    traces.register();
    return {
      traces, logs, metrics,
      logger: logs.getLogger(serviceName),
      requestCount: meter.createCounter('finbuddy.api.requests', { unit: '{request}' }),
      requestDuration: meter.createHistogram('finbuddy.api.request.duration', { unit: 'ms' }),
    };
  } catch {
    warn('FinBuddy API telemetry could not initialize');
    return undefined;
  }
}

const runtime = makeRuntime();
const tracer = trace.getTracer(serviceName);

async function flush() {
  const results = await Promise.allSettled([
    runtime?.traces.forceFlush(), runtime?.logs?.forceFlush(), runtime?.metrics?.forceFlush(),
  ]);
  if (results.some(result => result.status === 'rejected')) warn('FinBuddy telemetry flush failed');
}

type Outcome = { status: number; errorType?: string };

export async function observe<T>(
  method: string,
  route: string,
  headers: IncomingHttpHeaders,
  outcome: () => Outcome,
  operation: () => Promise<T>,
) {
  const started = performance.now();
  const parent = propagation.extract(ROOT_CONTEXT, headers);
  return tracer.startActiveSpan(method + ' ' + route, {
    kind: SpanKind.SERVER,
    attributes: { 'http.request.method': method, 'http.route': route },
  }, parent, async span => {
    try {
      return await operation();
    } finally {
      try {
        const { status, errorType } = outcome();
        const duration = performance.now() - started;
        const attributes = {
          'http.request.method': method,
          'http.route': route,
          'http.response.status_code': status,
          ...(errorType && { 'error.type': errorType }),
        };
        span.setAttributes(attributes);
        if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
        runtime?.logger?.emit({
          body: 'FinBuddy API request completed',
          severityNumber: status >= 500 ? SeverityNumber.ERROR : status >= 400 ? SeverityNumber.WARN : SeverityNumber.INFO,
          attributes: { ...attributes, 'duration.ms': duration },
          context: context.active(),
        });
        runtime?.requestCount?.add(1, attributes);
        runtime?.requestDuration?.record(duration, attributes);
      } catch {
        warn('FinBuddy telemetry could not record the request');
      }
      span.end();
      if (runtime) await flush().catch(() => warn('FinBuddy telemetry flush failed'));
    }
  });
}

export async function observeExpenseAudit(operation: (span: Span) => Promise<void>) {
  return tracer.startActiveSpan('finbuddy.expense.audit', { kind: SpanKind.CONSUMER }, async span => {
    try {
      await operation(span);
    } catch (cause) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw cause;
    } finally {
      span.end();
      if (runtime) await flush().catch(() => warn('FinBuddy telemetry flush failed'));
    }
  });
}

export function reportFailure(operation: string) {
  error('FinBuddy API request failed', { operation });
}
