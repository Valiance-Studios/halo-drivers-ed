import type {
  ApiErrorBody,
  ApiErrorCode,
  Booking,
  BookingRequest,
  Instructor,
  LessonSlot,
  Me,
  Vehicle,
} from '@hde/shared';

import {APP_CHECK_HEADER} from '@hde/shared';

/** Supplies the tokens each request carries. Null means there is none to send. */
export interface TokenSource {
  idToken(): Promise<string | null>;
  appCheckToken(): Promise<string | null>;
}

/** A failed API request, with the API's error code when it sent one. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | null;

  constructor(status: number, code: ApiErrorCode | null, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof (value as ApiErrorBody | null)?.error?.code === 'string';
}

/** The app's only way to reach the API (served under /api on the same origin). */
export class ApiClient {
  private readonly tokens: TokenSource;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(tokens: TokenSource, baseUrl = '/api', fetchImpl: typeof fetch = (...args) => fetch(...args)) {
    this.tokens = tokens;
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
  }

  getMe(): Promise<Me> {
    return this.get('/me');
  }

  listVehicles(): Promise<Vehicle[]> {
    return this.get('/vehicles');
  }

  listInstructors(): Promise<Instructor[]> {
    return this.get('/instructors');
  }

  listSlots(vehicleSlug: string, instructorSlug: string): Promise<LessonSlot[]> {
    const query = new URLSearchParams({vehicle: vehicleSlug, instructor: instructorSlug});

    return this.get(`/slots?${query}`);
  }

  listBookings(): Promise<Booking[]> {
    return this.get('/bookings');
  }

  createBooking(request: BookingRequest): Promise<Booking> {
    return this.post('/bookings', request);
  }

  cancelBooking(id: string): Promise<Booking> {
    return this.post(`/bookings/${encodeURIComponent(id)}/cancel`);
  }

  private get<T>(path: string): Promise<T> {
    return this.send(path);
  }

  private post<T>(path: string, body: unknown = {}): Promise<T> {
    return this.send(path, {method: 'POST', body: JSON.stringify(body)});
  }

  private async send<T>(path: string, init: {method?: string; body?: string} = {}): Promise<T> {
    const [idToken, appCheckToken] = await Promise.all([this.tokens.idToken(), this.tokens.appCheckToken()]);
    const headers: Record<string, string> = {Accept: 'application/json'};

    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    if (appCheckToken) {
      headers[APP_CHECK_HEADER] = appCheckToken;
    }

    if (init.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {...init, headers});
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw isApiErrorBody(body)
        ? new ApiRequestError(response.status, body.error.code, body.error.message)
        : new ApiRequestError(response.status, null, `The server responded with ${response.status}.`);
    }

    return body as T;
  }
}
