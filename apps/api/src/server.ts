import {serve} from '@hono/node-server';
import {createApp} from '#src/app.ts';
import {loadConfig} from '#src/config.ts';
import {createFirebaseTokenVerifier} from '#src/auth/tokenVerifier.ts';
import {BookingService} from '#src/bookings/bookingService.ts';
import {connect} from '#src/db/client.ts';
import {LessonService} from '#src/lessons/lessonService.ts';
import {PostgresAllowlistRepository} from '#src/repositories/allowlistRepository.ts';
import {PostgresBookingRepository} from '#src/repositories/bookingRepository.ts';
import {PostgresCatalogRepository} from '#src/repositories/catalogRepository.ts';
import {PostgresLessonRepository} from '#src/repositories/lessonRepository.ts';

const config = loadConfig();
const {db, close} = connect(config.databaseUrl);

const catalog = new PostgresCatalogRepository(db);

const app = createApp({
  appCheck: config.appCheck,
  verifier: createFirebaseTokenVerifier(config.firebaseProjectId),
  allowlist: new PostgresAllowlistRepository(db),
  catalog,
  bookings: new BookingService(new PostgresBookingRepository(db), catalog),
  lessons: new LessonService(new PostgresLessonRepository(db), catalog),
});

const server = serve({fetch: app.fetch, port: config.port}, ({port}) => {
  console.log(`API listening on http://localhost:${port} (App Check ${config.appCheck}).`);
});

// Cloud Run sends SIGTERM before stopping an instance; finish in-flight requests, then release connections.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => {
      void close().finally(() => process.exit(0));
    });
  });
}
