import type {Page} from '@playwright/test';

import {expect, test} from '@playwright/test';
import {ALLOWED_USER, signInWithGoogle} from './accounts.ts';
import {bookLesson} from './booking.ts';

/** A date at the school, like "2026-06-08". */
function schoolDate(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

  return new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York'}).format(date);
}

async function viewAsMasterChief(page: Page): Promise<void> {
  await page.getByRole('link', {name: 'Schedule', exact: true}).click();
  await page.getByRole('combobox', {name: 'View as'}).click();
  await page.getByRole('option', {name: 'View as Master Chief'}).click();
}

test('an instructor takes time off, and cancels a lesson', async ({page}) => {
  await page.goto('/login');
  await signInWithGoogle(page, ALLOWED_USER);
  await bookLesson(page, 'Book Mongoose lesson');

  await viewAsMasterChief(page);
  await expect(page.getByText('None planned.')).toBeVisible();
  await page.getByLabel('First day').fill(schoolDate(1));
  await page.getByLabel('Last day').fill(schoolDate(20));
  await page.getByRole('button', {name: 'Add time off'}).click();
  await expect(page.getByText('Not added yet.')).toBeVisible();
  const cancelAll = page.getByRole('button', {name: /^Cancel this lesson and add/});
  await expect(cancelAll).toBeDisabled();
  await page.getByLabel('Reason for cancelling').fill('Called away.');
  await cancelAll.click();
  const remove = page.getByRole('button', {name: /^Remove/});
  await expect(remove).toBeVisible();

  await page.getByRole('link', {name: 'My lessons'}).click();
  await expect(page.getByText('Cancelled by the instructor')).toBeVisible();
  await expect(page.getByText('Reason: Called away.')).toBeVisible();

  await viewAsMasterChief(page);
  await remove.click();
  await expect(page.getByText('None planned.')).toBeVisible();

  // One lesson can be cancelled from its form.
  await page.getByRole('link', {name: 'Courses', exact: true}).click();
  await bookLesson(page, 'Book Mongoose lesson');
  await page.getByRole('link', {name: 'Schedule', exact: true}).click();
  await page.getByRole('link', {name: 'View form'}).first().click();
  await page.getByRole('button', {name: 'Cancel lesson'}).click();
  await page.getByLabel('Why is the instructor cancelling').fill('Mongoose in the shop.');
  await page.getByRole('button', {name: 'Cancel this lesson'}).click();
  await expect(page.getByText(/by the instructor: Mongoose in the shop\./)).toBeVisible();
  await expect(page.getByRole('button', {name: 'Sign off lesson'})).toBeHidden();
});
