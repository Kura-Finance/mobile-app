// MUST be first import — patches Object.defineProperty so getter-only `default`
// exports don't throw "Cannot assign to property 'default' which has only a getter"
// in Hermes during module init.
import './src/shims/defaultWritable';
import '@walletconnect/react-native-compat';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from './src/shared/locales/i18n';
import { I18nLanguageSync } from './src/shared/hooks/useAppTranslation';
import { BaseCurrencySync, ExchangeRatesBootstrap } from './src/shared/hooks/useBaseCurrencySync';
import { PrivyProvider, usePrivy, useIdentityToken, usePrivyClient } from '@privy-io/expo';
import { exchangePrivyToken } from './src/lib/api/auth/privyExchange';
import { applyPendingOAuthDisplayName } from './src/lib/auth/applyPendingOAuthName';
import { fetchIdentityTokenWithRetry } from './src/lib/auth/privyTokens';
import { KuraApiError } from './src/lib/api/errors';
import { clearDataKey } from './src/lib/crypto/dataKeySession';
import { env, hasValidWalletConnectProjectId } from './src/config/env';
import { useAppStore } from './src/shared/store/useAppStore';
import { ThemeProvider, useTheme } from './src/shared/theme/ThemeContext';
import Logger from './src/shared/utils/Logger';
import { getApiBaseUrl } from './src/lib/api/baseUrl';
import { pingHealth } from './src/lib/api/system';
import { installAppLock } from './src/lib/security/appLock';
import { installScreenshotGuard } from './src/lib/security/screenshotGuard';
import Header from './src/shared/navigation/Header';
import TabNavigator from './src/shared/navigation/TabNavigator';
import ConnectedDappsScreen from './src/features/walletconnect/screens/ConnectedDappsScreen';
import WalletTransactionsScreen from './src/features/card/screens/WalletTransactionsScreen';
import { CryptoContactsProvider } from './src/features/card/hooks/useCryptoContacts';
import TransactionDetailScreen from './src/features/card/screens/TransactionDetailScreen';
import CardManagerScreen from './src/features/card/screens/CardManagerScreen';
import DinariKycScreen from './src/features/stocks/screens/DinariKycScreen';
import PrivyLoginScreen from './src/features/auth/screens/PrivyLoginScreen';
import { AppKitProvider, AppKit } from '@reown/appkit-react-native';
import { initAppKit } from './src/shared/config/AppKitConfig';
import type { createAppKit } from '@reown/appkit-react-native';
import { useWalletSync } from './src/shared/hooks/useWalletSync';
import KuraWalletConnectShell from './src/features/walletconnect/components/KuraWalletConnectShell';
import { startDeepLinkCapture } from './src/lib/walletconnect/wcInboundPairing';
import {
  consumePendingReferralCode,
  installReferralDeepLinkListener,
} from './src/lib/referral/pendingReferralCode';
import BootLoadingView from './src/shared/components/BootLoadingView';
import BootErrorScreen from './src/shared/components/BootErrorScreen';
import SessionLockOverlay from './src/shared/components/SessionLockOverlay';
import AppPinSetupOverlay from './src/shared/components/AppPinSetupOverlay';
import LocalAuthOverlay from './src/shared/components/LocalAuthOverlay';

// Boot breadcrumb: confirms the JS bundle finished evaluating top-level imports
// (incl. AppKitConfig's createAppKit). On a release build that's stuck on the
// white splash, the device log shows whether we even get this far.
Logger.info('Boot', 'App.tsx module evaluated — top-level imports OK');

const PRIVY_APP_ID = env.privyAppId;

const PRIVY_CLIENT_ID = env.privyClientId || undefined;

if (!PRIVY_CLIENT_ID) {
  Logger.warn(
    'App',
    'EXPO_PUBLIC_PRIVY_CLIENT_ID is missing — identity tokens may be unavailable and backend email binding can fail',
  );
}

/**
 * Privy's <PrivyProvider> throws during initialization if appId is empty,
 * which crashes the entire app with a cryptic error. Validate up-front so we
 * can show an actionable configuration screen instead of a blank crash.
 */
