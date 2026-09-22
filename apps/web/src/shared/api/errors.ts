/**
 * The four ways a request can fail, each with the exact detail line the error panel shows
 * (spec 001 FR4; tech doc §2.4). `detail` is the user-facing string, `kind` is for code.
 */
export type ApiErrorKind = 'network' | 'http' | 'timeout' | 'shape';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly detail: string;

  constructor(kind: ApiErrorKind, detail: string, options?: ErrorOptions) {
    super(detail, options);
    this.name = 'ApiError';
    this.kind = kind;
    this.detail = detail;
  }
}

/** The service is unreachable — `fetch` itself rejected (connection refused, DNS, CORS). */
export class NetworkError extends ApiError {
  constructor(options?: ErrorOptions) {
    super('network', 'Network error', options);
    this.name = 'NetworkError';
  }
}

/** The service answered, but not with 2xx. */
export class HttpError extends ApiError {
  readonly status: number;

  constructor(status: number, options?: ErrorOptions) {
    super('http', `Request failed with status ${status}`, options);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** No answer within `REQUEST_TIMEOUT_MS`. */
export class TimeoutError extends ApiError {
  constructor(options?: ErrorOptions) {
    super('timeout', 'Request timed out', options);
    this.name = 'TimeoutError';
  }
}

/** The body was not JSON, or JSON that is not the contract's shape. */
export class UnexpectedShapeError extends ApiError {
  constructor(options?: ErrorOptions) {
    super('shape', 'Unexpected data shape', options);
    this.name = 'UnexpectedShapeError';
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

/** The one detail line for the panel: the taxonomy's string, or a generic one for anything else. */
export const describeError = (error: unknown): string =>
  isApiError(error) ? error.detail : 'Unexpected error';
