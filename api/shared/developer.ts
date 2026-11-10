import { z } from 'zod';

export const tokenCreate = z.strictObject({
  name: z.string().trim().min(1).max(60),
  access: z.enum(['read', 'read-write']),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]).nullable().describe('Lifetime in days. Use null for a token that never expires.'),
});
export const tokenInfo = z.object({
  id: z.string().regex(/^[a-f0-9]{32}$/),
  name: tokenCreate.shape.name, access: tokenCreate.shape.access,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable().describe('Expiration in UTC, or null for a token that never expires.'),
});
export const tokenCreated = tokenInfo.extend({ token: z.string().regex(/^fbp_[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/) });
