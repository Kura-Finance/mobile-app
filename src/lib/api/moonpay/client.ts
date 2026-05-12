/**
 * MoonPay API — /api/moonpay domain
 *
 * MoonPay's hosted widget must be signed in LIVE mode. Signing requires the
 * MoonPay SECRET key, which must stay on the backend, so the app asks the
 * backend to sign the widget URL it just built.
 *
 * Expected backend contract (implement server-side):
 *   POST /api/moonpay/sign
 *     body: { url: string }            // the full unsigned widget URL
 *     data: { url: string }            // fully signed URL, ready to load
 *          | { signature: string }     // base64 HMAC-SHA256 of the query string
 *
 * In sandbox mode the unsigned URL works, so callers should treat a missing /
 * failing endpoint as non-fatal and fall back to the unsigned URL.
 */

import { requestJson } from '../client';

const apiName = 'MoonPayApi';

interface SignResponse {
  url?: string;
  signature?: string;
}

/**
 * Return a signed widget URL. Throws if the backend signing endpoint is
 * unavailable so the caller can decide whether to fall back (sandbox only).
 */
export async function signMoonPayUrl(unsignedUrl: string): Promise<string> {
  const res = await requestJson<SignResponse>('/api/moonpay/sign', {
    method: 'POST',
    body: JSON.stringify({ url: unsignedUrl }),
    apiName,
  });

  if (res.url) return res.url;
  if (res.signature) {
    const sep = unsignedUrl.includes('?') ? '&' : '?';
    return `${unsignedUrl}${sep}signature=${encodeURIComponent(res.signature)}`;
  }
  return unsignedUrl;
}
