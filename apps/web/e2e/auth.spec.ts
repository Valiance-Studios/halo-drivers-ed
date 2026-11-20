import {expect, test} from '@playwright/test';
import {ALLOWED_USER, UNKNOWN_USER, signInWithGoogle} from './accounts.ts';

test('redirects signed-out users to the login page', async ({page}) => {
  await page.goto('/courses');
  await expect(page).toHaveURL(/\/login/);
});

test('rejects accounts that are not on the allowlist', async ({page}) => {
  await page.goto('/login');
  await signInWithGoogle(page, UNKNOWN_USER);
  await expect(page.getByText('not authorized')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('signs allowlisted users in and out', async ({page}) => {
  await page.goto('/login');
  await signInWithGoogle(page, ALLOWED_USER);
  await expect(page.getByRole('heading', {name: 'Courses'})).toBeVisible();
  await expect(page.getByText(ALLOWED_USER.displayName)).toBeVisible();

  await page.getByRole('button', {name: 'Sign out'}).click();
  await expect(page).toHaveURL(/\/login/);
});

test('does not use App Check against the emulators', async ({page}) => {
  const appCheckRequests: string[] = [];
  page.on('request', (request) => {
    if (/recaptcha|firebaseappcheck/.test(request.url())) {
      appCheckRequests.push(request.url());
    }
  });

  await page.goto('/login');
  await signInWithGoogle(page, ALLOWED_USER);
  await expect(page.getByRole('heading', {name: 'Courses'})).toBeVisible();
  expect(appCheckRequests).toEqual([]);
});
