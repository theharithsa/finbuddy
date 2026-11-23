import { expect, type Page } from '@playwright/test';

export async function checkLibraryTabs(page: Page, screen: 'Categories' | 'People') {
  const personal = screen === 'Categories' ? /^My Categories/ : /^My People/;
  const library = screen === 'Categories' ? /^Community/ : /^Public Library/;
  const first = page.getByRole('tab', { name: personal });
  const second = page.getByRole('tab', { name: library });
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await first.press('ArrowRight');
  await expect(second).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: library })).toBeVisible();
  await second.press('ArrowLeft');
  await expect(first).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: personal })).toBeVisible();
}
