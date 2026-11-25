import {REASON_MAX_LENGTH} from '@hde/shared';
import {ApiError} from '#src/http/errors.ts';

/** Checks a reason for cancelling, from a request's JSON body, which could hold anything. */
export function parseReason(value: unknown): string {
  const reason = typeof value === 'string' ? value.trim() : '';

  // Postgres text cannot hold a null character.
  if (!reason || reason.length > REASON_MAX_LENGTH || reason.includes('\0')) {
    throw new ApiError(400, 'invalid-request', `Give a reason, up to ${REASON_MAX_LENGTH} characters.`);
  }

  return reason;
}
