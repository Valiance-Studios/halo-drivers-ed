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
  await expect(results).toHaveCount(6);

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
  await expect(guestLessons).toHaveCount(6);
  await adminContext.close();

  const ended = page.waitForResponse((response) => response.request().method() === 'DELETE');
  await page.getByRole('button', {name: 'Sign out'}).click();
  expect((await ended).status()).toBe(200);
  await expect(page).toHaveURL(/\/login/);
});

test('lets a visitor sign off a lesson, which unlocks the Scorpion and the Hornet', async ({page}) => {
  await page.goto('/login');
  await page.getByRole('button', {name: 'Try the demo'}).click();
  await page.getByRole('button', {name: /^Scorpion/}).click();
  await expect(page.getByRole('button', {name: 'Book Scorpion lesson'})).toBeDisabled();

  // Guests start with three Warthog lessons completed, and the last one to repeat.
  await page.getByRole('button', {name: /^Warthog/}).click();
  await bookLesson(page, 'Repeat Warthog lesson 4');
  await page.getByRole('link', {name: 'Schedule', exact: true}).click();
  await expect(page.getByText(/These are your own lessons/)).toBeVisible();
  await page.getByRole('link', {name: 'View form'}).first().click();
  await expect(page.getByRole('heading', {name: 'Warthog, lesson 4'})).toBeVisible();
  await page.getByLabel('Mark and sign off early').check();

  // Every skill but one was passed the first time.
  await page.getByRole('button', {name: 'Pass', exact: true}).last().click();

  await page.getByRole('button', {name: 'Sign off lesson'}).click();
  await expect(page.getByText('Signed off: completed.')).toBeVisible();

  await page.getByRole('link', {name: 'Courses', exact: true}).click();

  for (const vehicle of ['Scorpion', 'Hornet']) {
    await page.getByRole('button', {name: new RegExp(`^${vehicle}`)}).click();
    await expect(page.getByRole('button', {name: `Book ${vehicle} lesson`})).toBeEnabled();
  }

  await page.getByRole('button', {name: 'Sign out'}).click();
  await expect(page).toHaveURL(/\/login/);
});
