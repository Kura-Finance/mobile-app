import { KuraApiError } from '../errors';

/** Dinari endpoints return 403 when the user is not on the product whitelist. */
export function isDinariWhitelistError(error: unknown): boolean {
  if (!(error instanceof KuraApiError) || error.status !== 403) return false;
  const haystack = `${error.code} ${error.message}`.toLowerCase();
  return haystack.includes('whitelist') || haystack.includes('not_on_whitelist');
}
