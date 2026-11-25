/** The body of every error response from the API. */
export interface ApiErrorBody {
  error: {
    /** Stable, machine-readable reason, e.g. `not-allowed`. */
    code: ApiErrorCode;
    message: string;
  };
}

export const API_ERROR_CODES = [
  'unauthenticated',
  'app-check-failed',
  'not-allowed',
  'not-admin',
  'not-found',
  'invalid-request',
  'request-too-large',
  'rate-limited',
  'course-locked',
  'no-lessons-left',
  'slot-unavailable',
  'too-late-to-cancel',
  'too-early',
  'sign-off-conflict',
  'internal',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** The header that carries the App Check token, as Firebase's own services expect it. */
export const APP_CHECK_HEADER = 'X-Firebase-AppCheck';
