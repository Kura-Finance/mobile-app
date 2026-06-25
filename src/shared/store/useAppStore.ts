/**
 * Top-level app store.
 *
 * Auth is delegated entirely to Privy (@privy-io/expo).
 *   - `setPrivySession` is called by PrivyBridgeProvider in App.tsx whenever
 *     Privy reports an authenticated user. It stores the Kura JWT (exchanged
 *     from the Privy token) and the derived user profile.
 *   - `clearAuthSession` is called on logout (also from PrivyBridgeProvider).
 *
 * The auth token is kept in-memory only; Privy handles its own persistence
 * and issues fresh tokens on resume.
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
import { waitForPlaidAccountsSynced } from '../utils/webhookWait';
import { disconnectExchange as disconnectExchangeAccountApi } from '../../lib/api/exchange';
import { fetchExchangeRates, isCacheValid, type ExchangeRates } from '../../lib/api/exchangeRate';
import { resetTrackFiSyncPolicy } from '../../features/trackfi/utils/trackFiSyncPolicy';
import { resetDefiPortfolioSession } from '../../features/trackfi/hooks/useDefiPortfolio';
import { useFinanceStore } from './useFinanceStore';
import { type Currency } from '../utils/currencyFormatter';
import { type ThemeMode } from '../theme/theme';
import Logger from '../utils/Logger';
import { waitForWebhookCompletion } from '../utils/webhookWait';
import { clearDataKey } from '../../lib/crypto/dataKeySession';
import { applyScreenshotPolicy } from '../../lib/security/screenshotGuard';

export type BaseCurrency = Currency;
export type Language = 'en' | 'zh-TW';

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
}

/** AsyncStorage key for the persisted theme mode. */
const THEME_MODE_STORAGE_KEY = '@kura/themeMode';
const SECURITY_PREFS_STORAGE_KEY = '@kura/securityPrefs';

interface PersistedSecurityPrefs {
  disableScreenshot?: boolean;
  hideBalance?: boolean;
}

function readSecurityPrefs(raw: string | null): Partial<PersistedSecurityPrefs> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as PersistedSecurityPrefs;
    return {
      disableScreenshot: parsed.disableScreenshot === true,
      hideBalance: parsed.hideBalance === true,
    };
  } catch {
    return {};
  }
}

async function persistSecurityPrefs(prefs: Pick<UserPreferences, 'disableScreenshot' | 'hideBalance'>) {
  await AsyncStorage.setItem(
    SECURITY_PREFS_STORAGE_KEY,
    JSON.stringify({
      disableScreenshot: prefs.disableScreenshot,
      hideBalance: prefs.hideBalance,
    }),
  );
}

interface AppState {
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
  userProfile: UserProfile;
  preferences: UserPreferences;
  plaidLinkToken: string | null;
  plaidLinkTokenTimestamp: number | null;
  authToken: string | null;
  authError: string | null;
  exchangeRates: ExchangeRates | null;
  isLoadingExchangeRates: boolean;

