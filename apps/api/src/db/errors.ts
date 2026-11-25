/** Postgres's code for a violated exclusion constraint. */
const EXCLUSION_VIOLATION = '23P01';

/** Whether a query failed because its row overlaps another. */
export function isExclusionViolation(error: unknown): boolean {
  const {cause} = error as {cause?: {code?: string}};

  return cause?.code === EXCLUSION_VIOLATION;
}
