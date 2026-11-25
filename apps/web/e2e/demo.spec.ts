import {expect, test} from '@playwright/test';
import {ALLOWED_USER, signInWithGoogle} from './accounts.ts';

test('lets a visitor try the demo, and deletes it when they sign out', async ({page, browser}) => {
  await page.goto('/login');
  await page.getByRole('button', {name: 'Try the demo'}).click();
  await expect(page.getByRole('heading', {name: 'Courses'})).toBeVisible();
  await expect(page.getByText(/^You are trying the demo until/)).toBeVisible();
  await expect(page.getByRole('link', {name: 'Schedule'})).toBeHidden();

  // The demo starts with lessons already taken, and survives a reload.
  await page.reload();
  await page.getByRole('link', {name: 'My lessons'}).click();
  const results = page.getByRole('button', {name: 'See results'});
  await expect(results).toHaveCount(3);

  // Admins see guests' lessons only if they ask to.
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto('/login');
  await signInWithGoogle(admin, ALLOWED_USER);
  await admin.getByRole('link', {name: 'Schedule'}).click();
  const guestLessons = admin.getByText(/Demo guest \d/);
  await expect(admin.getByLabel('Show demo guests')).toBeVisible();
  await expect(guestLessons).toHaveCount(0);
  await admin.getByLabel('Show demo guests').check();
  await expect(guestLessons).toHaveCount(3);
  await adminContext.close();

  const ended = page.waitForResponse((response) => response.request().method() === 'DELETE');
  await page.getByRole('button', {name: 'Sign out'}).click();
  expect((await ended).status()).toBe(200);
  await expect(page).toHaveURL(/\/login/);
});