  // ── Privy bridge ────────────────────────────────────────────────────────
  /** Called by PrivyBridgeProvider when Privy becomes authenticated. */
  setPrivySession: (token: string, profile: UserProfileV1) => void;
  /** Wipe auth state (called on Privy logout or bridge disconnect). */
  clearAuthSession: () => void;
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
  themeMode: 'dark',
  disableScreenshot: false,
  hideBalance: false,
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

export const useAppStore = create<AppState>((set, get) => {
  setAuthTokenProvider(() => get().authToken);

  // Hydrate persisted preferences (fire-and-forget).
  void AsyncStorage.getItem(THEME_MODE_STORAGE_KEY)
    .then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set((state) => ({ preferences: { ...state.preferences, themeMode: stored } }));
      }
    })
    .catch(() => {});

  void AsyncStorage.getItem(SECURITY_PREFS_STORAGE_KEY)
    .then((stored) => {
      const security = readSecurityPrefs(stored);
      if (security.disableScreenshot !== undefined || security.hideBalance !== undefined) {
        set((state) => ({
          preferences: {
            ...state.preferences,
            disableScreenshot: security.disableScreenshot ?? state.preferences.disableScreenshot,
            hideBalance: security.hideBalance ?? state.preferences.hideBalance,
          },
        }));
      }
      if (security.disableScreenshot) {
        void applyScreenshotPolicy(true);
      }
    })
    .catch(() => {});

  return {
    authStatus: 'loading',
    userProfile: EMPTY_USER_PROFILE,
    preferences: DEFAULT_PREFERENCES,
    plaidLinkToken: null,
    plaidLinkTokenTimestamp: null,
    authToken: null,
    authError: null,
    exchangeRates: null,
    isLoadingExchangeRates: false,

    // ── Privy bridge ──────────────────────────────────────────────────────

    setPrivySession: (token, profile) => {
      Logger.info('AppStore', 'Privy session established', {
        userId: profile.id,
        emailIsPlaceholder: profile.emailIsPlaceholder,
      });
      set({
        authToken: token,
        authStatus: 'authenticated',
        userProfile: toLocalProfile(profile),
        authError: null,
        // Preserve the user's theme choice across login (it isn't account-scoped).
        preferences: {
          ...DEFAULT_PREFERENCES,
          themeMode: get().preferences.themeMode,
          disableScreenshot: get().preferences.disableScreenshot,
          hideBalance: get().preferences.hideBalance,
        },
      });
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
      // Wipe exchange data (accounts + decrypted balances) so a different
      // account signing in next doesn't briefly see the previous user's data.
      useFinanceStore.setState({ exchangeAccounts: [] });
      void import('./useExchangeStore')
        .then(({ useExchangeStore }) => useExchangeStore.getState().clearAll())
        .catch((err) =>
          Logger.warn('AppStore', 'Failed to clear exchange store', { err: String(err) }),
        );
      set({
        authToken: null,
        authStatus: 'unauthenticated',
        userProfile: EMPTY_USER_PROFILE,
        plaidLinkToken: null,
        plaidLinkTokenTimestamp: null,
        authError: null,
      });
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
      if (!get().authToken) throw new Error('Not authenticated');
      Logger.info('AppStore', 'Deleting account');
      await deleteCurrentAccount();
      clearDataKey();
      get().clearAuthSession();
    },

    // ── Bootstrap / profile ───────────────────────────────────────────────

    hydrateUserProfile: async () => {
      if (!get().authToken) {
        set({ authStatus: 'unauthenticated' });
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
          const token = get().authToken;
          if (token) {
            await useFinanceStore.getState().hydrateExchangeAccounts(token);
          }
        } catch (error) {
          Logger.warn('AppStore', 'Exchange accounts hydration failed', { error: String(error) });
        }
      } catch (error) {
        Logger.warn('AppStore', 'hydrateUserProfile failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        set({ authStatus: 'unauthenticated' });
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

    setBaseCurrency: (baseCurrency) =>
      set((state) => ({ preferences: { ...state.preferences, baseCurrency } })),

    setLanguage: (language) =>
      set((state) => ({ preferences: { ...state.preferences, language } })),

    setThemeMode: (themeMode) => {
      set((state) => ({ preferences: { ...state.preferences, themeMode } }));
      void AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode).catch(() => {});
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
          }).catch(() => {});
        } else {
          void persistSecurityPrefs({
            disableScreenshot: enabled,
            hideBalance: get().preferences.hideBalance,
          }).catch(() => {});
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
      }).catch(() => {});
    },

    // ── Plaid ─────────────────────────────────────────────────────────────

    setPlaidLinkToken: (plaidLinkToken) => set({ plaidLinkToken }),

    requestPlaidLinkToken: async () => {
      if (!get().authToken) return null;
      const result = await createPlaidLinkToken();
      const linkToken = result.link_token;
      if (!linkToken) throw new Error('No link token returned from backend');
      const now = Date.now();
      set({ plaidLinkToken: linkToken, plaidLinkTokenTimestamp: now });
      return linkToken;
    },

    confirmPlaidExchange: async (publicToken, institutionName) => {
      const token = get().authToken;
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
      const token = get().authToken;
      if (!token) throw new Error('Not authenticated');
      await disconnectPlaidItem(accountId);
      await useFinanceStore.getState().disconnectBankingAccount(accountId);
      await waitForWebhookCompletion('disconnect');
      await useFinanceStore.getState().hydratePlaidFinanceData(token, true);
    },

    // ── Exchange ──────────────────────────────────────────────────────────

    disconnectExchangeAccount: async (exchangeAccountId) => {
      if (!get().authToken) throw new Error('Not authenticated');
      await disconnectExchangeAccountApi(exchangeAccountId);

      const { useExchangeStore } = await import('./useExchangeStore');
      useExchangeStore.getState().removeExchangeAccount(exchangeAccountId);

      const { exchangeAccounts } = useFinanceStore.getState();
      useFinanceStore.setState({
        exchangeAccounts: exchangeAccounts.filter((acc) => acc.id !== exchangeAccountId),
      });

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
