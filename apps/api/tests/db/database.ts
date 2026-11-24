/** The database the database tests use, separate from development data. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://hde:hde@localhost:5433/halo_drivers_ed_test';
