import Logger from '../../shared/utils/Logger';

/**
 * Retry `getIdentityToken()` up to `maxAttempts` times with linear back-off.
 * Privy issues the identity token asynchronously after login; it may not be
 * ready on the very first call. Returns null only after all retries fail.
 */
export async function fetchIdentityTokenWithRetry(
  getIdentityToken: () => Promise<string | null>,
  maxAttempts = 6,
  baseDelayMs = 1000,
  logTag = 'PrivyBridge',
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const token = await getIdentityToken();
      if (token) {
        Logger.info(logTag, `[identityToken] obtained on attempt ${attempt}`);
        return token;
      }
      Logger.warn(logTag, `[identityToken] null on attempt ${attempt}/${maxAttempts}`);
    } catch (e) {
      Logger.warn(logTag, `[identityToken] error on attempt ${attempt}/${maxAttempts}`, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    if (attempt < maxAttempts) {
      await new Promise<void>((r) => setTimeout(r, baseDelayMs * attempt));
    }
  }
  Logger.error(logTag, '[identityToken] all retries exhausted — backend will not receive email claims');
  return null;
}
