import {expect, test} from '@playwright/test';
import {ALLOWED_USER, signInWithGoogle} from './accounts.ts';

test.beforeEach(async ({page}) => {
  await page.goto('/login');
  await signInWithGoogle(page, ALLOWED_USER);
  await expect(page.getByRole('heading', {name: 'Courses'})).toBeVisible();
});

test('shows the UNSC courses and instructors from the API', async ({page}) => {
  await expect(page.getByRole('heading', {name: 'Mongoose'})).toBeVisible();
  await expect(page.getByText('Sergeant Major')).toBeVisible();
});

test('shows the selected vehicle', async ({page}) => {
  await page.getByRole('button', {name: 'Scorpion'}).click();
  await expect(page.getByRole('heading', {name: 'Scorpion'})).toBeVisible();
  await expect(page.getByText('6 lessons, 90 min each')).toBeVisible();
});

test('shows a locked course but does not let the student book it', async ({page}) => {
  const warthog = page.getByRole('button', {name: /^Warthog.*Locked$/});
  await expect(warthog.locator('.pi-lock')).toBeVisible();
  await warthog.click();
  await expect(page.getByRole('heading', {name: 'Warthog'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Book Warthog lesson'})).toBeDisabled();
  await expect(page.getByText('Complete Mongoose first.')).toBeVisible();
});

test('brings the selected vehicle into view on a phone', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.getByRole('button', {name: /^Warthog/}).click();
  await expect(page.getByRole('heading', {name: 'Warthog'})).toBeInViewport();
});

test('switches to the Covenant courses', async ({page}) => {
  await page.getByRole('tab', {name: 'Covenant'}).click();
  await expect(page.getByRole('button', {name: 'Scarab'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Prophet of Truth'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Scorpion'})).toBeHidden();
});

test('has a picture for every vehicle and instructor', async ({page}) => {
  for (const faction of ['UNSC', 'Covenant']) {
    await page.getByRole('tab', {name: faction}).click();
    // Five vehicles on the route, the selected one again, and three instructors.
    await expect(page.locator('img:visible')).toHaveCount(9);
  }
});

test('switches theme without changing the courses shown, and remembers it', async ({page}) => {
  await page.getByRole('button', {name: 'Switch to Covenant theme'}).click();
  await expect(page.locator('html')).toHaveClass(/theme-covenant/);
  await expect(page.getByRole('button', {name: 'Scorpion'})).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/theme-covenant/);
  await expect(page.getByRole('button', {name: 'Switch to UNSC theme'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Scarab'})).toBeVisible();
});
