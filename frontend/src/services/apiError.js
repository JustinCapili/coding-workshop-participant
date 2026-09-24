/**
 * Error shape matching the backend `ErrorResponse` record (`status`, `error`, `message`), so
 * callers can treat mock and real failures identically.
 */
const STATUS_TEXT = {
  0: 'Network Error',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.error = STATUS_TEXT[status] ?? 'Error'
  }
}

/** Best-effort user-facing message for any thrown value. */
export function errorMessage(err, fallback = 'Something went wrong') {
  if (!err) return fallback
  if (typeof err === 'string') return err
  return err.message || fallback
}
