import type {Page} from '@playwright/test';
import type {EmulatorAccount} from '../../../scripts/emulator-admin.ts';

/** Seeded by globalSetup; ALLOWED_USER is on the allowlist, UNKNOWN_USER is not. */
export const ALLOWED_USER: EmulatorAccount = {email: 'cadet@example.com', displayName: 'Cadet Example'};
export const UNKNOWN_USER: EmulatorAccount = {email: 'stranger@example.com', displayName: 'Sam Stranger'};

/** Signs in by picking the seeded account in the Auth emulator's Google account chooser. */
export async function signInWithGoogle(page: Page, user: EmulatorAccount): Promise<void> {
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', {name: 'Sign in with Google'}).click();
  const popup = await popupPromise;
  // The emulator's chooser loads its scripts from a CDN; clicks before then are ignored.
  await popup.waitForLoadState('load');
  await popup.getByText(user.email).click();
}
