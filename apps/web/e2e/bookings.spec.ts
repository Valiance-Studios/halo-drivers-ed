import {expect, test} from '@playwright/test';
import {ALLOWED_USER, signInWithGoogle} from './accounts.ts';
import {bookLesson} from './booking.ts';

test('books a course until its lessons run out, reschedules and cancels', async ({page}) => {
  await page.goto('/login');
  await signInWithGoogle(page, ALLOWED_USER);
  await expect(page.getByRole('heading', {name: 'Courses'})).toBeVisible();

  await bookLesson(page, 'Book Mongoose lesson');
  await bookLesson(page, 'Book Mongoose lesson');
  await expect(page.getByRole('button', {name: 'Book Mongoose lesson'})).toBeDisabled();
  await expect(page.getByText('You have booked every lesson in this course.')).toBeVisible();

  // Instructors can look at an upcoming lesson's form, but not mark it yet.
  await page.getByRole('link', {name: 'Schedule'}).click();
  await page.getByRole('link', {name: 'View form'}).first().click();
  await expect(page.getByRole('button', {name: 'Pass', exact: true}).first()).toBeDisabled();
  await expect(page.getByText(/^Skills can be marked once the lesson starts/)).toBeVisible();

  // Unless they choose to mark it early.
  await page.getByLabel('Mark and sign off early').check();
  await page.getByRole('button', {name: 'Pass', exact: true}).first().click();
  await expect(page.getByText('All changes saved.')).toBeVisible();

  await page.getByRole('link', {name: 'My lessons'}).click();
  const cancel = page.getByRole('button', {name: 'Cancel lesson'});
  await expect(cancel).toHaveCount(2);

  // Moving a lesson keeps it, at its new time.
  await page.getByRole('button', {name: 'Reschedule'}).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', {name: 'Reschedule lesson'})).toBeDisabled();
  await dialog.getByLabel('Day').click();
  await page.getByRole('option').last().click();
  await dialog.getByRole('group', {name: 'Time'}).getByRole('button').last().click();
  await dialog.getByRole('button', {name: 'Reschedule lesson'}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Rescheduled with')).toBeVisible();

  await expect(cancel).toHaveCount(2);

  await cancel.first().click();
  await expect(cancel).toHaveCount(1);
  await cancel.click();
  await expect(page.getByText('You have no lessons booked.')).toBeVisible();

  await page.getByRole('link', {name: 'Courses', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Book Mongoose lesson'})).toBeEnabled();
});
