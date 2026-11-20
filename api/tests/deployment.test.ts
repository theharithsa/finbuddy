import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

const modulePath = require.resolve('../src/deployment');
const endpoint = 'https://example.live.dynatrace.com/api/v2/otlp';

function inspect(environment: NodeJS.ProcessEnv) {
  const policy = `const config = require(process.argv[1]);
    process.stdout.write(JSON.stringify({
      enabled: config.backendTelemetryEnabled,
      environment: config.telemetryEnvironment ?? null,
    }));`;
  return JSON.parse(execFileSync(process.execPath, ['-e', policy, modulePath], {
    encoding: 'utf8',
    env: environment,
  }));
}

test('production observability requires its own explicit activation', () => {
  const production = { GCLOUD_PROJECT: 'finbuddy-2025', OTEL_EXPORTER_OTLP_ENDPOINT: endpoint };
  const enabled = { ...production, FINBUDDY_ENABLE_BACKEND_TELEMETRY: 'true' };
  assert.deepEqual(inspect(production), { enabled: false, environment: 'production' });
  assert.deepEqual(inspect(enabled), { enabled: true, environment: 'production' });
  assert.deepEqual(inspect({ ...enabled, OTEL_EXPORTER_OTLP_ENDPOINT: '' }), {
    enabled: false, environment: 'production',
  });
  assert.deepEqual(inspect({ ...enabled, FUNCTIONS_EMULATOR: 'true' }), {
    enabled: false, environment: 'production',
  });
  assert.deepEqual(inspect({ ...enabled, GCLOUD_PROJECT: 'unrelated-firebase-project' }), {
    enabled: false, environment: null,
  });
});

test('pre-production retains its separate telemetry activation', () => {
  const staging = { GCLOUD_PROJECT: 'finbuddy-preprod', OTEL_EXPORTER_OTLP_ENDPOINT: endpoint };
  assert.deepEqual(inspect(staging), { enabled: true, environment: 'pre-production' });
  assert.deepEqual(inspect({ ...staging, FUNCTIONS_EMULATOR: 'true' }), {
    enabled: false, environment: 'pre-production',
  });
});

test('runtime identity stays within the selected project and emulators use no live identity', () => {
  const script = 'process.stdout.write(require(process.argv[1]).runtimeServiceAccount ?? "none")';
  for (const project of ['finbuddy-preprod', 'finbuddy-2025']) {
    const read = (environment: NodeJS.ProcessEnv) => execFileSync(process.execPath, ['-e', script, modulePath], {
      encoding: 'utf8', env: environment,
    });
    assert.equal(read({ GCLOUD_PROJECT: project }), `finbuddy-runtime@${project}.iam.gserviceaccount.com`);
    assert.equal(read({ GCLOUD_PROJECT: project, FUNCTIONS_EMULATOR: 'true' }), 'none');
    assert.equal(read({ GCLOUD_PROJECT: 'another-project' }), 'none');
  }
});
