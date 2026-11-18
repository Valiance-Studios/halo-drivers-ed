/**
 * Deploys the API: builds its image with Cloud Build, migrates and seeds Neon with the hde-migrate Cloud
 * Run job, then deploys the hde-api Cloud Run service. Stops at the first failing step, so the service never runs
 * against a database its migrations did not reach.
 *
 * Usage: npm run deploy:api
 *
 * Needs the one-time setup in docs/DEPLOYMENT.md (Artifact Registry, service accounts, secrets).
 */
import {spawnSync} from 'node:child_process';

const PROJECT = 'vs-halo-drivers-ed-dev';
const REGION = 'us-central1';
const SERVICE = 'hde-api';
const MIGRATE_JOB = 'hde-migrate';
const BUILD_SERVICE_ACCOUNT = `sa-hde-build-dev@${PROJECT}.iam.gserviceaccount.com`;
const API_SERVICE_ACCOUNT = `sa-hde-api-dev@${PROJECT}.iam.gserviceaccount.com`;
const MIGRATE_SERVICE_ACCOUNT = `sa-hde-migrate-dev@${PROJECT}.iam.gserviceaccount.com`;

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, {stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8'});

  if (result.status !== 0) {
    throw new Error(`${command} ${args[0]} failed (exit code ${result.status}).`);
  }

  return result.stdout.trim();
}

function gcloud(...args: string[]): void {
  console.log(`\n> gcloud ${args.join(' ')}`);
  const result = spawnSync('gcloud', [...args, '--project', PROJECT, '--quiet'], {stdio: 'inherit'});

  if (result.status !== 0) {
    throw new Error(`gcloud ${args.slice(0, 3).join(' ')} failed (exit code ${result.status}).`);
  }
}

// The image is tagged with the commit, so only committed code is deployed.
if (run('git', ['status', '--porcelain'])) {
  console.error('Commit or stash your changes first: the image is tagged with the current commit.');
  process.exit(1);
}

const image = `${REGION}-docker.pkg.dev/${PROJECT}/hde/api:${run('git', ['rev-parse', '--short', 'HEAD'])}`;

gcloud('builds', 'submit',
  '--config', 'apps/api/cloudbuild.yaml',
  '--substitutions', `_IMAGE=${image}`,
  '--service-account', `projects/${PROJECT}/serviceAccounts/${BUILD_SERVICE_ACCOUNT}`,
  '.');

gcloud('run', 'jobs', 'deploy', MIGRATE_JOB,
  '--image', image,
  '--region', REGION,
  '--service-account', MIGRATE_SERVICE_ACCOUNT,
  '--set-secrets', 'DATABASE_URL=hde-migrate-database-url:latest',
  '--command', 'node',
  '--args', 'dist/release.js',
  '--tasks', '1',
  '--max-retries', '0');
gcloud('run', 'jobs', 'execute', MIGRATE_JOB, '--region', REGION, '--wait');

gcloud('run', 'deploy', SERVICE,
  '--image', image,
  '--region', REGION,
  '--service-account', API_SERVICE_ACCOUNT,
  '--set-secrets', 'DATABASE_URL=hde-database-url:latest',
  '--set-env-vars', `FIREBASE_PROJECT_ID=${PROJECT},APP_CHECK=required`,
  // Firebase Hosting's /api rewrite calls the service without IAM credentials; the API checks App Check
  // and Firebase ID tokens itself.
  '--allow-unauthenticated',
  '--min-instances', '0',
  '--max-instances', '2',
  '--memory', '512Mi');

console.log(`\nDeployed ${image}.`);
