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
  await expect(page.getByText(ALLOWED_USER.displayName).filter({visible: true})).toHaveCount(1);

  await page.getByRole('button', {name: 'Sign out'}).click();
  await expect(page).toHaveURL(/\/login/);
});

for (const width of [320, 440]) {
  test(`keeps the app bar on one line, with a menu, on a ${width}px phone`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    await page.goto('/login');
    await signInWithGoogle(page, ALLOWED_USER);
    const menu = page.getByRole('button', {name: 'Menu', exact: true});
    const lessons = page.getByRole('link', {name: 'My lessons'});
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(lessons).toBeHidden();

    const title = (await page.getByRole('link', {name: 'Halo Drivers Ed'}).boundingBox())!;

    for (const button of [page.getByRole('button', {name: /^Switch to Covenant theme/}), menu]) {
      const box = (await button.boundingBox())!;
      expect(Math.abs(box.y + box.height / 2 - (title.y + title.height / 2))).toBeLessThan(4);
      expect(box.x).toBeGreaterThanOrEqual(title.x + title.width);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }

    await menu.click();
    await expect(page.getByRole('link', {name: 'Courses', exact: true})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(lessons).toBeHidden();
    await expect(menu).toBeFocused();

    await menu.click();
    await page.getByRole('contentinfo').click();
    await expect(lessons).toBeHidden();

    await menu.click();
    await lessons.click();
    await expect(page.getByRole('heading', {name: 'My lessons'})).toBeVisible();
    await expect(lessons).toBeHidden();

    await menu.click();
    await page.getByRole('button', {name: 'Sign out'}).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(menu).toBeHidden();
  });
}

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
