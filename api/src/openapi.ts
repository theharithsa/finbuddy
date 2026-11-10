import { z } from 'zod';
import { tokenCreated } from '../shared/developer';
import { catalogOutput, documentId, errorOutput, month, pageQuery, paymentInput, paymentOutput, paymentResult, profileOutput, resourceOutput, resources, summaryOutput, tokenCreate, tokenInfo } from './contracts';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type Access = 'read' | 'write' | 'session' | 'public';
type Parameter = { name: string; in: 'path' | 'query' | 'header'; required?: boolean; schema: z.ZodType };
export type Operation = {
  id: string; method: Method; path: string; tag: string; summary: string; access: Access;
  request?: z.ZodType; response?: z.ZodType; status?: number; parameters?: Parameter[]; replay?: boolean; binary?: boolean;
};
const recordId: Parameter = { name: 'id', in: 'path', required: true, schema: documentId };
const limit: Parameter = { name: 'limit', in: 'query', schema: pageQuery.shape.limit };
const cursor: Parameter = { name: 'cursor', in: 'query', schema: pageQuery.shape.cursor };
export const idempotencyKey = z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/);
const key: Parameter = { name: 'Idempotency-Key', in: 'header', required: true, schema: idempotencyKey };
const page = (item: z.ZodType) => z.object({ items: z.array(item), nextCursor: documentId.nullable() });

function crud(name: string, entry: (typeof resources)[keyof typeof resources]): Operation[] {
  const tag = entry.label;
  const path = `/${name}`;
  const item = resourceOutput(entry);
  return [
    { id: `list-${name}`, method: 'GET', path, tag, summary: 'List owned records', access: 'read', response: page(item), parameters: [limit, cursor] },
    { id: `create-${name}`, method: 'POST', path, tag, summary: 'Create a record using an idempotency key', access: 'write', request: entry.write, response: item, parameters: [key], status: 201, replay: true },
    { id: `get-${name}`, method: 'GET', path: `${path}/{id}`, tag, summary: 'Get an owned record', access: 'read', response: item, parameters: [recordId] },
    { id: `update-${name}`, method: 'PATCH', path: `${path}/{id}`, tag, summary: 'Update fields on an owned record', access: 'write', request: entry.write.partial(), response: item, parameters: [recordId] },
    { id: `delete-${name}`, method: 'DELETE', path: `${path}/{id}`, tag, summary: 'Delete an owned record', access: 'write', parameters: [recordId], status: 204 },
  ];
}

export const operations: Operation[] = [
  { id: 'health', method: 'GET', path: '/health', tag: 'Service', summary: 'Check API availability', access: 'public', response: z.object({ status: z.literal('ok') }) },
  { id: 'profile', method: 'GET', path: '/profile', tag: 'Account', summary: 'Get the current account', access: 'read', response: profileOutput },
  { id: 'catalog', method: 'GET', path: '/catalog', tag: 'Account', summary: 'Get built-in categories, platforms and people', access: 'read', response: catalogOutput },
  { id: 'summary', method: 'GET', path: '/summary', tag: 'Account', summary: 'Get an INR monthly summary in paise', access: 'read', response: summaryOutput, parameters: [{ name: 'month', in: 'query', schema: month }] },
  ...Object.entries(resources).flatMap(([name, entry]) => crud(name, entry)),
  { id: 'list-payments', method: 'GET', path: '/bill-payments', tag: 'Bills', summary: 'List ledger links for recorded bill payments', access: 'read', response: page(paymentOutput), parameters: [limit, cursor] },
  { id: 'record-payment', method: 'POST', path: '/bills/{id}/payments', tag: 'Bills', summary: 'Record one payment per occurrence or link an existing expense', access: 'write', request: paymentInput, response: paymentResult, parameters: [recordId] },
  { id: 'download-receipt', method: 'GET', path: '/expenses/{id}/receipt', tag: 'Expenses', summary: 'Download an owner-scoped expense receipt', access: 'read', binary: true, parameters: [recordId] },
  { id: 'list-tokens', method: 'GET', path: '/developer/tokens', tag: 'Developer Options', summary: 'List active tokens using a Firebase sign-in session', access: 'session', response: z.array(tokenInfo) },
  { id: 'create-token', method: 'POST', path: '/developer/tokens', tag: 'Developer Options', summary: 'Create and reveal an API token once', access: 'session', request: tokenCreate, response: tokenCreated, status: 201 },
  { id: 'revoke-token', method: 'DELETE', path: '/developer/tokens/{id}', tag: 'Developer Options', summary: 'Revoke a token for the signed-in account', access: 'session', parameters: [{ ...recordId, schema: tokenInfo.shape.id }], status: 204 },
];

function schema(value: z.ZodType) {
  const { $schema: _dialect, ...definition } = z.toJSONSchema(value, { io: 'input', unrepresentable: 'any' });
  return definition;
}

const json = (value: z.ZodType) => ({ 'application/json': { schema: schema(value) } });
const errorResponses = Object.fromEntries(Object.entries({
  400: 'Invalid request', 401: 'Authentication required', 403: 'Access denied', 404: 'Record unavailable',
  409: 'Conflict', 413: 'Request too large', 415: 'Expected a JSON body', 422: 'Query limit exceeded', 500: 'Unexpected error',
}).map(([code, description]) => [code, { description, content: json(errorOutput) }]));

export function openApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const operation of operations) {
    const status = operation.status ?? 200;
    const content = operation.response ? json(operation.response)
      : operation.binary ? { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } }
      : undefined;
    const success = { description: status === 204 ? 'No content' : 'Success', ...(content && { content }) };
    const path = paths[operation.path] ??= {};
    path[operation.method.toLowerCase()] = {
      operationId: operation.id, tags: [operation.tag], summary: operation.summary,
      ...(operation.access === 'write' && { description: 'Requires a read/write API token.' }),
      security: operation.access === 'public' ? [] : [{ [operation.access === 'session' ? 'FirebaseSession' : 'FinBuddyToken']: [] }],
      ...(operation.parameters && { parameters: operation.parameters.map((parameter) => ({ ...parameter, schema: schema(parameter.schema) })) }),
      ...(operation.request && { requestBody: { required: true, content: json(operation.request) } }),
      responses: { ...errorResponses, [status]: success, ...(operation.replay && { 200: { ...success, description: 'Existing result for this idempotency key' } }) },
    };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'FinBuddy API', version: '1.0.0', description: 'Integrate your FinBuddy account using a token from Settings → Developer Options. Use a unique idempotency key for each create. Expense and budget amounts use INR. Household and summary amounts use integer paise.' },
    servers: [{ url: '/api/v1' }],
    paths,
    components: { securitySchemes: {
      FinBuddyToken: { type: 'http', scheme: 'bearer', description: 'FinBuddy personal API token.' },
      FirebaseSession: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Current Firebase ID token. Developer Options handles this automatically.' },
    } },
  };
}

export const monthQuery = z.strictObject({ month: month.optional() });
