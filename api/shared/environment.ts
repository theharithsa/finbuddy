export type DataEnvironment = 'prod' | 'preprod';
export const firebaseProject = 'finbuddy-2025';
export const deploymentTargets = {
  prod: { site: 'finbuddy-2025', api: 'finbuddyApi', audit: 'finbuddyExpenseAudit',
    codebase: 'finbuddy-api', runtime: 'finbuddy-runtime-prod', release: 'finbuddy-release',
    secret: 'FINBUDDY_DT_INGEST_AUTHORIZATION', label: 'production' },
  preprod: { site: 'finbuddy-2025-preprod', api: 'finbuddyApiPreprod', audit: 'finbuddyExpenseAuditPreprod',
    codebase: 'finbuddy-api-preprod', runtime: 'finbuddy-runtime-preprod', release: 'finbuddy-release-preprod',
    secret: 'FINBUDDY_PREPROD_DT_INGEST_AUTHORIZATION', label: 'pre-production' },
} as const;

export function dataEnvironment(value: unknown): DataEnvironment {
  if (value !== 'prod' && value !== 'preprod') throw new Error('An explicit prod or preprod environment is required.');
  return value;
}

export function dataRoot(environment: DataEnvironment): string {
  return `${environment}/data`;
}

export function accountCanAccess(environment: DataEnvironment, claims: Record<string, unknown> | undefined): boolean {
  return environment === 'preprod' ? claims?.finbuddyPreprodAccess === true : claims?.finbuddyEnvironment !== 'preprod';
}
