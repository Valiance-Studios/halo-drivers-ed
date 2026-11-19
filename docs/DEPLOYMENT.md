# Deployment

Deploys run locally, not from CI. The pipeline as a diagram is under [Deployment](../ARCHITECTURE.md#deployment) in `ARCHITECTURE.md`.

Everything lives in the GCP project **`vs-halo-drivers-ed-dev`** (number 427425852003), region **`us-central1`**, except the database, which is on Neon. The commands below pass `--project` explicitly, since the default `gcloud` project on this machine may be another one.

## One-Time Setup

Done so far: the Firebase web app "Halo Drivers Ed" (config in `apps/web/.env.staging`), these APIs enabled: Cloud Run, Artifact Registry, Cloud Build, Secret Manager, IAM, Firebase App Check, reCAPTCHA Enterprise, API Keys, and steps 1 to 5 below. Step 6 waits for the first deploy.

Not yet tested end to end: `npm run deploy:api` was written with the scaffold but not run against real resources. Expect small fixes on the first deploy.

### 1. Neon

1. Create a Neon project, e.g. `halo-drivers-ed`: Postgres 18, region **AWS US East 2 (Ohio)**, the closest to `us-central1`. Name the database `halo_drivers_ed`.
2. Use two roles, so the running API cannot change the schema:
   - **`hde_owner`**: owns the schema and runs migrations. Create it in the Neon console (Roles), or use the owner role Neon created.
   - **`hde_app`**: the API's role, reading and writing rows only. Create it with SQL as `hde_owner`, so it does not get Neon's `neon_superuser` membership, **before the first migration**, so the default privileges cover the tables it creates:

     Replace `<generated password>` with a URL-safe password, such as the output of `openssl rand -hex 32`, since it also goes into a connection string. Postgres does not generate one.

     ```sql
     CREATE ROLE hde_app WITH LOGIN PASSWORD '<generated password>';
     GRANT USAGE ON SCHEMA public TO hde_app;
     ALTER DEFAULT PRIVILEGES FOR ROLE hde_owner IN SCHEMA public
       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hde_app;
     ALTER DEFAULT PRIVILEGES FOR ROLE hde_owner IN SCHEMA public
       GRANT USAGE, SELECT ON SEQUENCES TO hde_app;
     ```

3. Note the two connection strings (with `?sslmode=require`):
   - `hde_app` on the **pooled** endpoint (host contains `-pooler`), for the API.
   - `hde_owner` on the **direct** endpoint, for migrations.

### 2. Secrets

```sh
printf '%s' 'postgres://hde_app:...@ep-...-pooler.us-east-2.aws.neon.tech/halo_drivers_ed?sslmode=require' \
  | gcloud secrets create hde-database-url --data-file=- --project vs-halo-drivers-ed-dev
printf '%s' 'postgres://hde_owner:...@ep-....us-east-2.aws.neon.tech/halo_drivers_ed?sslmode=require' \
  | gcloud secrets create hde-migrate-database-url --data-file=- --project vs-halo-drivers-ed-dev
```

### 3. Artifact Registry and Service Accounts

Each workload has its own service account with only the access it needs, never the default compute account. IDs follow `sa-<project abbreviation>-<function>-<env>`, with `hde` for Halo Drivers Ed.

| Service account | Used by | Roles |
| --- | --- | --- |
| `sa-hde-api-dev` | Cloud Run service `hde-api` | `roles/secretmanager.secretAccessor` on secret `hde-database-url` only. Verifying ID and App Check tokens uses public keys, so it needs no Firebase roles. |
| `sa-hde-migrate-dev` | Cloud Run job `hde-migrate` | `roles/secretmanager.secretAccessor` on secret `hde-migrate-database-url` only. |
| `sa-hde-build-dev` | Cloud Build (image builds) | `roles/artifactregistry.writer` on repository `hde`; `roles/logging.logWriter` on the project; `roles/storage.objectViewer` on the `vs-halo-drivers-ed-dev_cloudbuild` bucket (Cloud Build's source uploads). |

```sh
P=vs-halo-drivers-ed-dev

gcloud artifacts repositories create hde --repository-format=docker --location=us-central1 --project $P

for sa in api migrate build; do
  gcloud iam service-accounts create sa-hde-$sa-dev --project $P
done

gcloud secrets add-iam-policy-binding hde-database-url --project $P \
  --member=serviceAccount:sa-hde-api-dev@$P.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor
gcloud secrets add-iam-policy-binding hde-migrate-database-url --project $P \
  --member=serviceAccount:sa-hde-migrate-dev@$P.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor

gcloud artifacts repositories add-iam-policy-binding hde --location=us-central1 --project $P \
  --member=serviceAccount:sa-hde-build-dev@$P.iam.gserviceaccount.com --role=roles/artifactregistry.writer
gcloud projects add-iam-policy-binding $P \
  --member=serviceAccount:sa-hde-build-dev@$P.iam.gserviceaccount.com --role=roles/logging.logWriter

# The source bucket appears with the first `gcloud builds submit`; create it now so the grant can be made first.
gcloud storage buckets create gs://${P}_cloudbuild --location=us-central1 --project $P
gcloud storage buckets add-iam-policy-binding gs://${P}_cloudbuild \
  --member=serviceAccount:sa-hde-build-dev@$P.iam.gserviceaccount.com --role=roles/storage.objectViewer
```

Whoever runs the deploy needs `roles/iam.serviceAccountUser` on these accounts (project owners have it).

The `hde-api` service allows unauthenticated invocations (`--allow-unauthenticated`), because Firebase Hosting's rewrite calls it without IAM credentials. If the organization enforces domain-restricted sharing (`iam.allowedPolicyMemberDomains`), that grant to `allUsers` fails, and the policy needs an exception for this project.

### 4. App Check and reCAPTCHA Enterprise

1. Create a reCAPTCHA Enterprise score key for the hosted domains only, not `localhost`:

   ```sh
   gcloud recaptcha keys create --project vs-halo-drivers-ed-dev --display-name="Halo Drivers Ed web" \
     --web --integration-type=score \
     --domains=vs-halo-drivers-ed-dev.web.app,vs-halo-drivers-ed-dev.firebaseapp.com
   ```

2. Firebase console → App Check → Apps → Halo Drivers Ed → register **reCAPTCHA Enterprise** with that site key.
3. Put the site key in `apps/web/.env.staging` as `VITE_APPCHECK_SITE_KEY` and commit it (it is public). Deploys refuse to run without it.

The API always requires App Check on Cloud Run (`APP_CHECK=required`; it refuses to start otherwise). After the first deploy works, also enforce App Check for **Authentication** in the console (App Check → APIs). This project is not shared with other apps, so enforcing affects only this one.

### 5. Firebase Authentication

Firebase console → Authentication → Sign-in method → enable **Google**. `vs-halo-drivers-ed-dev.web.app` and `.firebaseapp.com` are authorized domains by default.

### 6. Allowlist Yourself

After the first `npm run deploy:api` (whose migrate job creates the tables), add your account with the `hde_app` connection string. A shell variable takes precedence over `apps/api/.env.development`:

```sh
DATABASE_URL='postgres://hde_app:...-pooler.../halo_drivers_ed?sslmode=require' npm run db:allow -- you@example.com
```

## Deploying

Deploy the API first: Hosting's `/api` rewrite needs the `hde-api` service to exist.

- **`npm run deploy:api`** (`scripts/deploy-api.ts`), from a clean working tree:
  1. Cloud Build builds `apps/api/Dockerfile` as `sa-hde-build-dev` and pushes `us-central1-docker.pkg.dev/vs-halo-drivers-ed-dev/hde/api:<commit>`.
  2. Deploys and runs the `hde-migrate` job (`node dist/release.js`): migrations, then the catalog seed. A failure stops the deploy.
  3. Deploys the `hde-api` service with `DATABASE_URL` from Secret Manager, `APP_CHECK=required`, 0 to 2 instances.
- **`npm run deploy:web`**: `hosting.predeploy` runs `scripts/check-firebase-config.ts staging` (refuses a missing site key, an emulator build or a debug token), builds with `--mode staging`, then deploys to https://vs-halo-drivers-ed-dev.web.app.

## Credential Lockdown

Do these before or right after the first deploy:

- **Firebase web API key** (`VITE_FIREBASE_API_KEY`): public by design but unrestricted until restricted. In the console (APIs & Services → Credentials), or:

  ```sh
  gcloud services api-keys list --project vs-halo-drivers-ed-dev
  gcloud services api-keys update <key id> --project vs-halo-drivers-ed-dev \
    --allowed-referrers='https://vs-halo-drivers-ed-dev.web.app/*,https://vs-halo-drivers-ed-dev.firebaseapp.com/*' \
    --api-target=service=identitytoolkit.googleapis.com \
    --api-target=service=securetoken.googleapis.com \
    --api-target=service=firebaseappcheck.googleapis.com
  ```

  This breaks `npm run dev:staging` from `localhost` unless `http://localhost:5173/*` is added as a referrer. Local development against the emulators is not affected.
- **reCAPTCHA key**: hosted domains only (as created above).
- **Service accounts**: only the roles in the table above.
- **Neon**: the API's role cannot change the schema; keep the owner password only in `hde-migrate-database-url`. Rotate a password by adding a new secret version.

## Debug Tokens

To run `npm run dev:staging` locally with App Check:

1. Generate a token, e.g. `node -e "console.log(crypto.randomUUID())"`.
2. Register it in Firebase console → App Check → Apps → Halo Drivers Ed → Manage debug tokens.
3. Put `VITE_APPCHECK_DEBUG_TOKEN=<token>` in a gitignored `apps/web/.env.staging.local`.

A registered debug token passes App Check, so the deploy check refuses any build that has one.
