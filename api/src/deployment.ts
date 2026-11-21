import { dataEnvironment, dataRoot, deploymentTargets, firebaseProject } from '../shared/environment';

const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
const local = !process.env.GCLOUD_PROJECT && !process.env.K_SERVICE;
const configuredEnvironment = process.env.FINBUDDY_ENVIRONMENT ?? (emulator || local ? 'prod' : undefined);
export const environment = dataEnvironment(configuredEnvironment);
if (!emulator && !local && process.env.GCLOUD_PROJECT !== firebaseProject) {
  throw new Error('FinBuddy runs only in its shared Firebase project.');
}
export const dataNamespace = dataRoot(environment);
export const target = deploymentTargets[environment];
export const backendServiceName = process.env.FUNCTION_TARGET === target.audit ? 'finbuddy-expense-audit' : 'finbuddy-api';
export const isPreProduction = environment === 'preprod';
export const runtimeServiceAccount = emulator || local ? undefined : `${target.runtime}@${firebaseProject}.iam.gserviceaccount.com`;
export type DeploymentEnvironment = 'pre-production' | 'production';
export const telemetryEnvironment: DeploymentEnvironment = target.label;
export const backendTelemetryEnabled = !emulator && !local && Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT)
  && process.env.FINBUDDY_ENABLE_BACKEND_TELEMETRY === 'true';
export const telemetryAuthorization = target.secret;
export const storageBucket = emulator ? 'demo-finbuddy.appspot.com' : `${firebaseProject}.firebasestorage.app`;
