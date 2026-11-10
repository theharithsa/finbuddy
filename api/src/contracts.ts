import { z } from 'zod';
import { billSchema, holdingSchema, householdPaths, incomeSchema, maxPaise, paymentSchema } from '../shared/household';
export { tokenCreate, tokenInfo } from '../shared/developer';

export function hasControlCharacters(value: string): boolean {
  return [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
}

export const documentId = z.string().min(1).max(320)
  .refine((value) => value !== '.' && value !== '..' && !value.includes('/') && !hasControlCharacters(value) && !/^__.*__$/.test(value));
export const day = z.iso.date();
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const pageQuery = z.strictObject({
  limit: z.string().regex(/^([1-9]\d?|100)$/).optional(),
  cursor: documentId.optional(),
});

const title = z.string().trim().min(1).max(100);
const text = z.string().trim().max(1000);
const inr = z.number().positive().max(maxPaise / 100)
  .refine((value) => Number((Math.round(value * 100) / 100).toFixed(2)) === value)
  .describe('Amount in INR with up to two decimal places');
const decorated = {
  name: title,
  color: z.string().max(60).regex(/^(?:#[\da-f]{6}|oklch\([01](?:\.\d+)? \d(?:\.\d+)? \d{1,3}(?:\.\d+)?\))$/i),
  icon: z.string().trim().min(1).max(80),
};
const budget = z.strictObject({ category: title, limit: inr });

export const expenseWrite = z.strictObject({
  amount: inr, category: title, description: text, date: day,
  peopleIds: z.array(documentId).max(30).optional(), app: z.string().max(80).optional(),
});
const budgetTemplate = z.strictObject({
  name: title, description: text, budgets: z.array(budget.extend({ percentage: z.number().min(0).max(100).optional() })).min(1).max(50),
  incomeLevel: z.enum(['low', 'medium', 'high', 'custom']), tags: z.array(title).max(20),
});

type Resource = {
  collection: string;
  label: string;
  write: z.ZodObject;
  extras?: z.ZodObject;
  privateOnly?: true;
};
const created = z.object({ createdAt: z.string() });
const shareMetadata = created.extend({ isPublic: z.boolean(), createdBy: z.string() });
export const resources = {
  expenses: { collection: 'expenses', label: 'Expenses', write: expenseWrite, extras: created.extend({
    hasReceipt: z.boolean(), billPaymentKey: z.string(),
  }) },
  budgets: { collection: 'budgets', label: 'Budgets', write: budget, extras: z.object({ spent: z.number() }) },
  categories: { collection: 'customCategories', label: 'Categories', write: z.strictObject(decorated), extras: shareMetadata, privateOnly: true },
  people: { collection: 'customPeople', label: 'People', write: z.strictObject({ ...decorated, relationship: z.string().max(80).optional() }), extras: shareMetadata, privateOnly: true },
  'bill-templates': { collection: 'templates', label: 'Bill templates', write: z.strictObject({
    name: title, amount: inr, category: title, description: text,
    frequency: z.enum(['weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly']), isDefault: z.boolean().optional(),
  }), extras: created },
  'budget-templates': { collection: 'budgetTemplates', label: 'Budget templates', write: budgetTemplate,
    extras: shareMetadata.extend({ totalBudget: z.number(), usageCount: z.number() }), privateOnly: true },
  income: { collection: householdPaths.income, label: 'Income', write: incomeSchema.strict() },
  bills: { collection: householdPaths.bills, label: 'Bills', write: billSchema.strict() },
  holdings: { collection: householdPaths.holdings, label: 'Holdings', write: holdingSchema.strict() },
} satisfies Record<string, Resource>;

export type ResourceName = keyof typeof resources;
export function resource(name: ResourceName): Resource { return resources[name]; }
export function resourceOutput(entry: Resource) {
  return z.object({ ...entry.write.partial().shape, ...entry.extras?.partial().shape, id: documentId });
}

export const paymentOutput = paymentSchema.extend({ id: documentId });
export const paymentInput = z.union([
  z.strictObject({ dueDate: day, expenseId: documentId }),
  z.strictObject({ dueDate: day, amountPaise: incomeSchema.shape.amountPaise, date: day }),
]);
export const paymentResult = z.object({ status: z.enum(['recorded', 'already-recorded']), expenseId: documentId });
export const profileOutput = z.object({ uid: z.string(), name: z.string().nullable(), email: z.string().nullable() });
export const catalogOutput = z.object({
  categories: z.array(z.string()),
  platforms: z.array(z.object({ name: z.string(), category: z.string() })),
  people: z.array(z.object({ id: documentId, name: z.string(), relationship: z.string() })),
});
export const summaryOutput = z.object({
  month, currency: z.literal('INR'), expenseCount: z.number().int(),
  spendingPaise: z.number().int(), incomePaise: z.number().int(), holdingsPaise: z.number().int(),
  budgetPaise: z.number().int(), remainingPaise: z.number().int(),
  spendingByCategory: z.array(z.object({ category: z.string(), amountPaise: z.number().int() })),
});
export const errorOutput = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
