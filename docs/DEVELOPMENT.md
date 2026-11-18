# Development

## Machine Setup

- Node 26 through nvm: `nvm install && nvm use` (reads `.nvmrc`).
- Docker (Docker Desktop on macOS) for the local Postgres.
- The Firebase CLI comes from the dev dependencies (`npx firebase`). The Auth emulator runs on Node, so no Java is needed.
- For E2E tests once: `npx playwright install chromium`.

## Running Locally

Four processes, each in its own terminal (Postgres runs in the background):

| Step | Command | What it does |
| --- | --- | --- |
| 1 | `npm run db:up` | Starts Postgres 18 in Docker on port **5433** (not 5432, to avoid a local install). |
| 2 | `npm run db:reset` | Wipes the local database, applies the migrations and seeds the catalog. Refuses non-local databases. |
| 3 | `npm run emulators` | Starts the Auth emulator (9099, UI on 4000) as `demo-halo-drivers-ed`, creates **cadet@example.com** and allowlists it as an admin. |
| 4 | `npm run dev:api` | Runs the API from source on **8081**, restarting on changes (`node --watch`). |
| 5 | `npm run dev` | Runs Vite on **5173**, proxying `/api` to the API. |

`npm run db:down` stops Postgres (the data stays in the `postgres-data` volume). `npm run emulators:stop` cleans up emulators left running by a crashed run.

### Against Staging

`npm run dev:staging` runs the web app against the real Firebase project. It needs an App Check debug token (see [Debug Tokens](DEPLOYMENT.md#debug-tokens)) and, for `/api`, a local API pointed at Neon; usually the emulators are what you want.

## Environment Files

Conventions are in [CLAUDE.md](../CLAUDE.md#environment-files). In short:

| File | Used by |
| --- | --- |
| `apps/web/.env.development` | `npm run dev`, the E2E tests: emulator, `demo-` project. |
| `apps/web/.env.staging` | `npm run dev:staging`, deploys. |
| `apps/web/.env.production` | Reserved; empty until a production project exists. |
| `apps/web/.env.example` | Template. |
| `apps/api/.env.development` | The API and the `db:*` scripts locally. Shell variables override it (Node's `--env-file` does not overwrite them), which is how the tests and `DATABASE_URL=... npm run db:allow` work. |

## Commands

| Command | What it does |
| --- | --- |
| `npm run lint` / `lint:fix` | ESLint over the whole repository. |
| `npm run type-check` | `vue-tsc --build` over every workspace. |
| `npm run build` | Type-check, then build the web app (`apps/web/dist`) and the API bundle (`apps/api/dist`). Needs no credentials. |
| `npm run test:unit` | Vitest unit tests: web (jsdom), API (no database), scripts. |
| `npm run test:db` | The API's database tests, in their own `halo_drivers_ed_test` database (recreated each run). Needs `npm run db:up`. |
| `npm run test:e2e` | Playwright. Starts its own Auth emulator, API (port 8082, `halo_drivers_ed_e2e` database, recreated each run) and Vite (5174). Needs `npm run db:up`. |
| `npm run db:generate` | Writes a migration for changes to `apps/api/src/db/schema.ts`. |
| `npm run db:migrate` / `db:seed` | Applies migrations / loads the catalog, on `DATABASE_URL` (local by default). |
| `npm run db:allow -- <email> [role]` | Allowlists an account (role defaults to `admin`). |
| `npm run deploy:api` / `deploy:web` | See [DEPLOYMENT.md](DEPLOYMENT.md). |

## Tests

- **Unit**: `apps/web/tests/unit` (stores and the API client with mocks), `apps/api/tests/unit` (routes with fake token verifier and repositories, config rules, catalog data), `tests/scripts`.
- **Database**: `apps/api/tests/db`. They prove the constraints hold in Postgres itself, such as rejecting an instructor who teaches another faction's vehicle.
- **E2E**: `apps/web/e2e`. Sign-in through the emulator's account chooser, the allowlist, and the courses page against the real API and database.

## CI

`.github/workflows/ci.yml` runs on every pull request and push to `main`:

- **checks**: lint, build (with type-check), unit tests.
- **integration-tests**: a Postgres 18 service container on port 5433 (matching `docker-compose.yml`), then the database and E2E tests. The Playwright report is uploaded on failure.

## Dependency Decisions

- **PrimeVue 4, not 5.** PrimeVue 5 (July 2026) is no longer MIT-licensed: it needs a PrimeUI license key, and without one it shows a license notice. The free Community License covers individuals and small organizations but must be renewed yearly. PrimeVue 4.5 is MIT. Moving to 5 later means getting a Community key, upgrading `primevue`, `@primevue/auto-import-resolver`, `@primeuix/themes` (3.x) and `primeicons` (8.x), and checking the changelog for API changes.
- **TypeScript 6.x**: TypeScript 7 does not expose the compiler API `vue-tsc` needs.
- **`@stylistic/eslint-plugin` 5.x**, matching the other Valiance Studios repositories.
- **Install scripts**: all denied in `allowScripts` (npm 12). None are needed: esbuild ships its binary as an optional platform package, and the rest (protobufjs, re2, fsevents, @firebase/util, @parcel/watcher) come from firebase-tools or are optional.
- **`npm audit`**: production dependencies are clean (`npm audit --omit=dev`). The `@grpc/grpc-js` override lifts a vulnerable copy nested under the Firebase web SDK's Firestore package (unused here). The remaining moderate findings are in dev tooling.
- **firebase-tools on Node 26** prints an `EBADENGINE` warning for `superstatic` (supports Node 20, 22, 24); it works.
