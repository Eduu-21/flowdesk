export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = 'ERROR',
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new HttpError(400, message, 'BAD_REQUEST', fields);
export const unauthorized = (message = 'Please sign in to continue.', code = 'UNAUTHENTICATED') =>
  new HttpError(401, message, code);
export const forbidden = (message = 'You do not have permission to do that.') =>
  new HttpError(403, message, 'FORBIDDEN');
export const notFound = (what = 'That item') =>
  new HttpError(404, `${what} could not be found.`, 'NOT_FOUND');
export const conflict = (message: string, fields?: Record<string, string>) =>
  new HttpError(409, message, 'CONFLICT', fields);
