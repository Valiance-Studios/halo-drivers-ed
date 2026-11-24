# UI

Any artwork must be original: no official Halo logos or images.

## Themes

The app wears a **UNSC** look (green with orange accents, square corners, road-sign type) or a **Covenant** look (purple with a plasma-blue accent, asymmetric curves), each in light and dark mode. The tokens are in `apps/web/src/styles/themes.scss`, and PrimeVue's Aura preset reads its colors from them. How a theme is applied is under [Theming](../ARCHITECTURE.md#theming).

The theme is separate from the courses shown: changing it does not change the selected tab.

## Artwork

The vehicle and instructor pictures are **placeholders**, simple original drawings to be replaced. Each is found by slug in `apps/web/src/assets/artwork/vehicles` (2:1) and `apps/web/src/assets/artwork/instructors` (6:7), as SVG, WebP or PNG. To change one, replace its file; no code changes. A subject without a file shows no picture. The faction emblems (`FactionEmblem.vue`) are original too.

## App Bar

The app name (links to Courses), links to **Courses**, **My lessons** and (for admins) **Schedule** when signed in, two circular toggles and, when signed in, the account's name and **Sign out**. One toggle switches between the UNSC and Covenant themes and shows the emblem of the theme it switches to; the other switches between light and dark. UNSC is the default, and light or dark follows the system setting until its toggle is used. Both choices are remembered in this browser (`localStorage`).

## Login (`/login`)

A heading, the theme's road and vehicle (Warthog or Ghost), and a card with **Sign in with Google**. An account that is not on the allowlist is signed out again, with "This Google account is not authorized to use this app." Signed-out visitors to any other page land here, and return to that page after signing in.

## Courses (`/courses`)

Tabs for **UNSC** and **Covenant**, opening on the theme's faction. Each tab shows:

- **Route map**: the vehicles joined by their prerequisites, left to right, each with its picture, name, Ground or Air, and total hours. UNSC routes are angled roads and Covenant routes are curves. A course whose prerequisites are not complete has a lock on it and a gray picture, and can still be selected. On narrow screens it is a list that names each prerequisite.
- **Selected vehicle**: its picture, description, course length, prerequisite courses and instructors, and a button to book a lesson. The button is disabled and gray, with the reason below it, for a locked course (which courses to complete first) and once every lesson is booked. The first vehicle is selected to begin with; selecting another scrolls this into view if needed.
- **Lesson plan**: the selected course's lessons, each opening to the skills marked in it.
- **Instructors**: each instructor's picture, name, title and bio.

The catalog loads once per visit; a failure shows an error message in place of the tabs.

### Booking a Lesson

A dialog to choose an instructor, a day and a time in the next 14 days, in the viewer's time zone. It warns when a lesson starts too soon to be cancelled. If the time was just taken, it says so and loads the times again.

## My Lessons (`/lessons`)

**Upcoming** lessons, then **Past and cancelled** ones, with the vehicle, time, instructor and status. An upcoming lesson can be cancelled until 24 hours before it starts. **See results** shows how each skill went in a lesson that was signed off as attended.

## Schedule (`/schedule`)

Admins only; others are sent to Courses. Lessons **To sign off** (started and not signed off), **Upcoming** and **Signed off**, for everyone or, with the **View as** list, one instructor. The choice lasts until the page is reloaded or the account signs out.

### Lesson Form (`/schedule/:id`)

The student's name (their email until they have signed in) and the lesson's skills, each marked **Pass** or **Fail**; choosing the same one again clears it. Skills the student passed in an earlier attempt are shown as passed and cannot change. A line says what signing off would do.

- **Marks save as they are made**, from when the lesson starts, with a line saying whether everything is saved. One that fails shows **Not saved** and **Retry**; leaving the page with unsaved marks asks first.
- **Sign off lesson** works once the lesson has ended and every skill is marked and saved: all passed completes it, and otherwise the student repeats it.
- **Student missed it** works once the lesson has ended, and discards any marks.

Changes to a signed-off lesson are not saved until it is signed off again, which can be done until a later lesson in the course is signed off.
