import { expect, test } from '@playwright/test';

test('homepage, demo and sign-in are distinct destinations', async ({ page }) => {
  const accountRequests: string[] = [];
  page.on('request', request => {
    if (/identitytoolkit|firestore\.googleapis|\/api\/v1\/|js-cdn\.dynatrace/.test(request.url())) accountRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Know where your money went.');
  await page.getByRole('link', { name: 'Try the demo' }).first().click();
  await expect(page).toHaveURL(/\/app\?demo=1$/);
  await expect(page.getByText('Sample household data')).toBeVisible();
  expect(accountRequests).toEqual([]);
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await page.goto('/');
  await page.getByRole('link', { name: 'Explore a sample goal' }).click();
  await expect(page).toHaveURL(/\/finvision\?demo=1$/);
  await expect(page.getByRole('heading', { name: /FinVision/i }).first()).toBeVisible();
});

test('former app links keep their original query and fragment', async ({ page }) => {
  for (const [query, path] of [
    ['demo=1', 'app'], ['action=add-expense', 'app'], ['action=view-budget', 'app'],
    ['mode=signIn&oobCode=synthetic-navigation-check', 'signin'],
  ]) {
    await page.goto('/?' + query + '#return');
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash)
      .toBe('/' + path + '?' + query + '#return');
  }
  await page.goto('/?utm_source=guide');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Know where');
});

test('old help links and error recovery work at phone and desktop widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 1365]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/docs/handbook/product.html#plan-a-goal');
    await expect(page).toHaveURL(/\/docs\/product\.html#plan-a-goal$/);
    await expect(page.locator('#plan-a-goal h2')).toBeVisible();
    await page.goto('/developer/api-reference.html');
    await expect(page).toHaveURL(/\/docs\/technical\.html#rest-api$/);
    await expect(page.locator('#rest-api h2')).toBeVisible();
    const missing = await page.goto('/previous/guide/does-not-exist');
    expect(missing?.status()).toBe(404);
    await expect(page.locator('#error-404')).toBeVisible();
    await expect(page.locator('.trail-buddy')).toHaveCSS('animation-name', 'none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Find a guide' }).click();
    await expect(page.getByRole('heading', { name: 'Help center', exact: true })).toBeVisible();
    await page.getByRole('navigation', { name: 'Footer' }).getByRole('link', { name: 'Privacy' }).click();
    await expect(page.getByRole('main').getByRole('link', { name: /email/i }).first()).toHaveAttribute('href', 'mailto:me@theharithsa.com');
    await page.goto('/errors/501.html');
    await page.getByRole('link', { name: 'Available features' }).click();
    await expect(page.getByRole('heading', { name: 'Feature availability', exact: true })).toBeVisible();
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/errors/503.html');
  await expect(page.locator('.trail-buddy')).toHaveCSS('animation-name', 'buddy-looks-around');
});

test('visitors can reach the policies without JavaScript', async ({ browser, baseURL }) => {
  const visitor = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await visitor.newPage();
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Footer' }).getByRole('link', { name: 'Security' }).click();
    await expect(page.getByRole('heading', { name: 'Security', exact: true })).toBeVisible();
    await expect(page.locator('a[href*="security/advisories/new"]')).toBeVisible();
  } finally {
    await visitor.close();
  }
});


test('the narrated product tour can be navigated without watching from the start', async ({ page }) => {
  await page.goto('/#tour');
  const film = page.getByLabel('FinBuddy product tour', { exact: true });
  await expect(film.locator('track[kind="captions"][srclang="en"]')).toHaveCount(1);
  await page.getByText('Jump to a chapter', { exact: true }).click();
  const chapter = page.getByRole('link', { name: /Forecast twelve deposits/ });
  const start = Number(await chapter.getAttribute('data-start'));
  await chapter.click();
  await expect.poll(() => film.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThanOrEqual(start - 0.5);
  await expect.poll(() => film.evaluate((video: HTMLVideoElement) => video.duration)).toBeGreaterThan(175);
  await page.getByText('Read the transcript', { exact: true }).click();
  await expect(page.locator('#tour-transcript')).toContainText('sixty-two thousand three hundred and ten');
});
