/**
 * Top-level app store.
 *
 * Auth is delegated entirely to Privy (@privy-io/expo).
 *   - `setPrivySession` is called by PrivyBridgeProvider in App.tsx whenever
 *     Privy reports an authenticated user. It stores the Kura JWT (exchanged
 *     from the Privy token) and the derived user profile.
 *   - `clearAuthSession` is called on logout (also from PrivyBridgeProvider).
 *
 * The Kura JWT is kept in-memory during an active unlock window and mirrored to
 * SecureStore (token only) so it can be restored after biometric verification.
 * User profile is re-fetched from the API on unlock. Privy handles its own
 * persistence and issues fresh tokens on resume.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchCurrentUserProfile,
  updateDisplayName as updateDisplayNameApi,
  updateAvatar as updateAvatarApi,
  setReferralCode as setReferralCodeApi,
  requestEmailChange as requestEmailChangeApi,
  confirmEmailChange as confirmEmailChangeApi,
  logoutCurrentSession,
  deleteCurrentAccount,
  type UserProfileV1,
} from '../../lib/api/auth';
import { setAuthTokenProvider } from '../../lib/api/client';
import { clearAllCache } from '../../lib/cache/dataCache';
import { clearLocalWalletCache } from '../../features/card/config/cardWalletConfig';
import { resetKuraCardWalletSession } from '../../features/card/kuraCardWalletSession';
import { clearWalletConnectUserData } from '../../lib/walletconnect/clearWalletConnectUserData';
import {
  createPlaidLinkToken,
  disconnectPlaidItem,
  exchangePlaidPublicToken,
} from '../../lib/api/plaid';
import { waitForPlaidAccountsSynced, waitForWebhookCompletion } from '../utils/webhookWait';
import { disconnectExchange as disconnectExchangeAccountApi } from '../../lib/api/exchange';
import { fetchExchangeRates, isCacheValid, type ExchangeRates } from '../../lib/api/exchangeRate';
import { resetTrackFiSyncPolicy } from '../../features/trackfi/utils/trackFiSyncPolicy';
import { resetDefiPortfolioSession } from '../../features/trackfi/hooks/useDefiPortfolio';
import { resetWalletHistorySession } from '../../features/card/hooks/walletHistoryStore';
import { resetStocksStore } from '../../features/stocks/store/useStocksStore';
import { resetDinariGateStore } from '../../features/stocks/store/useDinariGateStore';
import { useFinanceStore } from './finance';
import { bindMembershipLabelReader } from './membershipLabelAccess';
import { type Currency, SUPPORTED_CURRENCIES } from '../utils/currencyFormatter';
import { type ThemeMode } from '../theme/theme';
import Logger from '../utils/Logger';
import { clearDataKey } from '../../lib/crypto/dataKeySession';
import { clearCryptoSession } from '../../lib/crypto/session';
import { applyScreenshotPolicy } from '../../lib/security/screenshotGuard';
import {
  clearSecureSession,
  hasSecureSession,
  loadSecureSession,
  saveSecureSession,
} from '../../lib/security/secureSessionStore';
import {
  authenticateWithBiometrics,
  setBiometricPreferenceProvider,
} from '../../lib/security/biometricAuth';
import type { BiometricAuthFailureReason } from '../../lib/security/biometricAuthCore';
import {
  changeAppPin as changeStoredAppPin,
  clearAppPin,
  hasAppPin,
  setAppPin,
  verifyAppPin,
  type AppPinFailureReason,
} from '../../lib/security/appPin';
import { cancelLocalAuthForSessionLock } from '../../lib/security/localAuthGate';
import { resolveUsableAuthToken } from '../../lib/security/sessionAccessCore';

export type BaseCurrency = Currency;
export type Language = 'en' | 'zh-TW';

export type SessionLockStatus = 'checking' | 'locked' | 'unlocked';

export type UnlockFailureReason = BiometricAuthFailureReason | AppPinFailureReason | 'failed';

interface UnlockResult {
  ok: boolean;
  reason?: UnlockFailureReason;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  emailIsPlaceholder: boolean;
  hasName: boolean;
  walletAddress?: string | null;
  avatarUrl: string;
  membershipLabel: string;
  referCode?: string;
  referredByCode?: string | null;
  referralCount?: number;
  cashbackBalance?: number;
}

export interface UserPreferences {
  baseCurrency: BaseCurrency;
  language: Language;
  themeMode: ThemeMode;
  /** Block screenshots / screen recording (FLAG_SECURE on Android). */
  disableScreenshot: boolean;
  /** Mask monetary amounts across the app. */
  hideBalance: boolean;
  /** Use on-device biometrics for unlock and sensitive actions when available. */
  biometricUnlockEnabled: boolean;
}

