/**
 * Error thrown by services/routes and rendered by middleware/errors.ts as
 * `{ error: { code, message } }` with the given HTTP status, per the contract.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFound(message = 'Not found'): ApiError {
  return new ApiError(404, 'NOT_FOUND', message);
}
