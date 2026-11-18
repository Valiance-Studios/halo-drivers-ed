# UI

The pages use PrimeVue's Aura theme with a teal primary color, a placeholder until the design pass (see [Project Status](../ARCHITECTURE.md#project-status)). Any artwork must be original: no official Halo logos or images.

## App Bar

The app name (links to Courses), the light/dark toggle, and, when signed in, the account's name and **Sign out**. The theme follows the system setting until the toggle is used; the choice is then remembered in this browser (`localStorage`).

## Login (`/login`)

A card with **Sign in with Google**. An account that is not on the allowlist is signed out again, with "This Google account is not authorized to use this app." Signed-out visitors to any other page land here, and return to that page after signing in.

## Courses (`/courses`)

Tabs for **UNSC** and **Covenant**. Each tab shows:

- **Vehicles**: a card per vehicle with its name, Ground or Air tag, a short description, the course length (lessons × minutes, and total hours), the prerequisite courses, and the instructors who teach it. Ordered shortest course first.
- **Instructors**: each instructor's initials, name, title and bio.

The catalog loads once per visit; a failure shows an error message in place of the tabs.
