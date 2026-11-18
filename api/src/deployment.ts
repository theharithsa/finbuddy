import { defineSecret } from 'firebase-functions/params';

export const preprodProject = 'finbuddy-preprod';
export const isPreProduction = process.env.GCLOUD_PROJECT === preprodProject;
export const preProductionTelemetryConfigured = isPreProduction && Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
export const telemetryAuthorization = defineSecret('FINBUDDY_DT_INGEST_AUTHORIZATION');
export const storageBucket = process.env.FUNCTIONS_EMULATOR === 'true'
  ? 'demo-finbuddy.appspot.com'
  : isPreProduction ? `${preprodProject}.firebasestorage.app` : 'finbuddy-2025.firebasestorage.app';