/** AsyncStorage key for the persisted theme mode. */
const THEME_MODE_STORAGE_KEY = '@kura/themeMode';
const LANGUAGE_STORAGE_KEY = '@kura/language';
const BASE_CURRENCY_STORAGE_KEY = '@kura/baseCurrency';
const SECURITY_PREFS_STORAGE_KEY = '@kura/securityPrefs';

interface PersistedSecurityPrefs {
  disableScreenshot?: boolean;
  hideBalance?: boolean;
  biometricUnlockEnabled?: boolean;
}

function readSecurityPrefs(raw: string | null): Partial<PersistedSecurityPrefs> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as PersistedSecurityPrefs;
    return {
      disableScreenshot: parsed.disableScreenshot === true,
      hideBalance: parsed.hideBalance === true,
      biometricUnlockEnabled:
        parsed.biometricUnlockEnabled === undefined
          ? undefined
          : parsed.biometricUnlockEnabled !== false,
    };
  } catch {
    return {};
  }
}

async function persistSecurityPrefs(
  prefs: Pick<UserPreferences, 'disableScreenshot' | 'hideBalance' | 'biometricUnlockEnabled'>,
) {
  await AsyncStorage.setItem(
    SECURITY_PREFS_STORAGE_KEY,
    JSON.stringify({
      disableScreenshot: prefs.disableScreenshot,
      hideBalance: prefs.hideBalance,
      biometricUnlockEnabled: prefs.biometricUnlockEnabled,
    }),
  );
}

function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'zh-TW';
}

function isBaseCurrency(value: string | null): value is BaseCurrency {
  return SUPPORTED_CURRENCIES.includes(value as BaseCurrency);
}

interface AppState {
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
  userProfile: UserProfile;
  preferences: UserPreferences;
  plaidLinkToken: string | null;
  plaidLinkTokenTimestamp: number | null;
  authToken: string | null;
  authError: string | null;
  /** Whether the persisted session requires biometric unlock before use. */
  sessionLockStatus: SessionLockStatus;
  /** Whether an App PIN hash is stored on this device. */
  appPinEnabled: boolean;
  exchangeRates: ExchangeRates | null;
  isLoadingExchangeRates: boolean;

  // ── Privy bridge ────────────────────────────────────────────────────────
  /** Called by PrivyBridgeProvider when Privy becomes authenticated. */
  setPrivySession: (token: string, profile: UserProfileV1) => void;
  /** Wipe auth state (called on Privy logout or bridge disconnect). */
  clearAuthSession: () => void;
  /** Resolve whether a returning Privy session should start locked. */
  initializeSessionLock: (hasPrivyUser: boolean) => Promise<void>;
  /** Drop in-memory session; keep SecureStore copy for biometric restore. */
  lockSession: () => Promise<void>;
  /** Block app access until biometrics pass; clears in-memory JWT after persisting to SecureStore. */
  requireBiometricUnlock: () => void;
  /** Restore session from SecureStore after biometric verification succeeds. */
  unlockSession: (prompt: string) => Promise<UnlockResult>;
  /** Restore session after App PIN verification succeeds. */
  unlockSessionWithAppPin: (pin: string) => Promise<UnlockResult>;
  /** Refresh whether an App PIN is configured on this device. */
  refreshAppPinStatus: () => Promise<void>;
  /** Create or replace the App PIN. */
  saveAppPin: (pin: string) => Promise<UnlockResult>;
  /** Change the App PIN after verifying the current one. */
  changeAppPin: (currentPin: string, newPin: string) => Promise<UnlockResult>;
  /** Logout: calls Privy logout externally; this cleans up local state. */
  logout: () => Promise<void>;
  /** Hard delete account via backend. */
  deleteAccount: () => Promise<void>;

