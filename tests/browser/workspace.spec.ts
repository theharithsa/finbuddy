import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function createAccount(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Name').fill('Test account');
  await page.getByLabel('Email', { exact: true }).fill(`workspace-${randomUUID()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-only-password-2026');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
}

test('saves an expense and restores it after reload, then edits and deletes it', async ({ page }) => {
  await createAccount(page);
  await expect(page.getByRole('heading', { name: 'No expenses this month' })).toBeVisible();
  await page.getByRole('button', { name: 'Add expense', exact: true }).first().click();
  const add = page.getByRole('dialog');
  await expect(add.getByRole('heading', { name: 'Add New Expense' })).toBeVisible();
  await add.locator('#amount').fill('249.50');
  await add.locator('#category').click();
  await page.getByRole('option', { name: 'Food & Dining' }).click();
  await add.locator('#description').fill('Synthetic lunch');
  await add.locator('#receipt-upload').setInputFiles({
    name: 'synthetic-receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1sAAAAASUVORK5CYII=', 'base64'),
  });
  await add.getByRole('button', { name: 'Add Expense', exact: true }).click();
  await expect(add).toHaveCount(0);
  await expect(page.getByText('Synthetic lunch', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Synthetic lunch', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByText('Synthetic lunch', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: 'View expenses' }).click();
  await page.getByRole('searchbox', { name: 'Search expenses' }).fill('synthetic');
  await expect(page.getByText('Synthetic lunch', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit expense' }).click();
  const edit = page.getByRole('dialog');
  await edit.locator('#description').fill('Updated lunch');
  await edit.getByRole('button', { name: /update expense|save changes/i }).click();
  await expect(edit).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search expenses' }).clear();
  await expect(page.getByText('Updated lunch', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /view receipt/i })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete expense' }).click();
  await expect(page.getByRole('heading', { name: 'No matching expenses' })).toBeVisible();
});

test('mobile navigation exposes all workspace sections and sign-out', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createAccount(page);
  const quick = page.getByRole('navigation', { name: 'Quick navigation' });
  await expect(quick.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  await quick.getByRole('button', { name: 'Expenses' }).click();
  await expect(page.getByRole('heading', { name: 'Expenses', exact: true })).toBeVisible();
  await quick.getByRole('button', { name: 'Budgets' }).click();
  await expect(page.getByRole('navigation', { name: 'Quick navigation' }).getByRole('button', { name: 'Budgets' })).toHaveAttribute('aria-current', 'page');
  await quick.getByRole('button', { name: 'More' }).click();
  const menu = page.getByRole('navigation', { name: 'Workspace' });
  for (const label of ['Recurring', 'Categories', 'People', 'Metrics Explorer', 'KautilyaAI']) {
    await expect(menu.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to FinBuddy' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
