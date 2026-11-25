import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, type ApiErrorDetail } from '../../lib/api';

/**
 * Puts a failed submit's error where the user will see it:
 * - VALIDATION_ERROR details → under the matching field (server-side Zod, same messages)
 * - a code listed in `fieldCodes` → under that field (e.g. EMAIL_TAKEN → email)
 * - anything else → form-level message (`errors.root.server`)
 */
export function applyServerError<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  fieldCodes: Partial<Record<string, Path<T>>> = {},
): void {
  if (!(err instanceof ApiError)) {
    setError('root.server', { message: 'Something went wrong. Please try again.' });
    return;
  }

  const field = fieldCodes[err.code];
  if (field) {
    setError(field, { type: err.code, message: err.message }, { shouldFocus: true });
    return;
  }

  if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details) && err.details.length) {
    let mapped = false;
    for (const d of err.details as ApiErrorDetail[]) {
      const name = fields.find((f) => f === d.path);
      if (d.location === 'body' && name) {
        setError(name, { type: 'server', message: d.message });
        mapped = true;
      }
    }
    if (mapped) return;
  }

  // 5xx messages are not meant for users; 4xx ones (bad credentials, rate limit) are.
  const message =
    err.status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message;
  setError('root.server', { type: err.code, message });
}
