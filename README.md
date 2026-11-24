# Halo Drivers Ed

A Halo-themed driver's education app. Students learn to drive UNSC vehicles (Mongoose, Warthog, Scorpion, Hornet, Pelican) from instructors such as Master Chief and Sergeant Johnson, or Covenant vehicles (Ghost, Banshee, Wraith, Phantom, Scarab) from the Arbiter, Shipmaster Rtas 'Vadum and the Prophet of Truth. Each vehicle has its own lesson length, number of lessons and prerequisite courses.

A non-commercial fan project and portfolio piece. Halo and its characters belong to Microsoft; this app uses no official artwork or logos.

## Features

- Google sign-in, limited to an allowlist held by the API.
- Course catalog by faction, drawn as a route along the prerequisites: what each vehicle's course covers, how long it takes, what it requires and who teaches it.
- UNSC and Covenant themes, each with light and dark modes.

Coming next: booking lessons, an admin "View As" mode for each instructor, and self-serve demo access for recruiters. See [Project Status](ARCHITECTURE.md#project-status).

## Stack

Vue 3 + TypeScript, PrimeVue and Pinia on Firebase Hosting; a Hono API on Cloud Run; PostgreSQL on Neon. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Quick Start

Needs Node 26 (`nvm use`) and Docker.

```sh
npm install
npm run db:up        # Postgres in Docker
npm run db:reset     # migrate and seed the local database
npm run emulators    # Auth emulator, with an allowlisted account (keep it running)
npm run dev:api      # the API on :8081 (another terminal)
npm run dev          # the web app on :5173 (another terminal)
```

Sign in with **cadet@example.com** from the emulator's account chooser. More in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
