export const preprodProject = 'finbuddy-preprod';
const productionProject = 'finbuddy-2025';
const project = process.env.GCLOUD_PROJECT;
const isProduction = project === productionProject;
export const isPreProduction = project === preprodProject;
export const telemetryEnvironment = isPreProduction ? 'pre-production' : isProduction ? 'production' : undefined;
export const backendTelemetryEnabled = process.env.FUNCTIONS_EMULATOR !== 'true'
  && Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT)
  && (isPreProduction || (isProduction && process.env.FINBUDDY_ENABLE_BACKEND_TELEMETRY === 'true'));
export const telemetryAuthorization = 'FINBUDDY_DT_INGEST_AUTHORIZATION';
export const storageBucket = process.env.FUNCTIONS_EMULATOR === 'true'
  ? 'demo-finbuddy.appspot.com'
  : isPreProduction ? `${preprodProject}.firebasestorage.app` : `${productionProject}.firebasestorage.app`;
