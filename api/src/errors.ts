import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export function requestData<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    const fields = [...new Set(error.issues.map(({ path }) => String(path[0] ?? 'body')))];
    throw new ApiError(400, 'invalid_request', `Check these fields: ${fields.join(', ')}.`);
  }
}
