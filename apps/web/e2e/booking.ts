import type {Page} from '@playwright/test';

import {expect} from '@playwright/test';

/** Books a lesson in the selected course on the last day offered, which is more than a day away. */
export async function bookLesson(page: Page, vehicle: string): Promise<void> {
  await page.getByRole('button', {name: `Book ${vehicle} lesson`}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', {name: 'Book lesson'})).toBeDisabled();
  await dialog.getByLabel('Day').click();
  await page.getByRole('option').last().click();
  await dialog.getByRole('group', {name: 'Time'}).getByRole('button').first().click();
  await dialog.getByRole('button', {name: 'Book lesson'}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/^Booked with/)).toBeVisible();
}