  // ── Bootstrap / profile ─────────────────────────────────────────────────
  hydrateUserProfile: () => Promise<void>;
  /** Replace local profile from an already-fetched `/api/auth/me` payload. */
  refreshUserProfile: (profile: UserProfileV1) => void;

  // ── Profile mutations ───────────────────────────────────────────────────
  setDisplayName: (displayName: string) => Promise<void>;
  setReferralCode: (referralCode: string) => Promise<void>;
  requestEmailChange: (newEmail: string) => Promise<{ message: string; expiresIn?: number }>;
  confirmEmailChange: (newEmail: string, verificationCode: string) => Promise<void>;
  /** Local-only email update — call after Privy confirms the change. */
  setLocalEmail: (email: string) => void;
  updateAvatar: (avatarUrl: string) => Promise<void>;

  // ── Preferences ─────────────────────────────────────────────────────────
  setBaseCurrency: (currency: BaseCurrency) => void;
  setLanguage: (language: Language) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setDisableScreenshot: (enabled: boolean) => void;
  setHideBalance: (enabled: boolean) => void;
  setBiometricUnlockEnabled: (enabled: boolean) => void;

  // ── Plaid ───────────────────────────────────────────────────────────────
  setPlaidLinkToken: (token: string | null) => void;
  requestPlaidLinkToken: () => Promise<string | null>;
  confirmPlaidExchange: (publicToken: string, institutionName?: string) => Promise<void>;
  disconnectPlaidAccount: (accountId: string) => Promise<void>;

  // ── Exchange ────────────────────────────────────────────────────────────
  disconnectExchangeAccount: (exchangeAccountId: string) => Promise<void>;

  // ── Misc ────────────────────────────────────────────────────────────────
  loadExchangeRates: () => Promise<void>;
  setAuthToken: (token: string | null) => void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  baseCurrency: 'USD',
  language: 'en',
  themeMode: 'light',
  disableScreenshot: false,
  hideBalance: false,
  biometricUnlockEnabled: true,
};

const EMPTY_USER_PROFILE: UserProfile = {
  id: '',
  displayName: '',
  email: '',
  emailIsPlaceholder: true,
  hasName: false,
  walletAddress: null,
  avatarUrl: '',
  membershipLabel: '',
};

function warnPreferencePersist(scope: string, err: unknown): void {
  Logger.warn('AppStore', scope, {
    error: err instanceof Error ? err.message : String(err),
  });
}

let unlockSessionInFlight: Promise<UnlockResult> | null = null;

function toLocalProfile(remote: UserProfileV1): UserProfile {
  return {
    id: remote.id,
    displayName: remote.displayName,
    email: remote.email,
    emailIsPlaceholder: remote.emailIsPlaceholder,
    hasName: remote.hasName,
    walletAddress: remote.walletAddress ?? null,
    avatarUrl: remote.avatarUrl,
    membershipLabel: remote.membershipLabel,
    referCode: remote.referCode,
    referredByCode: remote.referredByCode ?? null,
    referralCount: remote.referralCount,
    cashbackBalance: remote.cashbackBalance,
  };
}

async function finalizeSessionUnlock(
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
): Promise<UnlockResult> {
  const existingToken = get().authToken;
  if (existingToken) {
    const needsHydration = !get().userProfile.id;
    Logger.info('AppStore', 'Session resumed after unlock', { needsHydration });
    set({
      sessionLockStatus: 'unlocked',
      authStatus: needsHydration ? 'loading' : 'authenticated',
      authError: null,
    });

    if (needsHydration) {
      try {
        await get().hydrateUserProfile();
        if (!get().authToken || get().authStatus !== 'authenticated') {
          return { ok: false, reason: 'failed' };
        }
      } catch (err) {
        Logger.warn('AppStore', 'Profile hydration failed after unlock', {
          error: err instanceof Error ? err.message : String(err),
        });
        return { ok: false, reason: 'failed' };
      }
    }

    void get().loadExchangeRates();
    return { ok: true };
  }

  const token = await loadSecureSession({ afterLocalAuth: true });
  if (!token) {
    Logger.warn('AppStore', 'Unlock passed but no stored session found');
    return { ok: false, reason: 'failed' };
  }

  Logger.info('AppStore', 'Session unlocked from SecureStore');
  set({
    authToken: token,
    authStatus: 'loading',
    sessionLockStatus: 'unlocked',
    authError: null,
  });

  try {
    await get().hydrateUserProfile();
    if (!get().authToken || get().authStatus !== 'authenticated') {
      return { ok: false, reason: 'failed' };
    }
    void get().loadExchangeRates();
    return { ok: true };
  } catch (err) {
    Logger.warn('AppStore', 'Profile hydration failed after unlock', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: 'failed' };
  }
}

