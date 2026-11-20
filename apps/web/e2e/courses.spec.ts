import {expect, test} from '@playwright/test';
import {ALLOWED_USER, signInWithGoogle} from './accounts.ts';

test.beforeEach(async ({page}) => {
  await page.goto('/login');
  await signInWithGoogle(page, ALLOWED_USER);
  await expect(page.getByRole('heading', {name: 'Courses'})).toBeVisible();
});

test('shows the UNSC courses and instructors from the API', async ({page}) => {
  await expect(page.getByRole('heading', {name: 'Scorpion'})).toBeVisible();
  await expect(page.getByText('Sergeant Major')).toBeVisible();
});

test('switches to the Covenant courses', async ({page}) => {
  await page.getByRole('tab', {name: 'Covenant'}).click();
  await expect(page.getByRole('heading', {name: 'Scarab'})).toBeVisible();
  await expect(page.getByText('Prophet of Truth').first()).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Scorpion'})).toBeHidden();
});
