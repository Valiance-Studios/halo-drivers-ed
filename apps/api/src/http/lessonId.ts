import {ApiError} from '#src/http/errors.ts';

const UUID = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;

/** A lesson id from a URL. Postgres would reject one that is not a UUID. */
export function lessonId(value: string): string {
  if (!UUID.test(value)) {
    throw lessonNotFound();
  }

  return value;
}

export function lessonNotFound(): ApiError {
  return new ApiError(404, 'not-found', 'No such lesson.');
}
