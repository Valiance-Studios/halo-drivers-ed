import type {Page} from '@playwright/test';

import {expect, test} from '@playwright/test';
import {ALLOWED_USER, signInWithGoogle, STUDENT_USER} from './accounts.ts';

/** Passes every skill on the first lesson waiting, and signs it off. */
async function passNextLesson(page: Page): Promise<void> {
  await page.getByRole('link', {name: 'Schedule', exact: true}).click();
  await page.getByRole('link', {name: 'Open form'}).first().click();
  const signOff = page.getByRole('button', {name: 'Sign off lesson'});
  await expect(signOff).toBeDisabled();

  for (const pass of await page.getByRole('button', {name: 'Pass', exact: true}).all()) {
    await pass.click();
  }

  await signOff.click();
  await expect(page.getByText('Signed off: completed.')).toBeVisible();
}

test('an instructor signs lessons off, which unlocks the next course for the student', async ({page}) => {
  await page.goto('/login');
  await signInWithGoogle(page, ALLOWED_USER);
  await page.getByRole('link', {name: 'Schedule'}).click();
  await expect(page.getByRole('link', {name: 'Open form'})).toHaveCount(2);

  await page.getByRole('combobox', {name: 'View as'}).click();
  await page.getByRole('option', {name: 'View as The Arbiter'}).click();
  await expect(page.getByText('Nothing is waiting to be signed off.')).toBeVisible();
  await page.getByRole('combobox', {name: 'View as'}).click();
  await page.getByRole('option', {name: 'View as Sergeant Johnson'}).click();
  await expect(page.getByRole('link', {name: 'Open form'})).toHaveCount(2);

  await page.getByRole('link', {name: 'Open form'}).first().click();
  const firstPass = page.getByRole('button', {name: 'Pass', exact: true}).first();
  // A mark saves by itself; one that fails says so, holds back sign-off, and can be retried.
  await page.route('**/results/*', (route) => route.abort());
  await firstPass.click();
  await expect(page.getByText('Not saved', {exact: true})).toBeVisible();
  await page.unroute('**/results/*');
  await page.getByRole('button', {name: /^Retry saving/}).click();
  await expect(page.getByText('All changes saved.')).toBeVisible();
  await page.reload();
  await expect(firstPass).toHaveAttribute('aria-pressed', 'true');
  // Clears it, so the next step passes it again.
  await firstPass.click();
  await expect(page.getByText('All changes saved.')).toBeVisible();

  await passNextLesson(page);
  await passNextLesson(page);
  await page.getByRole('button', {name: 'Sign out'}).click();

  await signInWithGoogle(page, STUDENT_USER);
  await expect(page.getByRole('heading', {name: 'Courses'})).toBeVisible();
  await page.getByRole('button', {name: /^Warthog/}).click();
  await expect(page.getByRole('button', {name: 'Book Warthog lesson'})).toBeEnabled();

  await page.getByRole('link', {name: 'My lessons'}).click();
  await page.getByRole('button', {name: 'See results'}).first().click();
  await expect(page.getByRole('dialog').getByText('Passed')).toHaveCount(5);
});

test("shows a course's lesson plan, and keeps students out of the schedule", async ({page}) => {
  await page.goto('/login');
  await signInWithGoogle(page, STUDENT_USER);
  await page.getByText('Lesson 1: Startup and controls').click();
  await expect(page.getByText('Engage and release the parking brake')).toBeVisible();

  await expect(page.getByRole('link', {name: 'Schedule'})).toBeHidden();
  await page.goto('/schedule');
  await expect(page).toHaveURL(/\/courses/);
});
