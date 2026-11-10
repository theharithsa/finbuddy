import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { error, warn } from 'firebase-functions/logger';

function providerForEnvironment(): NodeTracerProvider | undefined {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  const headers = process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS;
  if (process.env.FUNCTIONS_EMULATOR === 'true' || !endpoint || !headers) return;
  try {
    const url = new URL(endpoint);
    if (!/^https:\/\/[a-z0-9-]+\.live\.dynatrace\.com\/api\/v2\/otlp\/v1\/traces$/.test(url.href)) {
      warn('FinBuddy API telemetry endpoint is invalid');
      return;
    }
    const provider = new NodeTracerProvider({
      resource: resourceFromAttributes({ 'service.name': 'finbuddy-api' }),
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: url.href, timeoutMillis: 1500 }), {
        maxExportBatchSize: 32, maxQueueSize: 128, exportTimeoutMillis: 2000,
      })],
    });
    provider.register();
    return provider;
  } catch {
    warn('FinBuddy API telemetry could not initialize');
    return undefined;
  }
}

const provider = providerForEnvironment();
const tracer = trace.getTracer('finbuddy-api');
export async function observe<T>(method: string, route: string, status: () => number, operation: () => Promise<T>) {
  return tracer.startActiveSpan(`${method} ${route}`, {
    kind: SpanKind.SERVER,
    attributes: { 'http.request.method': method, 'http.route': route },
  }, async (span) => {
    try {
      return await operation();
    } finally {
      const code = status();
      span.setAttribute('http.response.status_code', code);
      if (code >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      if (provider) await provider.forceFlush().catch(() => warn('FinBuddy API span flush failed'));
    }
  });
}

export function reportFailure(operation: string) {
  error('FinBuddy API request failed', { operation });
}
