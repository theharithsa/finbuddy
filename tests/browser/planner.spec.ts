import { expect, test } from '@playwright/test';

for (const width of [1365, 390]) {
  test('sample goals remain usable through navigation at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({width,height:900});
    const accountCalls: string[] = [];
    page.on('request', r => { if (/\/api\/v1\/|googleapis\.com\/(v1|google\.firestore)/.test(r.url())) accountCalls.push(r.url()); });
    await page.goto('/?demo=1');
    await page.getByRole('navigation',{name:'Workspace',exact:true}).getByRole('button',{name:'Savings',exact:true}).click();
    await page.getByRole('button',{name:'Plan a goal'}).click();
    await expect(page).toHaveURL(/\/finvision\?demo=1/);
    await expect(page.getByRole('heading',{name:'Goals & savings'})).toBeVisible();
    await page.getByRole('button',{name:'Add goal'}).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Goal name').fill('School fees');
    await dialog.getByLabel('Target amount').fill('120000');
    await dialog.getByLabel('Target month').fill('2028-05');
    await dialog.getByRole('button',{name:'Save goal'}).click();
    await expect(page.getByRole('button',{name:/School fees/})).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading',{name:'Savings & investments'})).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('button',{name:/School fees/})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading',{name:'Goals & savings'})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(accountCalls).toEqual([]);
  });
}
