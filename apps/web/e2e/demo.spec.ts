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
  await expect(results).toHaveCount(7);

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
  await expect(guestLessons).toHaveCount(7);
  await adminContext.close();

  const ended = page.waitForResponse((response) => response.request().method() === 'DELETE');
  await page.getByRole('button', {name: 'Sign out'}).click();
  expect((await ended).status()).toBe(200);
  await expect(page).toHaveURL(/\/login/);
});

const COURSES = [
  // Guests start with three Warthog lessons completed and the last one to repeat, and half of the Ghost's.
  {faction: 'UNSC', course: 'Warthog', button: 'Repeat Warthog lesson 4', lesson: 4, unlocks: ['Scorpion', 'Hornet']},
  {faction: 'Covenant', course: 'Ghost', button: 'Book Ghost lesson', lesson: 2, unlocks: ['Banshee', 'Wraith']},
];

for (const {faction, course, button, lesson, unlocks} of COURSES) {
  test(`lets a visitor finish the ${course} course, which unlocks others and earns a certificate`, async ({page}) => {
    await page.goto('/login');
    await page.getByRole('button', {name: 'Try the demo'}).click();
    await page.getByRole('tab', {name: faction}).click();
    await page.getByRole('button', {name: new RegExp(`^${unlocks[0]}`)}).click();
    await expect(page.getByRole('button', {name: `Book ${unlocks[0]} lesson`})).toBeDisabled();

    await page.getByRole('button', {name: new RegExp(`^${course}`)}).click();
    await bookLesson(page, button);
    await page.getByRole('link', {name: 'Schedule', exact: true}).click();
    await expect(page.getByText(/These are your own lessons/)).toBeVisible();
    await page.getByRole('link', {name: 'View form'}).first().click();
    await expect(page.getByRole('heading', {name: `${course}, lesson ${lesson}`})).toBeVisible();
    await page.getByLabel('Mark and sign off early').check();

    // Ones already passed in an earlier attempt cannot change.
    for (const pass of await page.getByRole('button', {name: 'Pass', exact: true}).all()) {
      if (await pass.isEnabled()) {
        await pass.click();
      }
    }

    await page.getByRole('button', {name: 'Sign off lesson'}).click();
    await expect(page.getByText('Signed off: completed.')).toBeVisible();

    await page.getByRole('link', {name: 'Courses', exact: true}).click();
    await page.getByRole('tab', {name: faction}).click();

    for (const vehicle of unlocks) {
      await page.getByRole('button', {name: new RegExp(`^${vehicle}`)}).click();
      await expect(page.getByRole('button', {name: `Book ${vehicle} lesson`})).toBeEnabled();
    }

    await page.getByRole('button', {name: new RegExp(`^${course}`)}).click();
    await page.getByRole('link', {name: 'View Certificate'}).click();
    await expect(page.getByRole('article').getByText('Demo guest')).toBeVisible();

    await page.getByRole('button', {name: 'Sign out'}).click();
    await expect(page).toHaveURL(/\/login/);
  });
}
