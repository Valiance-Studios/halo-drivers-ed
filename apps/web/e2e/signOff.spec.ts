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

  // Leaving asks first, and stays if told to.
  const leave = page.getByRole('link', {name: 'Back to the schedule'});
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Some changes are not saved. Leave and lose them?');
    await dialog.dismiss();
  });
  await leave.click();
  await expect(page).toHaveURL(/\/schedule\/.+/);
  await expect(page.getByText('Not saved', {exact: true})).toBeVisible();

  // Leaving anyway loses the mark.
  page.once('dialog', (dialog) => dialog.accept());
  await leave.click();
  await page.getByRole('link', {name: 'Open form'}).first().click();
  await expect(firstPass).toHaveAttribute('aria-pressed', 'false');

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

  // Notes save once typing pauses.
  await page.getByLabel('Note for the student').fill('Great start.');
  await page.getByLabel('Private note').fill('Ready for more.');
  await expect(page.getByText('All changes saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Private note')).toHaveValue('Ready for more.');

  await passNextLesson(page);
  await passNextLesson(page);
  await page.locator('summary', {hasText: 'Lesson 1: Startup and controls'}).click();
  await expect(page.getByText('Ready for more.')).toBeVisible();
  await page.getByRole('button', {name: 'Sign out'}).click();

  await signInWithGoogle(page, STUDENT_USER);
  await expect(page.getByRole('heading', {name: 'Courses'})).toBeVisible();
  await expect(page.getByRole('button', {name: /^Mongoose.*2\/2 lessons completed/})).toBeVisible();
  await expect(page.locator('.vehicle-detail').getByText('2/2', {exact: true})).toBeVisible();
  await expect(page.getByText(/lessons completed/)).toHaveCount(1);
  await page.locator('summary', {hasText: 'Lesson 1: Startup and controls Completed'}).click();
  await expect(
    page.getByRole('listitem').filter({hasText: 'Engage and release the parking brake: Passed'}),
  ).toBeVisible();

  await expect(page.getByText('Course Completed')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Book Mongoose lesson'})).toBeHidden();
  await page.getByRole('link', {name: 'View Certificate'}).click();
  const certificate = page.getByRole('article');
  await expect(certificate.getByText(STUDENT_USER.displayName)).toBeVisible();
  await expect(certificate.getByText('Mongoose', {exact: true})).toBeVisible();
  await expect(certificate.getByText('Sergeant Johnson')).toBeVisible();
  // It survives a reload, and only completed courses have one.
  await page.reload();
  await expect(certificate).toBeVisible();
  await page.goto('/certificates/warthog');
  await expect(page.getByText('Complete the Warthog course to earn its certificate.')).toBeVisible();
  await page.getByRole('link', {name: 'Back to courses'}).click();

  await page.getByRole('button', {name: /^Warthog/}).click();
  await expect(page.getByRole('button', {name: 'Book Warthog lesson'})).toBeEnabled();

  await page.getByRole('link', {name: 'My lessons'}).click();
  await page.getByRole('button', {name: 'See results'}).last().click();
  await expect(page.getByRole('dialog').getByText('Passed')).toHaveCount(5);
  await expect(page.getByRole('dialog').getByText('Great start.')).toBeVisible();
  await expect(page.getByText('Ready for more.')).toHaveCount(0);
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
