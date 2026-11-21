import { dataRoot, deploymentTargets, firebaseProject } from '../api/shared/environment.ts';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const live = createRequire(import.meta.url)('../api/dist/tests/live.js') as typeof import('../api/tests/live.js');
const environment = process.argv[2];
assert.ok(environment === 'pre-production' || environment === 'production');
const project = firebaseProject;
const namespace = environment === 'pre-production' ? 'preprod' : 'prod';
assert.equal(process.env.FINBUDDY_ALLOW_SYNTHETIC_WRITES, 'true');
assert.ok(process.env.FINBUDDY_LIVE_API_KEY, 'Missing environment-specific public Firebase API key');
const passed: string[] = [];
let currentCase = 'fixture-provisioning';
let fixture: Awaited<ReturnType<typeof live.prepare>> | undefined;
let cleaned = false;

try {
  fixture = await live.prepare(namespace, process.env.FINBUDDY_LIVE_API_KEY);
  currentCase = 'hosted-api';
  passed.push(...await live.exerciseApi(fixture, scenario => { currentCase = `hosted-api/${scenario}`; }));
  currentCase = 'shared-project-environment-boundary';
  passed.push(...await live.exerciseNamespaceBoundary(fixture, process.env.FINBUDDY_LIVE_API_KEY));


  currentCase = 'hosted-browser-launch';
  const browser = await chromium.launch();
  try {
    for (const width of [1365, 390]) {
      currentCase = `hosted-browser-${width}`;
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.setDefaultTimeout(25_000);
      const rumRequests: string[] = [];
      page.on('request', request => { if (request.url().startsWith('https://js-cdn.dynatrace.com/jstag/')) rumRequests.push('rum-tag'); });
      await page.goto(fixture.origin, { waitUntil: 'networkidle' });
      assert.equal(rumRequests.length, 0, 'RUM loaded before opt-in');
      const google = page.getByRole('button', { name: 'Continue with Google', exact: true });
      await expect(google).toBeVisible();
      // Explicit opt-in belongs only to this disposable synthetic browser context.
      currentCase = `browser-${width}-rum-opt-in`;
      await page.evaluate(() => localStorage.setItem('finbuddy-usage-analytics', 'granted'));
      await page.reload();
      await expect.poll(() => page.evaluate(() => typeof (window as Window & { dtrum?: { identifyUser?: unknown } }).dtrum?.identifyUser), { timeout: 30_000 }).toBe('function');
      await page.evaluate(() => {
        const rum = (window as Window & { dtrum?: { identifyUser: (label: string) => void } }).dtrum;
        if (!rum) throw new Error('Missing opted-in RUM agent');
        rum.identifyUser('finbuddy-release-verification');
      });
      currentCase = `browser-${width}-email-sign-in`;
      await page.getByLabel('Email', { exact: true }).fill(fixture.accounts[0].email);
      await page.getByLabel('Password', { exact: true }).fill(fixture.accounts[0].password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Your money, in view.', exact: true })).toBeVisible();
      const nav = page.getByRole('navigation', { name: 'Workspace', exact: true });
      currentCase = `browser-${width}-expense-create-edit-delete`;
      await nav.getByRole('button', { name: 'Expenses', exact: true }).click();
      await page.getByRole('button', { name: 'Add expense', exact: true }).click();
      const add = page.getByRole('dialog', { name: 'Add expense', exact: true });
      await add.getByLabel('Amount').fill('24.50');
      await add.getByRole('button', { name: 'Food & Dining', exact: true }).click();
      await add.getByLabel('Note', { exact: false }).fill(`Release browser ${width}`);
      await add.getByRole('button', { name: 'Save expense' }).click();
      await expect(add).toHaveCount(0);
      await page.reload();
      await nav.getByRole('button', { name: 'Expenses', exact: true }).click();
      await page.getByRole('button', { name: `Edit expense: Release browser ${width}`, exact: true }).click();
      const edit = page.getByRole('dialog', { name: 'Edit expense', exact: true });
      await edit.getByLabel('Amount').fill('25.50');
      await edit.getByRole('button', { name: 'Save changes' }).click();
      await expect(edit).toHaveCount(0);
      await page.getByRole('button', { name: `Actions for Release browser ${width}`, exact: true }).click();
      await page.getByRole('menuitem', { name: 'Delete expense', exact: true }).click();
      await page.getByRole('alertdialog', { name: 'Delete expense?', exact: true }).getByRole('button', { name: 'Delete expense', exact: true }).click();
      await expect(page.getByRole('button', { name: `Edit expense: Release browser ${width}`, exact: true })).toHaveCount(0);
      passed.push(`browser-${width}-expense-create-edit-reload-delete`);
      for (const [label, heading] of [['Bills & EMIs', 'Bills & EMIs'], ['Budgets', 'Budgets'], ['Overview', 'Overview'],
        ['Recurring', 'Recurring templates'], ['Categories', 'Categories'], ['People', 'People']]) {
        currentCase = `browser-${width}-navigation-${label}`;
        await nav.getByRole('button', { name: 'More', exact: true }).click();
        await page.getByRole('navigation', { name: 'More destinations' }).getByRole('button', { name: new RegExp(`^${label}`) }).click();
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Horizontal page overflow');
      }
      currentCase = `browser-${width}-preferences-and-developer-options`;
      await nav.getByRole('button', { name: 'More', exact: true }).click();
      await page.getByRole('navigation', { name: 'More destinations' }).getByRole('button', { name: /^Settings/ }).click();
      const sections = page.getByRole('navigation', { name: 'Settings sections' });
      const font = page.getByRole('combobox', { name: 'Font' });
      await font.selectOption('lato');
      await page.getByRole('radio', { name: 'Ocean', exact: true }).check();
      await expect(page.locator('html')).toHaveAttribute('data-palette', 'ocean');
      await sections.getByRole('button', { name: 'Developer Options', exact: true }).click();
      await expect(page.getByRole('link', { name: 'Open Swagger API reference' })).toHaveAttribute('href', '/api/v1/docs');
      await page.getByLabel('Expires in').selectOption({ label: 'Never expires' });
      const tokenName = `Browser release ${width}`;
      await page.getByLabel('Token name').fill(tokenName);
      await page.getByRole('button', { name: 'Generate token', exact: true }).click();
      const revealed = page.getByLabel(/Copy this token now/);
      await expect(revealed).toBeVisible();
      assert.match(await revealed.inputValue(), /^fbp_/);
      await page.getByRole('button', { name: `Revoke ${tokenName}`, exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Revoke token', exact: true }).click();
      await expect(page.getByText('Token revoked.', { exact: true })).toBeVisible();
      passed.push(`browser-${width}-navigation-preferences-and-token-revocation`);
      assert.ok(rumRequests.length > 0, 'Configured RUM did not load after opt-in');
      await expect.poll(() => page.evaluate(() => typeof (window as Window & { dtrum?: { enterAction?: unknown } }).dtrum?.enterAction), { timeout: 30_000 }).toBe('function');
      passed.push(`browser-${width}-rum-opt-in`);
      await nav.getByRole('button', { name: 'More', exact: true }).click();
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Welcome to FinBuddy', exact: true })).toBeVisible();
      await page.evaluate(() => {
        const rum = (window as Window & { dtrum?: { endSession: () => void } }).dtrum;
        if (!rum) throw new Error('Missing opted-in RUM agent');
        rum.endSession();
      });
      // Let the explicitly ended disposable session dispatch its final beacon before closing Chrome.
      await page.waitForTimeout(1200);
      await context.close();
    }
  } finally { await browser.close(); }
} catch (error) {
  // Never print browser errors, input values, response bodies or generated credentials.
  process.stderr.write(`Release acceptance failed at ${currentCase}; inspect this bounded scenario.\n`);
  if (error instanceof assert.AssertionError && typeof error.actual === 'number' && typeof error.expected === 'number') {
    process.stderr.write(`Synthetic numeric assertion: expected ${error.expected}; received ${error.actual}.\n`);
  }
  process.exitCode = 1;
} finally {
  if (fixture) {
    try { await live.cleanup(fixture); cleaned = true; }
    catch { process.stderr.write('Synthetic cleanup incomplete; retain the owning verification run for recovery.\n'); process.exitCode = 1; }
  }
  await mkdir('verification', { recursive: true });
  await writeFile(`verification/${environment}-live.json`, JSON.stringify({ environment, project, namespace, site: deploymentTargets[namespace].site, dataRoot: dataRoot(namespace),
    source: process.env.CANDIDATE_SHA ?? process.env.GITHUB_SHA, at: new Date().toISOString(),
    probe: fixture?.probe, passed, failedCase: process.exitCode ? currentCase : null, cleaned,
    rumVerificationTag: 'finbuddy-release-verification',
    googleIdentityProvider: 'Interactive Google login remains a separate account-owner check; emulator avatar and configured-provider checks cover the unchanged integration.' }, null, 2));
  process.stdout.write(`Live acceptance: ${passed.length} scenarios passed; synthetic cleanup ${cleaned ? 'passed' : 'not completed'}.\n`);
}
