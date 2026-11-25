# Halo Drivers Ed Architecture

How the app is put together, and the main handoff document between sessions. Current status and what comes next are under [Project Status](#project-status).

## Documentation Map

| Document | Read it for |
| --- | --- |
| [README.md](README.md) | The introduction: what the app does and a quick start. |
| **ARCHITECTURE.md** (this file) | How the system is designed, with diagrams, and Project Status. |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Machine setup, running locally, env files, commands, tests, CI, dependency decisions. |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | One-time GCP, Neon and Firebase setup, deploying, App Check, credential lockdown. |
| [docs/UI.md](docs/UI.md) | What each page does and how it looks. |

## System Overview

A Vue single-page app served by Firebase Hosting, with its own API on Cloud Run and a PostgreSQL database on Neon. The browser never talks to the database: every request goes through the API, which checks an App Check token, a Firebase ID token and the allowlist, and limits each account's requests. Hosting forwards `/api/**` to the Cloud Run service, so the app and the API share one origin (no CORS).

The app is closed: only allowlisted accounts can sign in. Recruiters and hiring managers get in through self-serve [demo](#demo) slots.

```mermaid
flowchart LR
    user([Signed-in user])

    subgraph browser["Browser"]
        spa["Vue app<br/>(PrimeVue, Pinia)"]
    end

    subgraph gcp["GCP project vs-halo-drivers-ed-dev"]
        hosting["Firebase Hosting<br/>vs-halo-drivers-ed-dev.web.app"]
        auth["Firebase Authentication<br/>Google and anonymous sign-in"]
        appcheck["Firebase App Check"]
        api["Cloud Run service hde-api<br/>(Hono, Node 26)"]
        migrate["Cloud Run job hde-migrate"]
        secrets["Secret Manager<br/>database URLs"]
    end

    neon[("Neon PostgreSQL<br/>(free tier)")]
    recaptcha["reCAPTCHA Enterprise"]

    user --> spa
    hosting -- "serves the bundle" --> spa
    spa -- "sign-in" --> auth
    spa -- "attests the page" --> recaptcha
    spa -- "exchanges the attestation<br/>for a token" --> appcheck
    spa -- "/api/** with ID and<br/>App Check tokens" --> hosting
    hosting -- "rewrite /api/**" --> api
    api -- "verifies tokens<br/>(public keys)" --> auth
    api -- "SQL over TLS<br/>(pooled endpoint)" --> neon
    migrate -- "migrations and seed<br/>before each deploy" --> neon
    secrets -. "DATABASE_URL" .-> api
    secrets -. "DATABASE_URL" .-> migrate
```

### Tech Stack

- **Monorepo** with npm workspaces: `apps/web`, `apps/api`, `packages/shared`.
- **Web**: Vue 3 (Options API) + TypeScript, PrimeVue 4 (Aura, colored by the app's [theme tokens](#theming); components auto-imported), Pinia, Vue Router, SCSS with BEM class names, self-hosted fonts (Fontsource), Vite (through Vite+).
- **API**: Node 26 + TypeScript, Hono on `@hono/node-server`, Drizzle ORM and drizzle-kit migrations, `pg`, Firebase Admin SDK (token verification only). Run from source with Node's type stripping in development; bundled with esbuild for the container.
- **Shared**: the API's request and response types and constants, and the booking rules both apps apply (`@hde/shared`), imported as TypeScript source by both apps.
- **Data**: PostgreSQL 18; Neon in production, Docker Compose locally.
- **Tests**: Vitest (unit, and database tests against local Postgres), Playwright (E2E against the Auth emulator, a local API and the database).
- **Tooling**: Vite+ (`vite-plus`), which bundles Vite, Vitest, Oxlint and Oxfmt; configured in the root `vite.config.ts` and `apps/web/vite.config.ts`. ESLint runs only `eslint-plugin-vue`, on Vue components.

TypeScript is pinned to 6.x: TypeScript 7 (native compiler) does not expose the JS compiler API `vue-tsc` needs.

### Why These Choices

- **Neon instead of Cloud SQL.** Cloud SQL never scales to zero (about $10 a month idle). Neon's free tier (100 compute hours and 1 GB per project) suspends after 5 idle minutes, which suits a portfolio app; the first request after a pause takes about half a second longer. Moving to Cloud SQL later only changes the connection strings. Postgres cannot run on Cloud Run itself: its disk is not persistent.
- **One Cloud Run service, not a function per endpoint.** Bookings need transactions and a connection pool; a long-lived service with its own pool fits that better, and it still scales to zero.
- **Hosting rewrite instead of a separate API domain.** Same origin, so no CORS, and one domain for the API key and reCAPTCHA restrictions. The service allows unauthenticated invocation because Hosting calls it without IAM credentials; the API's own checks protect it.
- **Postgres constraints over application checks.** Rules that must never break live in the database: an instructor can only teach their own faction's vehicles (composite foreign keys), and exclusion constraints prevent double-booking.

## Application Layers

```mermaid
flowchart TB
    subgraph web["apps/web"]
        views["views/ and components/<br/>(Options API, PrimeVue)"]
        stores["stores/<br/>auth, bookings, catalog,<br/>progress, theme, viewAs"]
        client["services/apiClient.ts<br/>ApiClient + TokenSource"]
        plugins["plugins/<br/>firebase, appCheck, primevue"]
        views --> stores
        stores --> client
        client --> plugins
    end

    subgraph api["apps/api"]
        app["src/app.ts<br/>routes, requireIdentity,<br/>requireAllowed"]
        limits["src/http/rateLimits.ts<br/>RateLimiter"]
        verifier["src/auth/tokenVerifier.ts"]
        bookingRoutes["src/http/bookingRoutes.ts"]
        service["src/bookings/<br/>BookingService, findSlots"]
        demoRoutes["src/http/demoRoutes.ts"]
        demo["src/demo/<br/>demoHistory"]
        lessonRoutes["src/http/lessonRoutes.ts<br/>+ requireAdmin, requireGuest"]
        lessonService["src/lessons/<br/>LessonService"]
        repos["src/repositories/<br/>catalog, allowlist, bookings,<br/>demo, lessons"]
        db["src/db/<br/>schema, client, migrations, seed"]
        app --> verifier
        app --> limits
        app --> repos
        app --> bookingRoutes
        bookingRoutes --> service
        service --> repos
        app --> demoRoutes
        demoRoutes --> repos
        repos --> demo
        app --> lessonRoutes
        lessonRoutes --> lessonService
        lessonService --> repos
        repos --> db
    end

    shared["packages/shared<br/>types, constants and<br/>the booking rules"]

    client -- "HTTP /api" --> app
    web -. "imports" .-> shared
    api -. "imports types and constants" .-> shared
```

The API's routes depend on interfaces (`TokenVerifier`, `CatalogRepository`, `AllowlistRepository`, `BookingRepository`, `DemoRepository`, `LessonRepository`), and `src/server.ts` wires in the Firebase and Postgres implementations. The unit tests pass fakes instead, so they need neither Firebase nor a database.

## Request Authorization

Every route under `/api` except `/api/health` goes through `requireIdentity`, `rateLimit` and `requireAllowed`, set up in `apps/api/src/app.ts`. The web app's `ApiClient` attaches both tokens to each request.

```mermaid
sequenceDiagram
    participant B as Browser (ApiClient)
    participant H as Firebase Hosting
    participant A as hde-api (createApp)
    participant P as Postgres

    B->>H: GET /api/vehicles<br/>Authorization: Bearer ID token<br/>X-Firebase-AppCheck: token
    H->>A: rewrite /api/**
    Note right of A: body over 16 KB: 413 request-too-large
    alt APP_CHECK=required
        A->>A: verifyAppCheckToken
        Note right of A: invalid: 401 app-check-failed
    end
    A->>A: verifyIdToken
    Note right of A: missing or invalid: 401 unauthenticated
    A->>A: RateLimiter.hit(uid)
    Note right of A: over the limit: 429 rate-limited
    alt anonymous account
        A->>P: findGuest(uid)
        Note right of A: no live session: 403 demo-ended<br/>(/api/demo-sessions skips this)
    else signed-in account
        A->>P: SELECT role FROM allowed_users WHERE email = ?
        Note right of A: no row, or no verified email<br/>(not queried): 403 not-allowed
    end
    Note right of A: /api/admin/** and not an admin: 403 not-admin<br/>/api/demo/** and not a guest: 403 not-allowed
    A->>P: the route's queries
    A-->>B: 200 JSON
```

- An email counts only if the token says it is verified (`toVerifiedUser`). Otherwise, if email/password sign-in were ever enabled, someone could register an allowlisted address.
- Each account may make 240 requests a minute, 60 of them writes (`DEFAULT_RATE_LIMITS`). The counts are in memory, so with up to 2 Cloud Run instances an account could get twice that. They come before the allowlist query, so a stranger's account cannot load the database either.
- An ID token stays valid for up to an hour after sign-out, accepted because removing an account from the allowlist takes effect at once.

`APP_CHECK=off` exists only for the emulators. `loadConfig` refuses to start on Cloud Run (`K_SERVICE` set) with App Check off or with `FIREBASE_AUTH_EMULATOR_HOST` set, since either would let anyone in.

On the web side, `stores/auth.ts` calls `GET /api/me` after each Google sign-in. A `not-allowed` answer signs the account out with a message on the login page; other failures keep it signed in so a retry can succeed. The popup and the auth listener share one check.

## Security Headers

`firebase.json` sends a Content Security Policy, `X-Content-Type-Options` and `Referrer-Policy` with the site's own files. What the policy allows, and why:

| Directive | Allows | For |
| --- | --- | --- |
| `script-src`, `frame-src`, `connect-src` | `www.google.com/recaptcha/`, `www.gstatic.com/recaptcha/` (scripts) | App Check's reCAPTCHA |
| `script-src` | `apis.google.com` | The sign-in frame's loader |
| `frame-src` | `vs-halo-drivers-ed-dev.firebaseapp.com` | The sign-in frame |
| `connect-src` | `identitytoolkit`, `securetoken` and `content-firebaseappcheck` on `googleapis.com` | Firebase Auth and App Check |
| `style-src` | `'unsafe-inline'` | PrimeVue adds its styles to the page at runtime, and static hosting cannot give them nonces |
| `img-src` | `data:` | Small drawings, inlined by Vite |

- The rule's `regex` leaves out `/__/**`, Firebase's own pages: the app frames the sign-in one from another domain, which `frame-ancestors 'none'` would block.
- `Referrer-Policy` must keep sending the origin, since the API key and reCAPTCHA key check it.
- There is no `Cross-Origin-Opener-Policy`, which could cut off the sign-in popup.
- The emulators and the dev server do not send these headers, so changes to them need testing on the deployed site. A production project needs its own `firebaseapp.com` domain in `frame-src`.

## Booking

`GET /api/slots` offers times from the instructor's hours, half an hour apart, for the next 14 days, leaving out any that clash with a lesson of the student, instructor or vehicle. `POST /api/bookings` checks the time is still offered, then books it in a transaction. The student's `allowed_users` row is locked for the prerequisite and lesson-count checks, so two requests cannot both pass them; the exclusion constraints settle races between students.

```mermaid
sequenceDiagram
    participant D as BookingDialog
    participant S as BookingService
    participant R as PostgresBookingRepository
    participant P as Postgres

    D->>S: POST /api/bookings
    S->>R: listAvailability, listBusy
    S->>S: findSlots
    Note right of S: not offered: 409 slot-unavailable
    S->>R: create(booking, check)
    R->>P: BEGIN, SELECT allowed_users FOR UPDATE
    R->>P: SELECT the student's bookings
    R->>S: check(existing)
    Note right of S: 409 course-locked or no-lessons-left
    R->>P: INSERT INTO bookings
    Note right of P: overlap (23P01): 409 slot-unavailable
    R->>P: COMMIT
    S-->>D: 201 Booking
```

A lesson can be cancelled until 24 hours before it starts. It counts toward its course when completed, and a missed or cancelled lesson can be booked again. Completed courses are worked out from the bookings (`completedCourses` in `@hde/shared`), by the API to enforce locks and by `stores/progress.ts` to show them.

## Demo

"Try the demo" on the login page signs the visitor in anonymously with Firebase, then claims one of the rows in `demo_slots` (`DEMO_SLOTS`). The row count is the cap, and `FOR UPDATE SKIP LOCKED` gives visitors who arrive together different rows. A row whose session expired is free to reuse, and requests clear expired guests, so no scheduled job is needed.

```mermaid
sequenceDiagram
    participant W as stores/auth.ts
    participant F as Firebase Auth
    participant A as demoRoutes
    participant P as Postgres (PostgresDemoRepository)

    W->>F: signInAnonymously
    W->>A: POST /api/demo-sessions
    A->>P: BEGIN, advisory lock on the uid
    alt already has a session
        P-->>A: its end time
    else a slot is free or expired
        A->>P: SELECT demo_slots FOR UPDATE SKIP LOCKED
        A->>P: empty it, DELETE the old guest (cascades to their lessons)
        A->>P: INSERT the guest into allowed_users, with past lessons
        A->>P: COMMIT
        A-->>W: claimed, endsAt
        W->>A: GET /api/me (role guest, demoEndsAt)
    else every slot is taken
        A-->>W: not claimed, nextFreeAt
        W->>F: deleteUser (else signOut)
    end
    A->>P: clearExpired: delete other expired guests
    W->>A: on sign-out: DELETE /api/demo-sessions
    W->>F: deleteUser (else signOut)
```

- **Identity.** A guest is an `allowed_users` row with the role `guest` and a made-up `@demo.invalid` address, so bookings, locks and cascades work as for anyone else. A check constraint ties the role to that domain, where no real address can exist, and the allowlist lookup never returns guests. They are found by the anonymous `uid` in their slot, only until it expires (`demo-ended` after that).
- **Limits.** Guests are students, and can book `DEMO_BOOKING_LIMIT` lessons, counting cancelled and signed-off ones. The check runs under the same lock as the other booking rules.
- **Past lessons.** Guests start with the Mongoose course completed, which unlocks the Warthog, and a Warthog lesson to repeat (`demoHistory.ts`). Each slot's are in a week of its own, in free times, so guests never clash.
- **Expired guests** lose access at once. Their data is deleted by the next claim, or the next request their lessons could affect: `GET /api/slots`, `POST /api/bookings` and `GET /api/admin/lessons` (`clearExpiredDemos`). Signing out deletes it immediately.
- **Anonymous accounts** are deleted by the browser on sign-out, or when the demo is full or over, unless Firebase refuses. A visitor who closes the tab leaves theirs in Firebase; deleting those would need Identity Platform or an API that may delete Firebase users.
- **In the schedule**, guests' lessons are hidden unless an admin checks "Show demo guests".
- **A visitor could take every slot** by signing in anonymously repeatedly. App Check makes that harder, and slots free up when they expire.

## Lesson Sign-Off

Each booked lesson has a form: the skills of the first lesson in its course the student has not completed. From when the lesson starts, each mark is saved on its own (`PUT /api/:scope/lessons/:id/results/:skillId`), so marks made together do not overwrite each other; `MarkSaver` in the web app sends one skill's marks in order. The lesson is signed off once it ends (`PUT .../sign-off`). Both refuse to be early unless the request says `early: true`, an override only the accounts that sign lessons off have. The instructors are seeded characters, so others do this, optionally viewing as one (`?instructor=` on `GET /api/:scope/lessons`, a filter rather than another sign-in).

The scope is `admin` for admins (`requireAdmin`), who sign off everyone's lessons, or `demo` for [demo](#demo) guests (`requireGuest`), who sign off only their own. Both use `signOffRoutes`. For guests, `LessonService` takes their address as `student` and answers any other lesson as if it did not exist, checking changes inside the transaction that makes them.

```mermaid
stateDiagram-v2
    [*] --> booked
    booked --> cancelled: student cancels, 24 hours before
    booked --> booked: skill marked
    booked --> completed: attended, every skill passed
    booked --> repeat: attended, some not passed
    booked --> missed: student missed it
    completed --> repeat: corrected
    completed --> missed: corrected
    repeat --> completed: corrected
    repeat --> missed: corrected
    missed --> completed: corrected
    missed --> repeat: corrected
```

- Only `completed` counts toward the course. After `repeat`, the next lesson has the same form, with the skills already passed kept.
- Lessons in a course are signed off in order, and one can be corrected until a later one is signed off.
- A correction is refused if it would lock a course the student has lessons in, or leave them with more lessons than the course has.
- `PostgresLessonRepository.update` takes the same lock on the student's `allowed_users` row as booking does, so neither can change what the other decided on.

## Theming

A theme is a faction plus a color mode. `stores/theme.ts` sets classes on `<html>`, which select the tokens in `styles/themes.scss`. PrimeVue's preset only refers to those tokens, so switching needs no new preset.

```mermaid
flowchart LR
    factionToggle["FactionToggle"] -- "toggleFaction()" --> store
    modeToggle["ThemeToggle"] -- "toggle()" --> store
    system["prefers-color-scheme"] -- "until a mode is chosen" --> store
    store["stores/theme.ts"] <-- "load, save" --> storage[("localStorage<br/>theme, theme-faction")]
    store -- "theme-unsc or theme-covenant,<br/>app-dark" --> html["html element classes"]
    html -- "select" --> tokens["styles/themes.scss<br/>--app-* tokens"]
    tokens --> components["App components"]
    tokens --> preset["plugins/primevue.ts<br/>HaloPreset"]
    preset --> prime["PrimeVue components"]
```

## Data Model

```mermaid
erDiagram
    vehicles {
        text slug PK
        text name
        faction faction
        vehicle_domain domain
        text description
        int lesson_minutes
        int lessons_required
    }
    vehicle_prerequisites {
        text vehicle_slug PK,FK
        text prerequisite_slug PK,FK
    }
    instructors {
        text slug PK
        text name
        text title
        faction faction
        text bio
    }
    instructor_vehicles {
        text instructor_slug PK,FK
        text vehicle_slug PK,FK
        faction faction FK
    }
    instructor_availability {
        text instructor_slug PK,FK
        int weekday PK
        time starts_at PK
        time ends_at
    }
    bookings {
        uuid id PK
        text student_email FK
        text instructor_slug FK
        text vehicle_slug FK
        faction faction FK
        timestamptz starts_at
        timestamptz ends_at
        booking_status status
        int lesson_number FK
        text signed_off_by
        timestamptz signed_off_at
        timestamptz created_at
    }
    course_lessons {
        text vehicle_slug PK,FK
        int number PK
        text title
    }
    lesson_skills {
        text vehicle_slug PK,FK
        int lesson_number PK,FK
        text id PK
        int position
        text label
        boolean active
    }
    skill_results {
        uuid booking_id PK,FK
        text vehicle_slug FK
        int lesson_number PK,FK
        text skill_id PK,FK
        skill_result result
    }
    allowed_users {
        text email PK
        text display_name
        role role
        timestamptz created_at
    }

    demo_slots {
        int id PK
        text uid UK
        text guest_email FK
        timestamptz expires_at
    }

    allowed_users |o--o| demo_slots : "is the guest in"
    vehicles ||--o{ vehicle_prerequisites : "requires"
    vehicles ||--o{ vehicle_prerequisites : "is required by"
    instructors ||--o{ instructor_vehicles : "teaches"
    vehicles ||--o{ instructor_vehicles : "is taught in"
    instructors ||--o{ instructor_availability : "teaches during"
    allowed_users ||--o{ bookings : "books"
    instructors ||--o{ bookings : "teaches"
    vehicles ||--o{ bookings : "is used in"
    vehicles ||--o{ course_lessons : "is taught over"
    course_lessons ||--o{ lesson_skills : "marks"
    course_lessons |o--o{ bookings : "was given in"
    bookings ||--o{ skill_results : "has"
    lesson_skills ||--o{ skill_results : "is marked in"
```

- `faction` is an enum (`unsc`, `covenant`). `instructor_vehicles.faction` is part of both foreign keys, to `instructors(slug, faction)` and `vehicles(slug, faction)`, so a mismatch is rejected by Postgres.
- `allowed_users.email` is stored lowercase (a check constraint enforces it). `role` is `admin`, `student` or `guest`: all can book, and only admins reach `/api/admin`. Guests come and go with their [demo](#demo) session.
- `bookings` has three exclusion constraints (migration `0002_booking_exclusions`, using `btree_gist`): a student, an instructor and a vehicle each have one lesson at a time. Cancelled lessons do not count. It references vehicles and instructors with their faction, but not `instructor_vehicles`, which each seed replaces.
- `instructor_availability` holds wall-clock times in `America/New_York`, seeded from `apps/api/src/db/availabilityData.ts`.
- `allowed_users.display_name` is the Google account's name, stored by `GET /api/me` at sign-in, so instructors can see who a student is.
- `course_lessons` and `lesson_skills` are seeded from `apps/api/src/db/curriculumData.ts`. A skill dropped from the data becomes inactive rather than deleted, since results refer to it, so skill ids must not be reused.
- Checks on `bookings` require a signature on signed-off lessons, and a lesson number on attended ones.
- The catalog (vehicles, instructors, who teaches what) is seed data in `apps/api/src/db/catalogData.ts`, loaded by `npm run db:seed`. Instructors are seeded characters, not accounts.
- Schema changes: edit `apps/api/src/db/schema.ts`, run `npm run db:generate`, and commit the new file in `apps/api/drizzle/`.

## Deployment

```mermaid
flowchart LR
    dev([npm run deploy:api]) --> build["Cloud Build<br/>apps/api/Dockerfile"]
    build --> registry[("Artifact Registry<br/>hde/api:commit")]
    registry --> job["Cloud Run job hde-migrate<br/>node dist/release.js<br/>(migrate, seed catalog)"]
    job -- "succeeded" --> service["Cloud Run service hde-api<br/>node dist/server.js"]
    web([npm run deploy:web]) --> check["check-firebase-config.ts<br/>staging"]
    check --> vite["vp build --mode staging"]
    vite --> hosting["Firebase Hosting"]
```

One image holds both entry points. Migrations and the catalog seed run as their own job, with an owner database role, before the service rolls out; the service uses a role that can only read and write rows. Details and the one-time setup are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Planned Design

Agreed, not built yet. Build these on their own branches, in this order.

### Lesson Notes and Student History

- Instructors write a note on the form that the student can read with their results, since a student who must repeat a lesson is not told why. Perhaps also a private one for the next instructor.
- The form shows the student's past results, repeated skills and notes. It only carries over passed skills today.
- A student's view of each course: skills passed, skills to repeat and what the next lesson covers.

### Instructor Cancellation and Time Off

- An instructor's side can cancel a lesson, with a reason. Only students can today, so an instructor's absence is left booked or recorded as `missed`, which wrongly blames the student.
- Time off for an instructor on given dates. Hours are only weekly seed data.

### Rescheduling

A student moves a lesson to another time in one transaction, under the same 24-hour rule, rather than giving up the old time before they have the new one.

### Certificates

A license for each completed course.

### Ideas, Not Planned

Ending a demo after 30 idle minutes, if visitors take up places. Calendar (`.ics`) downloads, email reminders (need a mail provider), and an `instructor` role limited to its own lessons (View As covers it for now). Messaging, payments and ratings are left out.

## Diagram Index

Every diagram in this file, and what it depends on. A change to these sources updates the matching diagram in the same pull request.

| Diagram | Section | Update it when these change |
| --- | --- | --- |
| System context | [System Overview](#system-overview) | GCP or Firebase services, Neon, `firebase.json` rewrites, `apps/web/src/plugins/firebase.ts` |
| Application layers | [Application Layers](#application-layers) | Folders under `apps/*/src`, `packages/shared`, `apps/api/src/server.ts` |
| Request authorization | [Request Authorization](#request-authorization) | `apps/api/src/app.ts`, `apps/api/src/http/rateLimits.ts`, `apps/api/src/auth/tokenVerifier.ts`, `apps/api/src/config.ts`, `apps/web/src/services/apiClient.ts`, `apps/web/src/stores/auth.ts` |
| Booking | [Booking](#booking) | `apps/api/src/bookings/`, `apps/api/src/http/bookingRoutes.ts`, `apps/api/src/repositories/bookingRepository.ts`, `packages/shared/src/bookings.ts` |
| Demo | [Demo](#demo) | `apps/api/src/http/demoRoutes.ts`, `apps/api/src/repositories/demoRepository.ts`, `apps/api/src/demo/`, `packages/shared/src/demo.ts`, `apps/web/src/stores/auth.ts` |
| Lesson sign-off | [Lesson Sign-Off](#lesson-sign-off) | `apps/api/src/lessons/`, `apps/api/src/http/lessonRoutes.ts`, `apps/api/src/repositories/lessonRepository.ts`, `packages/shared/src/curriculum.ts` |
| Theming | [Theming](#theming) | `apps/web/src/stores/theme.ts`, `apps/web/src/utils/themePreference.ts`, `apps/web/src/styles/themes.scss`, `apps/web/src/plugins/primevue.ts`, `FactionToggle.vue`, `ThemeToggle.vue` |
| Tables | [Data Model](#data-model) | `apps/api/src/db/schema.ts`, `apps/api/drizzle/` |
| Deploy pipeline | [Deployment](#deployment) | `scripts/deploy-api.ts`, `apps/api/Dockerfile`, `apps/api/cloudbuild.yaml`, `firebase.json` |

## Project Status

### Done

- Monorepo scaffold: web (Vue 3 Options API, PrimeVue 4, Pinia, Router), API (Hono, Drizzle), shared types; Vite+ (Vite, Vitest, Oxlint, Oxfmt), ESLint for Vue components, Playwright, CI.
- Google sign-in with the allowlist held by the API (`GET /api/me`), and a route guard.
- API with App Check and ID token checks, JSON errors, and a config that refuses unsafe settings on Cloud Run.
- Security hardening: verified emails only, request size and per-account rate limits, and [security headers](#security-headers). Deployed on 2026-11-24 and checked on the site: no policy violations in the console, and no policy on `/__/auth/`.
- Postgres schema and first migration: vehicles, prerequisites, instructors, who teaches what, allowlist. Seeded catalog of 10 vehicles and 6 instructors.
- Courses page: vehicles on a route map of their prerequisites, and instructors, by faction.
- Locks on courses whose prerequisites are not complete, enforced by the API.
- Booking: instructor hours, lesson times, booking and cancelling, My lessons, and exclusion constraints against double-booking.
- Lesson plans (53 lessons), instructors' lesson forms, sign-off that unlocks courses, and admins' schedule with View As. Demo guests have the same for their own lessons.
- A `student` role, which can book but not sign off.
- [Demo](#demo) slots for recruiters: 10 at once, 2 hours each. Deployed and tried on the site on 2026-11-24, including that signing out removes the anonymous account.
- UNSC and Covenant themes, each light and dark, with placeholder artwork.
- Local development with Docker Postgres and the Auth emulator; unit, database and E2E tests.
- API image, Cloud Build config and deploy script (migrate job, then service).
- Deployed on 2026-11-19 to `vs-halo-drivers-ed-dev`: the `hde-api` Cloud Run service, the `hde-migrate` job (tables and catalog seed in Neon) and the site at https://vs-halo-drivers-ed-dev.web.app, with the owner's account allowlisted. The whole [one-time setup](docs/DEPLOYMENT.md#one-time-setup) is done.
- App Check: reCAPTCHA Enterprise registered for the web app, enforced for Authentication and required by the API; a debug token for `npm run dev:staging`, which proxies `/api` to the deployed API.
- Credentials locked down: the Firebase web API key allows only the hosted domains and `localhost:5173`, and only the Identity Toolkit, Token Service and App Check APIs; each service account has only its listed roles.

### To Check

- Guest sign-off is not deployed. Deploy the API, then the site, and complete the Warthog course in a demo.
- The prompt when leaving a lesson form with unsaved marks has no test.
- Accounts allowlisted before the `student` role existed are admins, who can sign off everyone's lessons. Change others with `npm run db:allow -- <email> student`.

### Next: Decisions (need the owner)

1. PrimeVue 5 (see [Dependency Decisions](docs/DEVELOPMENT.md#dependency-decisions)).
2. The repository's visibility (private for now).

### Next: Features

1. [Lesson notes and student history](#lesson-notes-and-student-history).
2. [Instructor cancellation and time off](#instructor-cancellation-and-time-off).
3. [Rescheduling](#rescheduling).
4. [Certificates](#certificates).
5. Final artwork: the vehicle and instructor drawings are temporary placeholders that do not closely resemble their Halo 3 designs. Options considered: the owner's own screenshots (under Microsoft's Game Content Usage Rules, with their notice), generated images, or commissioned art. Flat shapes drawn in code cannot get close. See [Artwork](docs/UI.md#artwork).
