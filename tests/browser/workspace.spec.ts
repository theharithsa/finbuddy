import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function createAccount(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Name').fill('Test account');
  await page.getByLabel('Email', { exact: true }).fill(`workspace-${randomUUID()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-only-password-2026');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Expenses', exact: true })).toBeVisible();
}

async function openExpense(page: Page) {
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add expense', exact: true });
  await expect(dialog.getByLabel('Amount')).toBeFocused();
  return dialog;
}

test('quick entry asks for amount and category and defaults to today', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createAccount(page);
  const dialog = await openExpense(page);
  await expect(dialog.getByLabel('Date')).toBeHidden();
  await expect(dialog.getByRole('button', { name: /today · more details/i })).toHaveAttribute('aria-expanded', 'false');
  await dialog.getByLabel('Amount').fill('0');
  await dialog.getByRole('button', { name: 'Save expense' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Enter a positive amount');
  await dialog.getByLabel('Amount').fill('105,50');
  await dialog.getByRole('button', { name: 'Save expense' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Choose a category');
  await dialog.getByRole('button', { name: 'Food & Dining', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save expense' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add expense', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Edit expense: Food & Dining' })).toContainText('₹105.50');
});

test('persists optional fields and a receipt, then edits, filters and deletes the expense', async ({ page }) => {
  await createAccount(page);
  await expect(page.getByRole('heading', { name: 'No expenses in this period' })).toBeVisible();
  const add = await openExpense(page);
  await add.getByLabel('Amount').fill('249.50');
  await add.getByLabel('Category', { exact: true }).selectOption('Food & Dining');
  await add.getByLabel('Note', { exact: false }).fill('Synthetic lunch');
  await add.getByRole('button', { name: /more details/i }).click();
  await add.getByLabel('Platform').selectOption('Swiggy');
  await add.getByRole('button', { name: 'Family', exact: true }).click();
  await add.getByLabel('Attach receipt').setInputFiles({
    name: 'synthetic-receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1sAAAAASUVORK5CYII=', 'base64'),
  });
  await add.getByRole('button', { name: 'Save expense' }).click();
  await expect(add).toHaveCount(0);

  await page.reload();
  const entry = page.getByRole('button', { name: 'Edit expense: Synthetic lunch' });
  await expect(entry).toContainText('Swiggy · Family');
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(entry).toHaveCount(0);
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const filters = page.getByRole('dialog', { name: 'Filter expenses' });
  await filters.getByRole('button', { name: 'Date range: This month' }).click();
  await page.getByRole('button', { name: 'All time', exact: true }).click();
  await filters.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(filters).toHaveCount(0);
  await expect(page.getByRole('main').getByText('All time', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'This month', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search expenses' }).fill('synthetic');
  await entry.click();
  const edit = page.getByRole('dialog', { name: 'Edit expense' });
  await edit.getByLabel('Note', { exact: false }).fill('Updated lunch');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).click();

  const actions = page.getByRole('button', { name: 'Actions for Updated lunch' });
  await actions.click();
  await page.getByRole('menuitem', { name: 'View receipt' }).click();
  const receipt = page.getByRole('dialog', { name: 'Receipt', exact: true });
  await expect(receipt.getByText('synthetic-receipt.png')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(receipt).toHaveCount(0);
  await expect(actions).toBeFocused();
  await actions.click();
  await page.getByRole('menuitem', { name: 'Delete expense' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete expense?' });
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Edit expense: Updated lunch' })).toBeVisible();
  await actions.click();
  await page.getByRole('menuitem', { name: 'Delete expense' }).click();
  await confirm.getByRole('button', { name: 'Delete expense' }).click();
  await expect(page.getByRole('heading', { name: 'No expenses in this period' })).toBeVisible();
});

test('navigation, secondary screens and dark mode work on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createAccount(page);
  const nav = page.getByRole('navigation', { name: 'Workspace', exact: true });
  await expect(nav.getByRole('button', { name: 'Expenses' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('button', { name: 'Overview' }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Budgets' }).click();
  await expect(page.getByRole('heading', { name: 'Budgets', exact: true })).toBeVisible();

  for (const [label, heading] of [
    ['Recurring', 'Recurring templates'],
    ['Categories', 'Categories'],
    ['People', 'People'],
    ['Metrics Explorer', 'Metrics Explorer'],
    ['KautilyaAI', 'KautilyaAI'],
  ]) {
    await nav.getByRole('button', { name: 'More', exact: true }).click();
    const more = page.getByRole('navigation', { name: 'More destinations' });
    await more.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveClass('dark');
  const fab = page.getByRole('button', { name: 'Add expense', exact: true });
  await openExpense(page);
  await page.keyboard.press('Escape');
  await expect(fab).toBeFocused();
  await nav.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to FinBuddy' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
