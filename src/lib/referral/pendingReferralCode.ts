import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import Logger from '../../shared/utils/Logger';

const STORAGE_KEY = '@kura/pendingReferralCode';
const TAG = 'ReferralDeepLink';

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : null;
}

/** Extract `ref` from universal links, web signup URLs, or custom scheme links. */
export function parseReferralCodeFromUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const refParam = parsed.queryParams?.ref;
    const ref = Array.isArray(refParam) ? refParam[0] : refParam;
    if (typeof ref === 'string') {
      return normalizeReferralCode(ref);
    }
  } catch {
    // fall through to regex fallback
  }

  const match = url.match(/[?&]ref=([A-Za-z0-9]+)/i);
  return match ? normalizeReferralCode(match[1]) : null;
}

export async function getPendingReferralCode(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return normalizeReferralCode(stored);
  } catch {
    return null;
  }
}

export async function setPendingReferralCode(code: string): Promise<void> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return;
  await AsyncStorage.setItem(STORAGE_KEY, normalized);
}

export async function clearPendingReferralCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
}

/** Read stored code and remove it (call after login exchange). */
export async function consumePendingReferralCode(): Promise<string | null> {
  const code = await getPendingReferralCode();
  if (code) await clearPendingReferralCode();
  return code;
}

function handleReferralUrl(url: string): void {
  const code = parseReferralCodeFromUrl(url);
  if (!code) return;
  Logger.info(TAG, 'Referral code captured from deep link', { code });
  void setPendingReferralCode(code);
}

let listenerInstalled = false;

/** Capture `?ref=` from cold/warm starts (signup universal links). */
export function installReferralDeepLinkListener(): void {
  if (listenerInstalled) return;
  listenerInstalled = true;

  void Linking.getInitialURL()
    .then((url) => {
      if (url) handleReferralUrl(url);
    })
    .catch(() => {});

  Linking.addEventListener('url', ({ url }) => {
    handleReferralUrl(url);
  });
}
