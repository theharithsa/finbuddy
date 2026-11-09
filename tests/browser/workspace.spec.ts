import { expect, test, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { shiftMonth } from '../../src/lib/finance-period';

async function createAccount(page: Page, openLedger = true) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Name').fill('Test account');
  await page.getByLabel('Email', { exact: true }).fill(`workspace-${randomUUID()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-only-password-2026');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your money, in view.', exact: true })).toBeVisible();
  if (openLedger) await openExpenses(page);
}

async function openExpenses(page: Page) {
  await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('button', { name: 'Expenses', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Expenses', exact: true })).toBeVisible();
}

async function openExpense(page: Page) {
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add expense', exact: true });
  await expect(dialog.getByLabel('Amount')).toBeFocused();
  return dialog;
}

async function expectBareIcon(holder: Locator) {
  const icon = holder.locator('svg');
  await expect(icon).toBeVisible();
  await expect(icon).toHaveAttribute('fill', 'currentColor');
  await expect(icon).toHaveCSS('stroke', 'none');
  await expect(icon.locator(':scope > path')).toHaveCount(1);
  await expect(holder).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(holder).toHaveCSS('border-top-width', '0px');
}

test('category, person and bill icons have a single fill and no colored tiles or borders', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createAccount(page, false);
  const nav = page.getByRole('navigation', { name: 'Workspace', exact: true });
  const more = page.getByRole('navigation', { name: 'More destinations' });
  const main = page.getByRole('main');
  const open = async (label: string) => {
    await nav.getByRole('button', { name: 'More', exact: true }).click();
    await more.getByRole('button', { name: new RegExp(`^${label}`) }).click();
  };

  await expectBareIcon(nav.getByRole('button', { name: 'Add expense', exact: true }).locator('.m3-destination-indicator'));
  await open('Categories');
  await expectBareIcon(main.locator('.m3-row-icon').first());
  await main.getByRole('button', { name: 'Create Category', exact: true }).click();
  const categoryDialog = page.getByRole('dialog', { name: 'Create Custom Category' });
  const food = categoryDialog.getByRole('button', { name: 'Food', exact: true });
  await expectBareIcon(food);
  await food.click();
  await expect(food).toHaveAttribute('aria-pressed', 'true');
  await expectBareIcon(food);
  await expect(categoryDialog.getByText('Selected icon · Food')).toBeVisible();
  await page.keyboard.press('Escape');

  await open('People');
  await expectBareIcon(main.locator('.m3-row-icon').first());
  await main.getByRole('button', { name: 'Add Person', exact: true }).click();
  const personDialog = page.getByRole('dialog', { name: 'Add New Person' });
  await expectBareIcon(personDialog.getByRole('button', { name: 'Person', exact: true }));
  await expectBareIcon(personDialog.getByRole('button', { name: 'Group', exact: true }));
  await page.keyboard.press('Escape');

  await open('Bills & EMIs');
  await expectBareIcon(main.locator('.m3-row-icon').first());
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await open('Recurring');
  const iconFor = (label: string) => main.getByText(label, { exact: true }).locator('../..').locator('.m3-row-icon');
  const rent = iconFor('House Rent');
  const water = iconFor('Water Bill');
  await expectBareIcon(rent);
  await expectBareIcon(water);
  expect(await rent.locator('path').getAttribute('d')).not.toBe(await water.locator('path').getAttribute('d'));
});

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
  await openExpenses(page);
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
  await createAccount(page, false);
  const nav = page.getByRole('navigation', { name: 'Workspace', exact: true });
  await expect(nav.getByRole('button', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('button', { name: 'Add expense', exact: true })).toBeVisible();
  await expect(page.locator('.m3-route')).toHaveCSS('animation-name', 'm3-page-enter');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.m3-route')).toHaveCSS('animation-name', 'none');
  await nav.getByRole('button', { name: 'Savings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Savings & investments', exact: true })).toBeVisible();

  for (const [label, heading] of [
    ['Bills & EMIs', 'Bills & EMIs'],
    ['Budgets', 'Budgets'],
    ['Overview', 'Overview'],
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
  await expect(page.getByRole('main').getByText('Coming soon', { exact: true })).toBeVisible();

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

async function addBill(page: Page, name: string, amount: string, monthly = false) {
  await page.getByRole('button', { name: 'Add bill', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add bill', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByLabel('Expected amount').fill(amount);
  if (monthly) {
    await dialog.getByText('Repeat', { exact: true }).click();
    await dialog.getByLabel('How often?').selectOption('monthly');
  }
  await dialog.getByRole('button', { name: 'Save bill', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test('tracks household income, links an advance payment once and keeps investment values separate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createAccount(page, false);
  const nav = page.getByRole('navigation', { name: 'Workspace', exact: true });
  const summary = page.getByRole('region', { name: 'Monthly money summary' });
  await expect(summary).toContainText('Add income you’ve received');
  await page.getByRole('button', { name: 'Add income', exact: true }).click();
  const income = page.getByRole('dialog', { name: 'Add income', exact: true });
  await income.getByLabel('Amount received').fill('65000');
  await income.getByLabel(/Label/).fill('Salary');
  await income.getByRole('button', { name: 'Save income' }).click();
  await expect(income).toHaveCount(0);

  const expense = await openExpense(page);
  await expense.getByLabel('Amount').fill('1250');
  await expense.getByLabel('Category', { exact: true }).selectOption('Bills & Utilities');
  await expense.getByLabel(/Note/).fill('Broadband paid');
  await expense.getByRole('button', { name: /more details/i }).click();
  const date = expense.getByLabel('Date', { exact: true });
  const earlierMonth = shiftMonth((await date.inputValue()).slice(0, 7), -2);
  await date.fill(earlierMonth + '-01');
  await expense.getByRole('button', { name: 'Save expense' }).click();
  await expect(expense).toHaveCount(0);
  await addBill(page, 'Broadband', '1250');
  await addBill(page, 'Rent', '12000', true);
  await expect(summary.getByText('₹13,250.00', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Manage bills' }).click();
  await page.getByRole('listitem').filter({ hasText: 'Broadband' }).getByRole('button', { name: 'Record payment' }).click();
  const payment = page.getByRole('dialog', { name: 'Record payment' });
  await payment.getByRole('button', { name: 'Already logged it?' }).click();
  const picker = payment.getByLabel('Expense already logged');
  const existing = await picker.locator('option').filter({ hasText: 'Broadband paid' }).getAttribute('value');
  await picker.selectOption(existing ?? '');
  await payment.getByRole('button', { name: 'Link expense' }).click();
  await expect(payment).toHaveCount(0);
  await page.getByRole('listitem').filter({ hasText: 'Rent' }).getByRole('button', { name: 'Record payment' }).click();
  await expect(payment.getByLabel('Amount paid')).toHaveValue('12000');
  await payment.getByRole('button', { name: 'Save payment' }).click();
  await expect(payment).toHaveCount(0);
  await expect(page.getByText('You’re caught up on the bills shown here.')).toBeVisible();

  await nav.getByRole('button', { name: 'Savings', exact: true }).click();
  await page.getByRole('button', { name: 'Add savings or investment' }).click();
  const holding = page.getByRole('dialog', { name: 'Add savings or investment' });
  await holding.getByLabel('Name', { exact: true }).fill('Emergency savings');
  await holding.getByLabel('Latest value').fill('50000');
  await holding.getByText('Type and value date', { exact: false }).click();
  await holding.getByLabel('Type', { exact: true }).selectOption('Savings');
  await holding.getByRole('button', { name: 'Save value' }).click();
  await expect(holding).toHaveCount(0);
  await page.getByRole('button', { name: 'Update value: Emergency savings' }).click();
  const update = page.getByRole('dialog', { name: 'Update value' });
  await update.getByLabel('Latest value').fill('52000');
  await update.getByRole('button', { name: 'Save changes' }).click();
  await expect(update).toHaveCount(0);

  await page.reload();
  await expect(summary.getByText('₹53,000.00', { exact: true })).toBeVisible();
  await expect(summary.getByRole('button', { name: /Expenses logged/ })).toContainText('₹12,000.00');
  await expect(summary.getByRole('button', { name: /Bills still due/ })).toContainText('₹0.00');
  await expect(page.getByText('₹52,000.00', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 760 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(summary).toContainText('Add income you’ve received');
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(summary.getByText('₹53,000.00', { exact: true })).toBeVisible();
  await openExpenses(page);
  await expect(page.getByRole('button', { name: 'Edit expense: Rent' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Edit expense: Broadband paid' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous month' }).click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('button', { name: 'Edit expense: Broadband paid' })).toHaveCount(1);
});

test('concurrent payment attempts use one expense and household reads stay owner-scoped', async ({ page, browser }) => {
  await createAccount(page, false);
  await addBill(page, 'Phone bill', '799');
  const modules = { firebase: '/src/lib/firebase.ts', household: '/src/lib/household-firestore.ts' };
  const result = await page.evaluate(async (paths) => {
    const { auth } = await import(paths.firebase) as typeof import('../../src/lib/firebase');
    const { watchHousehold, recordBillPayment } = await import(paths.household) as typeof import('../../src/lib/household-firestore');
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Expected a synthetic account');
    const bill = await new Promise<import('../../src/lib/household').Bill>((resolve, reject) => {
      const stop = watchHousehold(uid, ({ bills }) => {
        stop();
        const entry = bills.find(({ name }) => name === 'Phone bill');
        if (entry) resolve(entry);
        else reject(new Error('Expected a persisted bill'));
      }, () => reject(new Error('Unable to load test bill')));
    });
    const payment = { amountPaise: 79_900, date: bill.dueDate };
    const outcomes = await Promise.all([
      recordBillPayment(uid, bill.id, bill.dueDate, payment),
      recordBillPayment(uid, bill.id, bill.dueDate, payment),
    ]);
    return { uid, id: bill.id, outcomes: outcomes.sort() };
  }, modules);
  expect(result.outcomes).toEqual(['already-recorded', 'recorded']);
  await openExpenses(page);
  await expect(page.getByRole('button', { name: 'Edit expense: Phone bill' })).toHaveCount(1);

  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  try {
    const otherPage = await other.newPage();
    await createAccount(otherPage, false);
    const status = await otherPage.evaluate(async ({ firebase, uid, id }) => {
      const { auth } = await import(firebase) as typeof import('../../src/lib/firebase');
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Expected a second synthetic account');
      const endpoint = 'http://127.0.0.1:8080/v1/projects/demo-finbuddy/databases/(default)/documents/users';
      return (await fetch(`${endpoint}/${uid}/householdBills/${id}`, { headers: { Authorization: `Bearer ${token}` } })).status;
    }, { firebase: modules.firebase, uid: result.uid, id: result.id });
    expect(status).toBe(403);
  } finally {
    await other.close();
  }
});

test('appearance loads real fonts, follows the device and keeps choices after reload', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await createAccount(page, false);
  const openSettings = async () => {
    await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('navigation', { name: 'More destinations' }).getByRole('button', { name: /^Settings/ }).click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  };
  await openSettings();
  const fontSelect = page.getByRole('combobox', { name: 'Font' });
  await expect(fontSelect).toHaveValue('google-sans');
  for (const [option, family] of [
    ['source-code-pro', 'Source Code Pro Variable'],
    ['source-sans-3', 'Source Sans 3 Variable'],
    ['lato', 'Lato'],
    ['open-sans', 'Open Sans Variable'],
    ['ubuntu', 'Ubuntu'],
    ['lora', 'Lora Variable'],
    ['roboto', 'Roboto Variable'],
    ['source-serif-4', 'Source Serif 4 Variable'],
  ]) {
    await fontSelect.selectOption(option);
    await expect.poll(() => page.evaluate(async (name) => {
      const [face] = await document.fonts.load('400 16px "' + name + '"', 'FinBuddy ₹24,500.00');
      return face?.status === 'loaded' && getComputedStyle(document.body).fontFamily.includes(name);
    }, family)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const root = page.locator('html');
  const primary = () => root.evaluate((element) => getComputedStyle(element).getPropertyValue('--m3-primary').trim());
  const lavender = await primary();
  await page.getByRole('radio', { name: 'Ocean' }).check();
  await expect(root).toHaveAttribute('data-palette', 'ocean');
  expect(await primary()).not.toBe(lavender);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('radio', { name: 'System' }).check();
  await expect(root).toHaveClass('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveClass('light');

  await page.reload();
  await openSettings();
  await expect(page.getByRole('radio', { name: 'Ocean' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'System' })).toBeChecked();
  await expect(fontSelect).toHaveValue('source-serif-4');
  await page.getByRole('radio', { name: 'Black & white' }).check();
  await expect(root).toHaveAttribute('data-palette', 'monochrome');
  expect(await primary()).toBe('#171717');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveClass('dark');
  expect(await primary()).toBe('#f3f3f3');
  await page.getByRole('button', { name: 'Reset appearance' }).click();
  await expect(fontSelect).toHaveValue('google-sans');
  await expect(page.getByRole('radio', { name: 'Lavender' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Light' })).toBeChecked();
});

test('visitors can explore sample spending without Firebase account requests', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const demo = page.getByRole('link', { name: 'Explore demo' });
  await expect(demo).toBeVisible();
  const backendRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/\/src\/lib\/firebase\.ts|:(8080|9099|9199)\/|(?:identitytoolkit|securetoken|firestore|firebasestorage)\.googleapis\.com/.test(url)) backendRequests.push(url);
  });
  await demo.click();
  await expect(page.getByText('Sample household data')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your money, in view.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Monthly money summary' })).toContainText('₹45,560.00');
  await expect(page.getByRole('button', { name: 'Add income' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add expense' })).toHaveCount(0);

  const nav = page.getByRole('navigation', { name: 'Workspace', exact: true });
  await nav.getByRole('button', { name: 'More', exact: true }).click();
  const more = page.getByRole('navigation', { name: 'More destinations' });
  await more.getByRole('button', { name: /^Overview/ }).click();
  const insights = page.getByRole('region', { name: 'Spending insights' });
  await expect(insights.getByText('Daily average')).toBeVisible();
  await expect(insights.getByText('Largest expense')).toBeVisible();
  await expect(insights.getByText('Top category')).toBeVisible();
  await expect(insights.getByText('Compared with last month')).toBeVisible();
  await page.getByRole('button', { name: 'View expenses' }).click();
  await expect(page.getByText('Household groceries', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Edit expense:/ })).toHaveCount(0);

  await nav.getByRole('button', { name: 'More', exact: true }).click();
  await more.getByRole('button', { name: /^Metrics Explorer/ }).click();
  await expect(page.getByRole('main').getByText('Coming soon', { exact: true })).toBeVisible();
  const footer = await page.locator('.m3-footer').boundingBox();
  expect(footer && footer.y + footer.height).toBeGreaterThan(730);
  expect(backendRequests).toEqual([]);
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to FinBuddy' })).toBeVisible();
});

test('the signed-in avatar shows the profile photo with an initials fallback', async ({ page }) => {
  await createAccount(page, false);
  const avatar = page.getByRole('img', { name: 'Test account profile' });
  await expect(avatar).toHaveText('T');
  const photoUrl = 'https://lh3.googleusercontent.com/finbuddy-synthetic-avatar';
  await page.route(photoUrl, (route) => route.fulfill({ path: 'public/icons/buddy-mark-v2.png', contentType: 'image/png' }));
  const status = await page.evaluate(async ({ firebase, photoUrl }) => {
    const { auth } = await import(firebase) as typeof import('../../src/lib/firebase');
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Expected a synthetic test account');
    return (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-finbuddy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, photoUrl, returnSecureToken: false }),
    })).status;
  }, { firebase: '/src/lib/firebase.ts', photoUrl });
  expect(status).toBe(200);
  await page.reload();
  await expect(avatar.locator('img')).toHaveAttribute('src', photoUrl);
  await expect.poll(() => avatar.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.unroute(photoUrl);
  await page.route(photoUrl, (route) => route.abort());
  await page.reload();
  await expect(avatar).toHaveText('T');
});
