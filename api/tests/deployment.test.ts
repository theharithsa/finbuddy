import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { accountCanAccess } from '../shared/environment';

const modulePath = require.resolve('../src/deployment');
const endpoint = 'https://example.live.dynatrace.com/api/v2/otlp';
function inspect(extra: NodeJS.ProcessEnv) {
  const script = `const c = require(process.argv[1]); process.stdout.write(JSON.stringify({
    enabled:c.backendTelemetryEnabled, environment:c.telemetryEnvironment, namespace:c.dataNamespace,
    identity:c.runtimeServiceAccount ?? null, secret:c.telemetryAuthorization, api:c.target.api, service:c.backendServiceName
  }));`;
  return JSON.parse(execFileSync(process.execPath, ['-e', script, modulePath], {
    encoding: 'utf8', env: { GCLOUD_PROJECT: 'finbuddy-2025', ...extra }, stdio: ['ignore', 'pipe', 'pipe'],
  })) as { enabled: boolean; environment: string; namespace: string; identity: string | null; secret: string; api: string; service: string };
}
test('one project has distinct environment roots, backend names and identities', () => {
  const prod = inspect({ FINBUDDY_ENVIRONMENT: 'prod' });
  const preprod = inspect({ FINBUDDY_ENVIRONMENT: 'preprod' });
  assert.equal(prod.namespace, 'prod/data');
  assert.equal(preprod.namespace, 'preprod/data');
  assert.equal(prod.api, 'finbuddyApi');
  assert.equal(preprod.api, 'finbuddyApiPreprod');
  assert.equal(prod.identity, 'finbuddy-runtime-prod@finbuddy-2025.iam.gserviceaccount.com');
  assert.equal(preprod.identity, 'finbuddy-runtime-preprod@finbuddy-2025.iam.gserviceaccount.com');
  assert.notEqual(prod.secret, preprod.secret);
  assert.equal(inspect({ FINBUDDY_ENVIRONMENT: 'preprod', FUNCTION_TARGET: 'finbuddyExpenseAuditPreprod' }).service, 'finbuddy-expense-audit');
});
test('live functions reject missing, invalid and wrong-project configuration', () => {
  for (const FINBUDDY_ENVIRONMENT of [undefined, '', 'production', 'other']) {
    assert.throws(() => inspect({ FINBUDDY_ENVIRONMENT }));
  }
  assert.throws(() => inspect({ FINBUDDY_ENVIRONMENT: 'prod', GCLOUD_PROJECT: 'finbuddy-preprod' }));
});
test('telemetry needs explicit activation; emulators never bind live identity or export', () => {
  for (const FINBUDDY_ENVIRONMENT of ['prod', 'preprod']) {
    const config = { FINBUDDY_ENVIRONMENT, OTEL_EXPORTER_OTLP_ENDPOINT: endpoint };
    assert.equal(inspect(config).enabled, false);
    assert.equal(inspect({ ...config, FINBUDDY_ENABLE_BACKEND_TELEMETRY: 'true' }).enabled, true);
    const local = inspect({ ...config, FINBUDDY_ENABLE_BACKEND_TELEMETRY: 'true', FUNCTIONS_EMULATOR: 'true' });
    assert.equal(local.enabled, false);
    assert.equal(local.identity, null);
  }
});
test('synthetic preprod accounts cannot authenticate to production', () => {
  const staging = { finbuddyPreprodAccess: true, finbuddyEnvironment: 'preprod' };
  assert.equal(accountCanAccess('preprod', staging), true);
  assert.equal(accountCanAccess('prod', staging), false);
  assert.equal(accountCanAccess('prod', undefined), true);
  assert.equal(accountCanAccess('preprod', undefined), false);
  assert.equal(accountCanAccess('preprod', { finbuddyPreprodAccess: 'true' }), false);
});
