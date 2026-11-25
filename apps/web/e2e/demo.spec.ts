import {expect, test} from '@playwright/test';
import {ALLOWED_USER, signInWithGoogle} from './accounts.ts';
import {bookLesson} from './booking.ts';

test('lets a visitor try the demo, and deletes it when they sign out', async ({page, browser}) => {
  await page.goto('/login');
  await page.getByRole('button', {name: 'Try the demo'}).click();
  await expect(page.getByRole('heading', {name: 'Courses'})).toBeVisible();
  await expect(page.getByText(/^You are trying the demo until/)).toBeVisible();

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

test('lets a visitor sign off their own lessons, which unlocks a course', async ({page}) => {
  test.slow();
  await page.goto('/login');
  await page.getByRole('button', {name: 'Try the demo'}).click();

  // The Warthog course has four lessons.
  for (let number = 1; number <= 4; number++) {
    await page.getByRole('link', {name: 'Courses', exact: true}).click();
    await page.getByRole('button', {name: /^Warthog/}).click();
    await bookLesson(page, 'Warthog');

    await page.getByRole('link', {name: 'Schedule', exact: true}).click();
    await expect(page.getByText(/These are your own lessons/)).toBeVisible();
    await page.getByRole('link', {name: 'View form'}).first().click();
    await expect(page.getByRole('heading', {name: `Warthog, lesson ${number}`})).toBeVisible();
    await page.getByLabel('Mark and sign off early').check();

    // Skills passed in the lesson to repeat are passed already.
    for (const pass of await page.getByRole('button', {name: 'Pass', exact: true}).all()) {
      if ((await pass.getAttribute('aria-pressed')) === 'false') {
        await pass.click();
      }
    }

    await page.getByRole('button', {name: 'Sign off lesson'}).click();
    await expect(page.getByText('Signed off: completed.')).toBeVisible();
  }

  await page.getByRole('link', {name: 'Courses', exact: true}).click();
  await page.getByRole('button', {name: /^Scorpion/}).click();
  await expect(page.getByRole('button', {name: 'Book Scorpion lesson'})).toBeEnabled();
  await page.getByRole('button', {name: 'Sign out'}).click();
  await expect(page).toHaveURL(/\/login/);
});
