## Web Development Preferences

- Vue 3 with the **Options API** (not the Composition API), TypeScript and SCSS. Pinia for state, with Options-style stores.
- PrimeVue components are auto-imported in templates (`unplugin-vue-components`); import the app's own components explicitly.
- Component files are ordered template, then script, then style:

```HTML
<template>
  <!-- Markup. -->
</template>

<script lang="ts">
// Options API code in TypeScript.
</script>

<style lang="scss" scoped>
</style>
```

- CSS class names follow BEM (`card`, `card__title`, `card--featured`).
- Use TypeScript throughout, with types and interfaces shared through `@hde/shared` where both apps need them. Avoid `any`.

## Code Style

Vite+ (`vite-plus`) is the toolchain. Its configuration is in the root `vite.config.ts` (`fmt`, `lint` and `test` keys) and `apps/web/vite.config.ts`; don't add separate Oxlint, Oxfmt or Vitest config files (`vitest.db.config.ts` is the exception, so that `vp test` needs no database). Import from `vite-plus` and `vite-plus/test`, not `vite` and `vitest`.

Oxfmt (`npm run fmt`) formats the code and Oxlint lints it. ESLint is kept only for `eslint-plugin-vue` on `.vue` files (`eslint.config.js`), because Oxlint cannot lint templates; add other rules to Oxlint. `npm run lint` runs both. These conventions are not enforced by any of them but should be followed:

- Put `import type {...}` statements first as their own group, followed by a blank line, then value imports. Do not use inline `type` modifiers inside value imports (e.g. `import {foo, type Bar}`).
- Leave a blank line before a `try`, between consecutive `if` blocks, and before a `return` that follows a block.
- Do not let an imported name collide with a local method or function name; alias the import instead (e.g. `signOut as signOutFirebase` inside an action named `signOut`).
- Path aliases: `@/*` in the web app (via `resolve.tsconfigPaths: true`), `#src/*` in the API (package.json `imports`, which Node, Vite and esbuild all understand). Imports of TypeScript files in the API and shared package include the `.ts` extension, since Node runs them directly.
- Only erasable TypeScript syntax (`erasableSyntaxOnly`): no enums, namespaces or constructor parameter properties. Use `as const` arrays for enumerations.

## Database

- Schema lives in `apps/api/src/db/schema.ts`. After changing it, run `npm run db:generate` and commit the new migration in `apps/api/drizzle/`. Never edit an applied migration.
- Rules that must always hold belong in the database as constraints (foreign keys, checks, exclusion constraints), with a database test that proves the database rejects a violation.
- `npm run db:reset` refuses any non-local database. Do not weaken that guard.

## Testing

- Vitest for unit tests (`npm run test:unit`) and the API's database tests (`npm run test:db`, local Postgres).
- Playwright for E2E (`npm run test:e2e`). It starts its own emulator, API and Vite server on their own ports with `reuseExistingServer: false`, and its own database; never point it at a running dev server.

## Environment Files

The web app's env files are in `apps/web`, one per Vite mode, with no bare `.env`:

- `.env.development` (committed): the Auth emulator with a `demo-` project. Vite's default mode, also used by the E2E tests.
- `.env.example` (committed): a template for new env files.
- `.env.staging` (committed): the app hosted in `vs-halo-drivers-ed-dev`. Deploys build with `--mode staging`. Firebase web config is public; never put secrets in `VITE_` variables.
- `.env.production` (committed): reserved for a future production project; staging is production for now.
- `.env.*.local` (gitignored): personal overrides, such as an App Check debug token.

The API's `apps/api/.env.development` (committed) points at local Postgres and the emulator. Deployed settings come from Cloud Run env vars and Secret Manager, never from a file.

## Documentation

Each kind of content has one home. Link to it rather than repeating it.

| File | Holds |
| --- | --- |
| `README.md` | The introduction: what the app does and a quick start. |
| `ARCHITECTURE.md` | How the system is designed, all the Mermaid diagrams, the planned design, and Project Status. |
| `docs/UI.md` | What each page does and how it looks. |
| `docs/DEVELOPMENT.md` | Machine setup, running locally, commands, tests, CI, dependency decisions. |
| `docs/DEPLOYMENT.md` | One-time setup, deploying, App Check, credential lockdown. |

### Mermaid Diagrams

Mermaid diagrams in `ARCHITECTURE.md` are required, and a stale diagram counts as a bug.

- **Update diagrams in the same change.** Check the "Diagram Index" in `ARCHITECTURE.md`: if a change touches a source listed there, update that diagram to match the code.
- **Add a diagram for anything new with more than one moving part**, and a row for it in the Diagram Index.
- **Draw what the code does**, using its real names. Keep each diagram to one idea, and set no custom colors or themes.
- **Check that they render** before committing, writing only to a scratch directory outside the repository:

  ```sh
  node -e "import('@playwright/test').then(({chromium}) => console.log(JSON.stringify({executablePath: chromium.executablePath()})))" > <scratch dir>/puppeteer.json
  npx -y -p @mermaid-js/mermaid-cli mmdc -p <scratch dir>/puppeteer.json -i ARCHITECTURE.md -o <scratch dir>/out.md -e png -s 2
  ```

## Workflow

- Keep the documentation up to date in each change, including "Project Status" in `ARCHITECTURE.md`, the handoff document between sessions.
- Work on a feature branch (e.g. `feature/<name>`) per step, never directly on `main`. The user reviews and merges pull requests.
- Only commit, push, or open a pull request when asked.
- Before opening a pull request, run `npm run check` (formatting and lint), `npm run build` (includes the type-check), `npm run test:unit`, `npm run test:db` and `npm run test:e2e`.
- Pull request descriptions include a Summary, a Test plan checklist, and Notes for decisions or caveats.