export const useAppStore = create<AppState>((set, get) => {
  setBiometricPreferenceProvider(() => get().preferences.biometricUnlockEnabled);

  setAuthTokenProvider(() => {
    const { authToken, sessionLockStatus } = get();
    if (sessionLockStatus !== 'unlocked') return null;
    return authToken;
  });

  // Hydrate persisted preferences (fire-and-forget).
  void AsyncStorage.getItem(THEME_MODE_STORAGE_KEY)
    .then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set((state) => ({ preferences: { ...state.preferences, themeMode: stored } }));
      }
    })
    .catch((err) => warnPreferencePersist('Theme preference hydration failed', err));

  void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
    .then((stored) => {
      if (isLanguage(stored)) {
        set((state) => ({ preferences: { ...state.preferences, language: stored } }));
      }
    })
    .catch((err) => warnPreferencePersist('Language preference hydration failed', err));

  void AsyncStorage.getItem(BASE_CURRENCY_STORAGE_KEY)
    .then((stored) => {
      if (isBaseCurrency(stored)) {
        set((state) => ({ preferences: { ...state.preferences, baseCurrency: stored } }));
      }
    })
    .catch((err) => warnPreferencePersist('Base currency hydration failed', err));

  void AsyncStorage.getItem(SECURITY_PREFS_STORAGE_KEY)
    .then((stored) => {
      const security = readSecurityPrefs(stored);
      if (
        security.disableScreenshot !== undefined ||
        security.hideBalance !== undefined ||
        security.biometricUnlockEnabled !== undefined
      ) {
        set((state) => ({
          preferences: {
            ...state.preferences,
            disableScreenshot: security.disableScreenshot ?? state.preferences.disableScreenshot,
            hideBalance: security.hideBalance ?? state.preferences.hideBalance,
            biometricUnlockEnabled:
              security.biometricUnlockEnabled ?? state.preferences.biometricUnlockEnabled,
          },
        }));
      }
      if (security.disableScreenshot) {
        void applyScreenshotPolicy(true);
      }
    })
    .catch((err) => warnPreferencePersist('Security preference hydration failed', err));

  return {
    authStatus: 'loading',
    userProfile: EMPTY_USER_PROFILE,
    preferences: DEFAULT_PREFERENCES,
    plaidLinkToken: null,
    plaidLinkTokenTimestamp: null,
    authToken: null,
    authError: null,
    sessionLockStatus: 'checking',
    appPinEnabled: false,
    exchangeRates: null,
    isLoadingExchangeRates: false,

    // ── Privy bridge ──────────────────────────────────────────────────────

    setPrivySession: (token, profile) => {
      Logger.info('AppStore', 'Privy session established', {
        userId: profile.id,
        emailIsPlaceholder: profile.emailIsPlaceholder,
      });
      const localProfile = toLocalProfile(profile);
      set({
        authToken: token,
        authStatus: 'authenticated',
        userProfile: localProfile,
        authError: null,
        sessionLockStatus: 'unlocked',
        // Preserve the user's theme choice across login (it isn't account-scoped).
        preferences: {
          ...DEFAULT_PREFERENCES,
          themeMode: get().preferences.themeMode,
          language: get().preferences.language,
          baseCurrency: get().preferences.baseCurrency,
          disableScreenshot: get().preferences.disableScreenshot,
          hideBalance: get().preferences.hideBalance,
          biometricUnlockEnabled: get().preferences.biometricUnlockEnabled,
        },
      });
      void saveSecureSession(token);
      void get().refreshAppPinStatus();
      void get().loadExchangeRates();
    },

    clearAuthSession: () => {
      Logger.info('AppStore', 'Clearing auth session');
      const userId = get().userProfile.id;
      void clearWalletConnectUserData(userId || undefined);
      void clearAllCache();
      void clearLocalWalletCache().catch((err) =>
        Logger.warn('AppStore', 'Failed to clear local wallet cache', { err }),
      );
      resetKuraCardWalletSession();
      useFinanceStore.getState().clearPlaidFinanceData();
      useFinanceStore.getState().clearAssetHistory();
      resetTrackFiSyncPolicy();
      resetDefiPortfolioSession();
      resetWalletHistorySession();
      resetStocksStore();
      resetDinariGateStore();
      void import('./useExchangeStore')
        .then(({ useExchangeStore }) => useExchangeStore.getState().clearAll())
        .catch((err) =>
          Logger.warn('AppStore', 'Failed to clear exchange store', { err: String(err) }),
        );
      void clearSecureSession();
      void clearAppPin();
      clearDataKey();
      clearCryptoSession();
      set({
        authToken: null,
        authStatus: 'unauthenticated',
        userProfile: EMPTY_USER_PROFILE,
        plaidLinkToken: null,
        plaidLinkTokenTimestamp: null,
        authError: null,
        sessionLockStatus: 'unlocked',
        appPinEnabled: false,
      });
    },

    initializeSessionLock: async (hasPrivyUser) => {
      await get().refreshAppPinStatus();
      if (!hasPrivyUser) {
        set({ sessionLockStatus: 'unlocked' });
        return;
      }
      const hasStored = await hasSecureSession();
      if (hasStored) {
        Logger.info('AppStore', 'Stored session found — requiring biometric unlock');
        set({
          sessionLockStatus: 'locked',
          authStatus: 'loading',
        });
        return;
      }
      set({ sessionLockStatus: 'unlocked' });
    },

    lockSession: async () => {
      const { authToken, sessionLockStatus } = get();
      if (sessionLockStatus === 'locked') return;

      if (authToken) {
        await saveSecureSession(authToken);
      }

      Logger.info('AppStore', 'Session locked — in-memory auth cleared');
      clearDataKey();
      clearCryptoSession();
      set({
        authToken: null,
        authStatus: 'loading',
        sessionLockStatus: 'locked',
      });
    },

    requireBiometricUnlock: () => {
      const { authToken, sessionLockStatus } = get();
      if (sessionLockStatus === 'locked') return;

      const lockInMemorySession = () => {
        Logger.info('AppStore', 'Biometric unlock required — in-memory auth cleared');
        cancelLocalAuthForSessionLock();
        clearDataKey();
        clearCryptoSession();
        set({
          authToken: null,
          authStatus: 'loading',
          sessionLockStatus: 'locked',
        });
      };

      if (authToken) {
        void saveSecureSession(authToken).finally(lockInMemorySession);
        return;
      }

      void hasSecureSession().then((hasStored) => {
        if (hasStored) lockInMemorySession();
      });
    },

    unlockSession: async (prompt) => {
      if (unlockSessionInFlight) {
        return unlockSessionInFlight;
      }

      unlockSessionInFlight = (async () => {
        const auth = await authenticateWithBiometrics(prompt);
        if (!auth.ok) {
          Logger.debug('AppStore', 'Biometric unlock rejected', { reason: auth.reason });
          return { ok: false, reason: auth.reason };
        }
        return finalizeSessionUnlock(set, get);
      })();

      try {
        return await unlockSessionInFlight;
      } finally {
        unlockSessionInFlight = null;
      }
    },

    unlockSessionWithAppPin: async (pin) => {
      const verified = await verifyAppPin(pin);
      if (!verified.ok) {
        Logger.debug('AppStore', 'App PIN unlock rejected', { reason: verified.reason });
        return { ok: false, reason: verified.reason };
      }
      return finalizeSessionUnlock(set, get);
    },

    refreshAppPinStatus: async () => {
      const enabled = await hasAppPin();
      set({ appPinEnabled: enabled });
    },

    saveAppPin: async (pin) => {
      try {
        await setAppPin(pin);
        set({ appPinEnabled: true });
        return { ok: true };
      } catch (err) {
        Logger.warn('AppStore', 'Failed to save App PIN', {
          error: err instanceof Error ? err.message : String(err),
        });
        return { ok: false, reason: 'failed' };
      }
    },

    changeAppPin: async (currentPin, newPin) => {
      const result = await changeStoredAppPin(currentPin, newPin);
      if (!result.ok) {
        return { ok: false, reason: result.reason };
      }
      set({ appPinEnabled: true });
      return { ok: true };
    },

    logout: async () => {
      Logger.info('AppStore', 'Logging out');
      try {
        await logoutCurrentSession();
      } catch {
        // best-effort backend logout
      }
      get().clearAuthSession();
      Logger.info('AppStore', 'Logout complete');
    },

    deleteAccount: async () => {
      if (!resolveUsableAuthToken(get())) throw new Error('Not authenticated');
      Logger.info('AppStore', 'Deleting account');
      await deleteCurrentAccount();
      clearDataKey();
      get().clearAuthSession();
    },

    // ── Bootstrap / profile ───────────────────────────────────────────────

    hydrateUserProfile: async () => {
      const { authToken, sessionLockStatus } = get();
      if (sessionLockStatus !== 'unlocked' || !authToken) {
        if (!authToken) {
          set({ authStatus: 'unauthenticated' });
        }
        return;
      }
      try {
        const profile = await fetchCurrentUserProfile();
        set({
          authStatus: 'authenticated',
          userProfile: toLocalProfile(profile),
        });
        void get().loadExchangeRates();
        try {
          await useFinanceStore.getState().hydrateExchangeAccounts(authToken);
        } catch (error) {
          Logger.warn('AppStore', 'Exchange accounts hydration failed', { error: String(error) });
        }
      } catch (error) {
        Logger.warn('AppStore', 'hydrateUserProfile failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (get().sessionLockStatus === 'unlocked') {
          set({ authStatus: 'unauthenticated' });
        }
      }
    },

    refreshUserProfile: (profile) => {
      set({ userProfile: toLocalProfile(profile) });
    },

    // ── Profile mutations ─────────────────────────────────────────────────

    setDisplayName: async (displayName) => {
      const profile = await updateDisplayNameApi(displayName);
      set({ userProfile: toLocalProfile(profile) });
    },

    setReferralCode: async (referralCode) => {
      const profile = await setReferralCodeApi(referralCode);
      set({ userProfile: toLocalProfile(profile) });
    },

    requestEmailChange: async (newEmail) => requestEmailChangeApi(newEmail),

    confirmEmailChange: async (newEmail, verificationCode) => {
      const profile = await confirmEmailChangeApi(newEmail, verificationCode);
      set({ userProfile: toLocalProfile(profile) });
    },

    setLocalEmail: (email) => {
      set((state) => ({
        userProfile: {
          ...state.userProfile,
          email,
          emailIsPlaceholder: false,
        },
      }));
    },

    updateAvatar: async (avatarUrl) => {
      const profile = await updateAvatarApi(avatarUrl);
      set((state) => ({
        userProfile: { ...state.userProfile, avatarUrl: profile.avatarUrl },
      }));
    },

    // ── Preferences ───────────────────────────────────────────────────────

    setBaseCurrency: (baseCurrency) => {
      set((state) => ({ preferences: { ...state.preferences, baseCurrency } }));
      void AsyncStorage.setItem(BASE_CURRENCY_STORAGE_KEY, baseCurrency)
        .catch((err) => warnPreferencePersist('Base currency persist failed', err));
    },

    setLanguage: (language) => {
      set((state) => ({ preferences: { ...state.preferences, language } }));
      void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language)
        .catch((err) => warnPreferencePersist('Language persist failed', err));
    },

    setThemeMode: (themeMode) => {
      set((state) => ({ preferences: { ...state.preferences, themeMode } }));
      void AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode)
        .catch((err) => warnPreferencePersist('Theme preference persist failed', err));
    },

    setDisableScreenshot: (enabled) => {
      set((state) => ({
        preferences: { ...state.preferences, disableScreenshot: enabled },
      }));
      void applyScreenshotPolicy(enabled).then((applied) => {
        if (!applied && enabled) {
          set((state) => ({
            preferences: { ...state.preferences, disableScreenshot: false },
          }));
          void persistSecurityPrefs({
            disableScreenshot: false,
            hideBalance: get().preferences.hideBalance,
            biometricUnlockEnabled: get().preferences.biometricUnlockEnabled,
          }).catch((err) => warnPreferencePersist('Security preference persist failed', err));
        } else {
          void persistSecurityPrefs({
            disableScreenshot: enabled,
            hideBalance: get().preferences.hideBalance,
            biometricUnlockEnabled: get().preferences.biometricUnlockEnabled,
          }).catch((err) => warnPreferencePersist('Security preference persist failed', err));
        }
      });
    },

    setHideBalance: (enabled) => {
      set((state) => ({
        preferences: { ...state.preferences, hideBalance: enabled },
      }));
      void persistSecurityPrefs({
        disableScreenshot: get().preferences.disableScreenshot,
        hideBalance: enabled,
        biometricUnlockEnabled: get().preferences.biometricUnlockEnabled,
      }).catch((err) => warnPreferencePersist('Security preference persist failed', err));
    },

    setBiometricUnlockEnabled: (enabled) => {
      set((state) => ({
        preferences: { ...state.preferences, biometricUnlockEnabled: enabled },
      }));
      void persistSecurityPrefs({
        disableScreenshot: get().preferences.disableScreenshot,
        hideBalance: get().preferences.hideBalance,
        biometricUnlockEnabled: enabled,
      }).catch((err) => warnPreferencePersist('Security preference persist failed', err));
    },

    // ── Plaid ─────────────────────────────────────────────────────────────

    setPlaidLinkToken: (plaidLinkToken) => set({ plaidLinkToken }),

    requestPlaidLinkToken: async () => {
      if (!resolveUsableAuthToken(get())) return null;
      const result = await createPlaidLinkToken();
      const linkToken = result.link_token;
      if (!linkToken) throw new Error('No link token returned from backend');
      const now = Date.now();
      set({ plaidLinkToken: linkToken, plaidLinkTokenTimestamp: now });
      return linkToken;
    },

    confirmPlaidExchange: async (publicToken, institutionName) => {
      const token = resolveUsableAuthToken(get());
      if (!token) throw new Error('Not authenticated');
      await exchangePlaidPublicToken({ public_token: publicToken, institution_name: institutionName });

      // The backend creates the Plaid item immediately (hence the "connected"
      // email) but pulls accounts/balances asynchronously via webhooks. Poll
      // until the new accounts actually land server-side instead of waiting a
      // blind few seconds, otherwise the snapshot we fetch is still empty.
      const baselineAccountCount = useFinanceStore.getState().accounts.length;
      await waitForPlaidAccountsSynced({ baselineAccountCount });

      await useFinanceStore.getState().hydratePlaidFinanceData(token, true);
      void useFinanceStore.getState().hydrateAssetHistory(undefined, true);
      set({ plaidLinkToken: null, plaidLinkTokenTimestamp: null });
    },

    disconnectPlaidAccount: async (accountId) => {
      const token = resolveUsableAuthToken(get());
      if (!token) throw new Error('Not authenticated');
      await disconnectPlaidItem(accountId);
      await useFinanceStore.getState().disconnectBankingAccount(accountId);
      await waitForWebhookCompletion('disconnect');
      await useFinanceStore.getState().hydratePlaidFinanceData(token, true);
    },

    // ── Exchange ──────────────────────────────────────────────────────────

    disconnectExchangeAccount: async (exchangeAccountId) => {
      if (!resolveUsableAuthToken(get())) throw new Error('Not authenticated');
      await disconnectExchangeAccountApi(exchangeAccountId);

      const { useExchangeStore } = await import('./useExchangeStore');
      useExchangeStore.getState().removeExchangeAccount(exchangeAccountId);

      void useFinanceStore.getState().hydrateAssetHistory(undefined, true);
    },

    // ── Misc ──────────────────────────────────────────────────────────────

    loadExchangeRates: async () => {
      const state = get();
      if (state.isLoadingExchangeRates) return;
      if (state.exchangeRates && isCacheValid(state.exchangeRates.lastUpdated)) return;
      set({ isLoadingExchangeRates: true });
      try {
        const rates = await fetchExchangeRates();
        set({ exchangeRates: rates, isLoadingExchangeRates: false });
      } catch (error) {
        Logger.warn('AppStore', 'Failed to load exchange rates', { error: String(error) });
        set({ isLoadingExchangeRates: false });
      }
    },

    setAuthToken: (token) => {
      if (token) {
        set({ authToken: token, authStatus: 'authenticated' });
      } else {
        set({ authToken: null, authStatus: 'unauthenticated' });
      }
    },

  };
});

bindMembershipLabelReader(() => useAppStore.getState().userProfile.membershipLabel);
