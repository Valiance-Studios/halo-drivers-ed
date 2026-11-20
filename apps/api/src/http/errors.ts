import type {ContentfulStatusCode} from 'hono/utils/http-status';
import type {ApiErrorBody, ApiErrorCode} from '@hde/shared';

/** An expected failure, returned to the client as an {@link ApiErrorBody} with its status. */
export class ApiError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: ApiErrorCode;

  constructor(status: ContentfulStatusCode, code: ApiErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }

  toBody(): ApiErrorBody {
    return {error: {code: this.code, message: this.message}};
  }
}
