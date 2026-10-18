import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api';

/**
 * Shows server-side field errors beside their inputs.
 * Returns true when at least one field error was applied.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): boolean {
  if (!(error instanceof ApiError)) return false;
  const entries = Object.entries(error.fields);
  entries.forEach(([field, message]) => setError(field as Path<T>, { type: 'server', message }));
  return entries.length > 0;
}