const HAS_VALID_PRIVY_APP_ID = PRIVY_APP_ID.trim().length > 0;
const HAS_VALID_WC_PROJECT_ID = hasValidWalletConnectProjectId();

const Stack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();

// ─────────────────────────────────────────────────────────────────────────────
// Bridge: syncs Privy auth state → useAppStore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retry `getIdentityToken()` — see src/lib/auth/privyTokens.ts
 */

/** Max attempts for the Privy→Kura token exchange on transient failures. */
const MAX_LOGIN_ATTEMPTS = 3;

/**
 * Identity-token back-off alone can take ~15s before the first login attempt.
 * Keep this above that window plus login retries so slow devices/networks are
 * not shown the retry screen while exchange is still in flight.
 */
const SIGN_IN_TIMEOUT_MS = 60_000;

/**
 * An auth *rejection* means Privy's token was not accepted by the backend
 * (401/403) — the only case where signing out and re-authenticating helps.
 * Everything else (5xx, network) is transient: we retry and, if it keeps
 * failing, surface a retry screen instead of kicking the user to login.
 */
function isAuthRejection(err: unknown): boolean {
  return (
    err instanceof KuraApiError &&
    (err.status === 401 || err.status === 403 || err.code === 'UNAUTHORIZED')
  );
}

type LoginExchangeStatus = 'idle' | 'pending' | 'error';

interface LoginExchangeState {
  status: LoginExchangeStatus;
  retry: () => void;
}

const LoginExchangeContext = React.createContext<LoginExchangeState>({
  status: 'idle',
  retry: () => {},
});

function useLoginExchange(): LoginExchangeState {
  return React.useContext(LoginExchangeContext);
}

