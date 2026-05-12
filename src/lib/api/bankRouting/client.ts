/**
 * US ABA routing number lookup — https://bankrouting.io
 * Free, no auth; 100 req/hour per IP.
 */

const BASE_URL = 'https://bankrouting.io';

export interface AbaBankInfo {
  aba_number: string;
  bank_name: string;
  city: string;
  state: string;
}

interface AbaLookupResponse {
  status: 'success' | 'error';
  data?: AbaBankInfo;
  error?: { code?: string; message?: string };
}

/** Title-case an ALL CAPS bank name for display. */
export function formatAbaBankName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((word) =>
      word.length <= 3 && /^[A-Z&]+$/.test(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(' ');
}

/**
 * Look up bank name (and location) for a 9-digit ABA routing number.
 * Returns null when the number is invalid or not found.
 */
export async function lookupAbaBank(routingNumber: string): Promise<AbaBankInfo | null> {
  const digits = routingNumber.replace(/\D/g, '');
  if (digits.length !== 9) return null;

  const res = await fetch(`${BASE_URL}/api/v1/aba/${digits}`);
  if (!res.ok) return null;

  const json = (await res.json()) as AbaLookupResponse;
  if (json.status !== 'success' || !json.data?.bank_name) return null;
  return json.data;
}
