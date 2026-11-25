import {ApiError} from '#src/http/errors.ts';

const UUID = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** A lesson id from a URL. Postgres would reject one that is not a UUID. */
export function lessonId(value: string): string {
  if (!isUuid(value)) {
    throw lessonNotFound();
  }

  return value;
}

export function lessonNotFound(): ApiError {
  return new ApiError(404, 'not-found', 'No such lesson.');
}