function PrivyBridgeProvider({ children }: { children: React.ReactNode }) {
  const { isReady, user, getAccessToken, logout } = usePrivy();
  const { getIdentityToken } = useIdentityToken();
  const privyClient = usePrivyClient();
  const setPrivySession = useAppStore((s) => s.setPrivySession);
  const clearAuthSession = useAppStore((s) => s.clearAuthSession);
  const sessionLockStatus = useAppStore((s) => s.sessionLockStatus);
  const authStatus = useAppStore((s) => s.authStatus);

  const [exchangeStatus, setExchangeStatus] = useState<LoginExchangeStatus>('idle');
  const [retryNonce, setRetryNonce] = useState(0);
  const retry = React.useCallback(() => setRetryNonce((n) => n + 1), []);
  const activePrivyUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    Logger.debug('PrivyBridge', '[1] isReady changed', { isReady, hasUser: !!user });
    if (!isReady) return;

    let cancelled = false;

    if (user) {
      if (sessionLockStatus === 'checking') {
        return;
      }
      if (sessionLockStatus === 'locked') {
        setExchangeStatus('idle');
        return;
      }

      const privyUserId = user.id;
      const existingToken = useAppStore.getState().authToken;
      const knownPrivyUserId = activePrivyUserIdRef.current;

      // Biometric resume / cold-start restore already has a Kura JWT — do not
      // re-exchange on every sessionLockStatus flip or we hammer /api/auth/login.
      if (existingToken) {
        const samePrivyUser =
          knownPrivyUserId === null || knownPrivyUserId === privyUserId;
        if (samePrivyUser) {
          activePrivyUserIdRef.current = privyUserId;
          setExchangeStatus('idle');
          return;
        }
        clearDataKey();
        clearAuthSession();
        activePrivyUserIdRef.current = privyUserId;
      } else if (knownPrivyUserId !== privyUserId) {
        activePrivyUserIdRef.current = privyUserId;
      }

      Logger.info('PrivyBridge', '[2] Privy user detected', {
        privyUserId: user.id,
        linkedAccounts: user.linked_accounts?.map((a) => a.type),
      });
      setExchangeStatus('pending');

      void (async () => {
        Logger.debug('PrivyBridge', '[3] Fetching Privy tokens...');
        let accessToken: string | null = null;
        let identityToken: string | null = null;
        let privyUserForEmail = user;

        try {
          accessToken = await getAccessToken();
          if (cancelled) return;
          if (!accessToken) {
            Logger.warn('PrivyBridge', '[3] accessToken is null, aborting');
            if (!cancelled) setExchangeStatus('idle');
            return;
          }

          // Refresh the Privy user record before requesting the identity token.
          // Privy issues identity tokens asynchronously after login; user.get()
          // helps sync linked accounts (incl. email) and makes the token available.
          try {
            const refreshed = await privyClient.user.get();
            if (cancelled) return;
            privyUserForEmail = refreshed.user;
            Logger.debug('PrivyBridge', '[3] Privy user refreshed', {
              linkedAccounts: refreshed.user.linked_accounts?.map((a) => a.type),
            });
          } catch (err) {
            Logger.warn('PrivyBridge', '[3] privyClient.user.get() failed', {
              error: err instanceof Error ? err.message : String(err),
            });
          }

          identityToken = await fetchIdentityTokenWithRetry(getIdentityToken);
          if (cancelled) return;

          if (!identityToken) {
            try {
              await privyClient.user.get();
              if (cancelled) return;
              identityToken = await getIdentityToken();
              if (identityToken) {
                Logger.info('PrivyBridge', '[3] identity token obtained after user refresh');
              }
            } catch (err) {
              Logger.warn('PrivyBridge', '[3] identity token refresh attempt failed', {
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }

          if (cancelled) return;

          Logger.info('PrivyBridge', '[3] Tokens received', {
            hasAccessToken: !!accessToken,
            hasIdentityToken: !!identityToken,
          });
        } catch (err) {
          Logger.error('PrivyBridge', '[3] token fetch failed', {
            error: err instanceof Error ? err.message : String(err),
          });
          if (!cancelled) setExchangeStatus('idle');
          return;
        }

        Logger.debug('PrivyBridge', '[4] Calling POST /api/auth/login...', {
          willSendIdentityToken: !!identityToken,
        });

        for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt++) {
          if (cancelled) return;
          try {
            let loginIdentityToken = identityToken;
            if (!loginIdentityToken && attempt > 1) {
              loginIdentityToken = await fetchIdentityTokenWithRetry(getIdentityToken, 2, 800);
              if (cancelled) return;
              if (loginIdentityToken) {
                identityToken = loginIdentityToken;
                Logger.info('PrivyBridge', `[4] identity token obtained on login retry ${attempt}`);
              }
            }

            const pendingReferralCode = await consumePendingReferralCode();
            if (cancelled) return;

            const login = await exchangePrivyToken(
              accessToken,
              loginIdentityToken ?? undefined,
              pendingReferralCode,
            );
            if (cancelled) return;

            // JWT must be in the store before authenticated /api/auth/me/* calls.
            setPrivySession(login.token, login.user);

            const profile = await applyPendingOAuthDisplayName(login.user, privyUserForEmail);
            if (profile.displayName !== login.user.displayName) {
              useAppStore.getState().refreshUserProfile(profile);
            }

            Logger.info('PrivyBridge', '[5] Kura JWT received', {
              backendUserId: profile.id,
              backendUserEmail: profile.email,
              emailIsPlaceholder: profile.emailIsPlaceholder,
              displayName: profile.displayName,
              emailConflict: login.emailConflict,
            });
            setExchangeStatus('idle');
            Logger.info('PrivyBridge', '[6] Session set — login complete ✓');

            if (login.emailConflict) {
              Alert.alert(
                i18n.t('settings.emailConflictTitle'),
                i18n.t('settings.emailConflictMessage'),
              );
            }
            return;
          } catch (err) {
            if (cancelled) return;
            // Auth rejection (token invalid / expired) → re-authenticating is the
            // only fix, so sign out: user→null sends AppInner to the login screen
            // and the `!user` branch below wipes the data key + auth session.
            if (isAuthRejection(err)) {
              Logger.warn('PrivyBridge', '[5] login rejected (auth) → signing out', {
                status: err instanceof KuraApiError ? err.status : undefined,
                code: err instanceof KuraApiError ? err.code : undefined,
              });
              setExchangeStatus('idle');
              void logout();
              return;
            }
            // Server / transient error (5xx, network): the Privy session is fine,
            // the backend is just (temporarily) failing. Retry with back-off and,
            // if it keeps failing, show a retry screen instead of kicking the user.
            Logger.warn(
              'PrivyBridge',
              `[5] POST /api/auth/login failed (transient) attempt ${attempt}/${MAX_LOGIN_ATTEMPTS}`,
              {
                status: err instanceof KuraApiError ? err.status : undefined,
                error: err instanceof Error ? err.message : String(err),
              },
            );
            if (attempt < MAX_LOGIN_ATTEMPTS) {
              await new Promise<void>((r) => setTimeout(r, 1200 * attempt));
            }
          }
        }

        if (cancelled) return;
        Logger.error('PrivyBridge', '[5] login failed after all retries — showing retry screen');
        setExchangeStatus('error');
      })();
    } else {
      // Privy user gone (logout / session expired / account deleted) → wipe crypto + auth
      Logger.info('PrivyBridge', '[logout] Privy user cleared → wiping session', { prevAuthStatus: authStatus });
      activePrivyUserIdRef.current = null;
      setExchangeStatus('idle');
      clearDataKey();
      if (authStatus !== 'unauthenticated') {
        clearAuthSession();
      }
    }

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, user?.id, retryNonce, sessionLockStatus]);

  return (
    <LoginExchangeContext.Provider value={{ status: exchangeStatus, retry }}>
      {children}
      <SessionLockOverlay />
      <AppPinSetupOverlay />
      <LocalAuthOverlay />
    </LoginExchangeContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screens
// ─────────────────────────────────────────────────────────────────────────────

function HomeScreen() {
  useWalletSync();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabNavigator />
      <Header />
      <View style={{ position: 'absolute', height: '100%', width: '100%', pointerEvents: 'box-none' }}>
        <AppKit />
      </View>
    </View>
  );
}

function MainNavigator() {
  return (
    <CryptoContactsProvider>
      <MainStack.Navigator screenOptions={{ headerShown: false }}>
        <MainStack.Screen name="Tabs" component={HomeScreen} />
        <MainStack.Screen name="ConnectedDapps" component={ConnectedDappsScreen} />
        <MainStack.Screen name="WalletTransactions" component={WalletTransactionsScreen} />
        <MainStack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
        <MainStack.Screen name="CardManager" component={CardManagerScreen} />
        <MainStack.Screen name="DinariKyc" component={DinariKycScreen} />
      </MainStack.Navigator>
    </CryptoContactsProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root app — driven by Privy auth state (not useAppStore)
// ─────────────────────────────────────────────────────────────────────────────

/** Watchdog windows (ms) — surface an actionable screen instead of an endless spinner. */
const PRIVY_INIT_TIMEOUT_MS = 12_000;

function AppInner() {
  const { t } = useTranslation();
  const { isReady, user } = usePrivy();
  const { colors, scheme } = useTheme();
  const navTheme = {
    ...DefaultTheme,
    dark: scheme === 'dark',
    colors: { ...DefaultTheme.colors, background: colors.background },
  };
  const hydrateUserProfile = useAppStore((s) => s.hydrateUserProfile);
  const initializeSessionLock = useAppStore((s) => s.initializeSessionLock);
  const authToken = useAppStore((s) => s.authToken);
  const sessionLockStatus = useAppStore((s) => s.sessionLockStatus);
  const { status: loginStatus } = useLoginExchange();
  const [backendOffline, setBackendOffline] = useState(false);
  const [initTimedOut, setInitTimedOut] = useState(false);
  const [signInTimedOut, setSignInTimedOut] = useState(false);

  Logger.debug('Boot', 'AppInner render', { isReady, hasUser: !!user, hasToken: !!authToken, sessionLockStatus });

  useEffect(() => {
    if (!isReady) return;
    void initializeSessionLock(!!user);
  }, [isReady, user?.id, initializeSessionLock]);

  // Watchdog 1: Privy SDK never reports ready (e.g. prod app/bundle not allowed).
  useEffect(() => {
    if (isReady) {
      setInitTimedOut(false);
      return;
    }
    const t = setTimeout(() => {
      Logger.error('Boot', 'Privy isReady watchdog fired — SDK did not initialize in time');
      setInitTimedOut(true);
    }, PRIVY_INIT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [isReady]);

  // Watchdog 2: signed into Privy but the Kura token exchange never completes.
  useEffect(() => {
    if (!(user && !authToken)) {
      setSignInTimedOut(false);
      return;
    }
    // Reset the timer while exchange is actively retrying so we don't flash the
    // retry screen mid-flight on slow networks.
    if (loginStatus === 'pending') {
      setSignInTimedOut(false);
    }
    const t = setTimeout(() => {
      if (loginStatus === 'pending') {
        Logger.warn('Boot', 'Sign-in watchdog fired while exchange still pending');
      } else {
        Logger.error('Boot', 'Sign-in watchdog fired — token exchange did not complete');
      }
      setSignInTimedOut(true);
    }, SIGN_IN_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [user, authToken, loginStatus]);

  useEffect(() => {
    Logger.debug('App', 'API base URL', { url: getApiBaseUrl() });
    installReferralDeepLinkListener();

    const uninstallLock = installAppLock();
    const uninstallScreenshotGuard = installScreenshotGuard();

    void pingHealth(5_000).then((result) => {
      if (!result.ok) {
        Logger.warn('App', 'Backend health ping failed', {
          latencyMs: result.latencyMs,
          error: result.error,
        });
        setBackendOffline(true);
      } else {
        setBackendOffline(false);
      }
    });

    return () => {
      uninstallLock();
      uninstallScreenshotGuard();
    };
  }, []);

  useEffect(() => {
    if (user && sessionLockStatus === 'unlocked') {
      void hydrateUserProfile();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, sessionLockStatus]);

  useEffect(() => {
    if (user && sessionLockStatus === 'unlocked' && authToken) {
      startDeepLinkCapture();
    }
  }, [user, sessionLockStatus, authToken]);

  if (!isReady) {
    if (initTimedOut) {
      return (
        <BootStuckScreen
          title={t('boot.initFailedTitle')}
          message={t('boot.initFailedMessage')}
        />
      );
    }
    return <BootLoadingView />;
  }

  if (user && sessionLockStatus === 'checking') {
    return <BootLoadingView />;
  }

  // Privy is authenticated but the Kura token exchange keeps failing (backend
  // 5xx / network). Don't kick the user back to login — offer a retry instead.
  if (user && loginStatus === 'error') {
    return <LoginRetryScreen />;
  }

  // Privy user present but no Kura session yet → the exchange is in flight.
  // Show a loader instead of flashing the (session-less) main UI.
  // Locked cold starts show the main shell under SessionLockOverlay (JWT stays in SecureStore only).
  if (user && !authToken && sessionLockStatus !== 'locked') {
    if (signInTimedOut && loginStatus !== 'pending') {
      return <LoginRetryScreen />;
    }
    return <BootLoadingView caption="Signing in…" />;
  }

  const showMainApp = user && (authToken || sessionLockStatus === 'locked');

  const navigation = (
    <NavigationContainer theme={navTheme}>
        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} translucent={true} />
        {backendOffline ? (
          <View
            style={{
              paddingTop: 44,
              paddingHorizontal: 16,
              paddingBottom: 8,
              backgroundColor: '#7F1D1D',
            }}
          >
            <Text style={{ color: '#FECACA', fontSize: 12, textAlign: 'center' }}>
              Connection issue — some data may be out of date.
            </Text>
          </View>
        ) : null}
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {showMainApp ? (
            <Stack.Screen name="Main" component={MainNavigator} />
          ) : (
            <Stack.Screen
              name="Auth"
              component={PrivyLoginScreen}
              options={{ animationTypeForReplace: 'pop' }}
            />
          )}
        </Stack.Navigator>
    </NavigationContainer>
  );

  if (showMainApp) {
    return <KuraWalletConnectShell>{navigation}</KuraWalletConnectShell>;
  }

  return navigation;
}

// ─────────────────────────────────────────────────────────────────────────────
// Login retry — Privy is signed in but the Kura token exchange keeps failing
// ─────────────────────────────────────────────────────────────────────────────

function LoginRetryScreen() {
  const { t } = useTranslation();
  const { logout } = usePrivy();
  const { retry } = useLoginExchange();

  return (
    <BootErrorScreen
      icon="cloud-offline"
      title={t('boot.signInFailedTitle')}
      message={t('boot.signInFailedMessage')}
      actions={[
        { label: t('boot.tryAgain'), onPress: retry, variant: 'primary' },
        { label: t('auth.signOut'), onPress: () => void logout(), variant: 'secondary' },
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Boot-stuck fallback — watchdog fired (init/sign-in took too long)
// ─────────────────────────────────────────────────────────────────────────────

function BootStuckScreen({ title, message }: { title: string; message: string }) {
  return (
    <BootErrorScreen
      icon="alert-circle"
      title={title}
      message={message}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root error boundary — turns a render-time crash into a visible screen instead
// of a blank/white splash (cannot catch errors thrown during module import).
// ─────────────────────────────────────────────────────────────────────────────

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    Logger.error('Boot', 'RootErrorBoundary caught a render crash', {
      error: error.message,
      stack: info.componentStack?.slice(0, 500),
    });
  }

  render() {
    if (this.state.error) {
      return (
        <BootStuckScreen
          title={i18n.t('boot.crashTitle')}
          message={`${i18n.t('boot.crashMessage')}\n\n${this.state.error.message}`}
        />
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Missing-config fallback — shown when Privy appId is not set
// ─────────────────────────────────────────────────────────────────────────────

function WalletConnectConfigErrorScreen() {
  return (
    <BootErrorScreen
      icon="settings"
      title={i18n.t('boot.configTitle')}
      message={i18n.t('boot.walletConnectConfigMessage')}
    />
  );
}

function PrivyConfigErrorScreen() {
  return (
    <BootErrorScreen
      icon="settings"
      title={i18n.t('boot.configTitle')}
      message={i18n.t('boot.configMessage')}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppKit bootstrap — WalletKit must init before AppKit (shared SignClient)
// ─────────────────────────────────────────────────────────────────────────────

function AppKitGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [instance, setInstance] = useState<ReturnType<typeof createAppKit> | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setInitError(null);

    void initAppKit()
      .then((next) => {
        if (!cancelled) setInstance(next);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        Logger.error('App', 'AppKit init failed', { error: message });
        setInitError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [retryNonce]);

  if (initError) {
    return (
      <BootErrorScreen
        icon="settings"
        title={t('boot.appKitFailedTitle')}
        message={t('boot.appKitFailedMessage')}
        actions={[
          {
            label: t('boot.tryAgain'),
            onPress: () => {
              setInstance(null);
              setInitError(null);
              setRetryNonce((n) => n + 1);
            },
            variant: 'primary',
          },
        ]}
      />
    );
  }

  if (!instance) {
    return <BootLoadingView />;
  }

  return <AppKitProvider instance={instance}>{children}</AppKitProvider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  // Guard: mounting <PrivyProvider> with an empty appId throws and crashes the
  // whole app. Fail gracefully with an actionable screen instead.
  if (!HAS_VALID_PRIVY_APP_ID) {
    Logger.error('App', 'Privy App ID is missing — set EXPO_PUBLIC_PRIVY_APP_ID');
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <StatusBar style="dark" translucent={true} />
          <PrivyConfigErrorScreen />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (!HAS_VALID_WC_PROJECT_ID) {
    Logger.error(
      'App',
      'WalletConnect Project ID is missing or invalid — set EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID',
    );
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <StatusBar style="dark" translucent={true} />
          <WalletConnectConfigErrorScreen />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
      <RootErrorBoundary>
        <ThemeProvider>
          <I18nextProvider i18n={i18n}>
            <I18nLanguageSync />
            <BaseCurrencySync />
            <ExchangeRatesBootstrap />
            <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
              <AppKitGate>
                <PrivyBridgeProvider>
                  <AppInner />
                </PrivyBridgeProvider>
              </AppKitGate>
            </PrivyProvider>
          </I18nextProvider>
        </ThemeProvider>
      </RootErrorBoundary>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
});
