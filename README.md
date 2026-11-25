# Halo Drivers Ed

A Halo-themed driver's education app. Students learn to drive UNSC vehicles (Mongoose, Warthog, Scorpion, Hornet, Pelican) from instructors such as Master Chief and Sergeant Johnson, or Covenant vehicles (Ghost, Banshee, Wraith, Phantom, Scarab) from the Arbiter, Shipmaster Rtas 'Vadum and the Prophet of Truth. Each vehicle has its own lesson length, number of lessons and prerequisite courses.

**Try it: https://vs-halo-drivers-ed-dev.web.app.** Choose **Try the demo** to look around without an account. A demo lasts two hours and starts with some lessons already taken. The first request after a quiet spell takes a moment, since everything scales to zero.

## Features

- **Courses** drawn as a route along their prerequisites, by faction. A course unlocks once the ones before it are complete.
- **Booking** with an instructor, and rescheduling or cancelling until a day before. Instructors, vehicles and students cannot be double-booked.
- **Lesson plans and sign-off**: instructors mark each skill pass or fail, leave notes and sign lessons off. Students see their results, repeat lessons they did not pass, and follow their progress.
- **Certificates** for completed courses, to print or save as a PDF.
- **A schedule** for admins, as any instructor, with instructors' time off.
- **Accounts**: Google sign-in limited to an allowlist, and self-serve demos that clean up after themselves. Demo guests can also sign off their own lessons, to see the instructor's side.
- **Themes**: UNSC and Covenant, each light and dark.

## How It Is Built

Vue 3, TypeScript, PrimeVue and Pinia on Firebase Hosting; a Hono API on Cloud Run; PostgreSQL on Neon. Some parts worth a look:

- Rules that must never break are database constraints, such as exclusion constraints against double-booking, with tests that prove Postgres enforces them.
- Changes that could race, such as two students booking the last free time, are made under row locks and tested by running them together.
- Every request needs an App Check token, a verified sign-in and a place on the allowlist (or a live demo), within rate limits. The site has a strict Content Security Policy.
- Each deployed workload has its own service account, and the API's database role cannot change the schema.
- CI runs unit tests, database tests against real Postgres, and Playwright tests against the whole app.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): the design, with diagrams, and [Project Status](ARCHITECTURE.md#project-status).
- [docs/UI.md](docs/UI.md): what each page does.
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): setup, commands, tests and dependency decisions.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): setting up the cloud side, and deploying.

## Quick Start

Needs Node 26 (`nvm install && nvm use`) and Docker.

```sh
npm install
npm run db:up        # Postgres in Docker
npm run db:reset     # migrate and seed the local database
npm run emulators    # Auth emulator, with an allowlisted account (keep it running)
npm run dev:api      # the API on :8081 (another terminal)
npm run dev          # the web app on :5173 (another terminal)
```

Open http://localhost:5173 and sign in with **cadet@example.com** from the emulator's account chooser. More in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## License and Disclaimer

A non-commercial fan project and portfolio piece, not affiliated with or endorsed by Microsoft. Halo, its characters and its vehicles belong to Microsoft. The app uses no official artwork or logos; its drawings are original.

The source code is available under the [MIT License](LICENSE). It does not cover the drawings in `apps/web/src/assets/artwork`, or Halo names, characters, vehicles or other Microsoft intellectual property, and grants no rights to them.
