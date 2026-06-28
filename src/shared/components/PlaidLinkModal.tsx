import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, Keyboard } from 'react-native';
import LoadingDots from './LoadingDots';
import { Ionicons } from '@expo/vector-icons';
import { create, open, destroy, usePlaidEmitter } from 'react-native-plaid-link-sdk';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme/ThemeContext';
import Logger from '../utils/Logger';
import { setPlaidOAuthInProgress, isPlaidOAuthInProgress } from '../utils/plaidOAuthState';

interface PlaidLinkModalProps {
  isVisible: boolean;
  linkToken: string | null;
  onClose: () => void;
  onSuccess?: () => void;
  onError?: (errorMessage: string) => void;
}

const LINK_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

type PlaidResult = 
  | { type: 'success'; publicToken: string; institution?: string }
  | { type: 'exit'; error?: string; cancelled?: boolean }
  | { type: 'timeout' }
  | null;

export default function PlaidLinkModal({ 
  isVisible, 
  linkToken: initialLinkToken,
  onClose, 
  onSuccess,
  onError
}: PlaidLinkModalProps) {
  const { colors } = useTheme();
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Controls our React Native <Modal>. We hide it before presenting Plaid's
  // native UI so Plaid is not presented on top of (and does not dismiss) an
  // active RN Modal — which on iOS leaves the app unresponsive / crashes.
  // See https://github.com/plaid/react-native-plaid-link-sdk/issues/227
  const [sheetVisible, setSheetVisible] = useState(true);

  // Plaid States
  const [sessionState, setSessionState] = useState<'idle' | 'creating' | 'active' | 'destroying'>('idle');
  const [plaidResult, setPlaidResult] = useState<PlaidResult>(null);

  // Refs
  const sessionRef = useRef<boolean>(false);
  const tokenRefreshingRef = useRef(false);
  const isMountedRef = useRef(true);
  // True from OPEN_OAUTH until a terminal Plaid result (success/exit/timeout) is
  // processed. While true we must NOT destroy() the Plaid session: the OAuth
  // handoff backgrounds the app to a native ASWebAuthenticationSession that lives
  // outside the RN tree. Tearing the session down here aborts OAuth so the
  // redirect comes back to nothing and onSuccess never fires.
  const oauthInProgressRef = useRef(false);

  // Network monitoring
  const { isConnected } = useNetInfo();

  // ── Diagnostic: log EVERY Plaid Link lifecycle event ──────────────────────
  // These events fire on Plaid's native emitter independently of the open()
  // onSuccess / onExit callbacks. When those callbacks never run (e.g. the
  // native UI is torn down by a WebKit GPU crash), this still surfaces the last
  // view the user reached and any ERROR / EXIT the SDK emitted.
  usePlaidEmitter((event: any) => {
    const eventName = event?.eventName;
    // Mark the OAuth handoff so cleanupSession() leaves the session alive while
    // the native bank auth (ASWebAuthenticationSession) is presented. The flag is
    // cleared only once a terminal result is processed in SECTION 5.
    if (eventName === 'OPEN_OAUTH') {
      oauthInProgressRef.current = true;
      setPlaidOAuthInProgress(true);
    }
    Logger.info('PlaidLinkModal', `Plaid event: ${eventName}`, {
      viewName: event?.metadata?.viewName,
      errorType: event?.metadata?.errorType,
      errorCode: event?.metadata?.errorCode,
      errorMessage: event?.metadata?.errorMessage,
      exitStatus: event?.metadata?.exitStatus,
      institution: event?.metadata?.institutionName,
    });
  });

  // Store functions
  const confirmPlaidExchange = useAppStore((state: any) => state.confirmPlaidExchange);
  const requestPlaidLinkToken = useAppStore((state: any) => state.requestPlaidLinkToken);
  const plaidLinkTokenTimestamp = useAppStore((state: any) => state.plaidLinkTokenTimestamp);
  const plaidLinkToken = useAppStore((state: any) => state.plaidLinkToken);

  const linkToken = plaidLinkToken || initialLinkToken;

  const isTokenExpired = useCallback(() => {
    if (!plaidLinkTokenTimestamp) return true;
    const ageMs = Date.now() - plaidLinkTokenTimestamp;
    return ageMs > LINK_TOKEN_EXPIRY_MS;
  }, [plaidLinkTokenTimestamp]);

  /**
   * 销毁 Plaid session - 提前定义便于在各个地方使用
   */
  const cleanupSession = useCallback(() => {
    // Never destroy the session mid-link/OAuth. The app is backgrounded to the
    // bank's native auth flow; destroying here is exactly what aborts the redirect
    // and leaves onSuccess unfired. The session is cleaned up once the result is
    // handled in SECTION 5 (success/exit/timeout) or by the 5-minute timeout.
    //
    // We check the GLOBAL flag (not just this instance's ref): there are multiple
    // PlaidLinkModal instances mounted across screens, and OAuth backgrounding can
    // unmount/remount the hosting screen. A freshly-mounted instance has a fresh
    // (false) local ref, so relying on the ref alone lets reset/unmount paths call
    // destroy() and tear down the global Plaid session mid-handoff.
    if (oauthInProgressRef.current || isPlaidOAuthInProgress()) {
      Logger.info('PlaidLinkModal', 'Skipping session destroy — Plaid link/OAuth handoff in progress');
      return;
    }
    try {
      if (sessionRef.current) {
        destroy();
        sessionRef.current = false;
        Logger.info('PlaidLinkModal', 'Plaid session destroyed');
      }
    } catch (err) {
      Logger.warn('PlaidLinkModal', 'Error destroying session', { error: String(err) });
    }
    setSessionState('idle');
    setPlaidResult(null);
  }, []);

  // ============================================================================
  // SECTION 1: Token 管理（独立 useEffect）
  // ============================================================================
  
  /**
   * 自动请求没有的 token
   */
  useEffect(() => {
    if (!isVisible || linkToken || isInitializing || isLoading) return;

    Logger.debug('PlaidLinkModal', 'Auto-requesting token', { linkToken, isInitializing });
    setIsLoading(true);

    requestPlaidLinkToken()
      .then(() => {
        if (isMountedRef.current) {
          Logger.info('PlaidLinkModal', 'Token auto-requested successfully');
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMountedRef.current) {
          const msg = err instanceof Error ? err.message : 'Failed to get token';
          setError(msg);
          setIsLoading(false);
          Logger.error('PlaidLinkModal', 'Auto-request failed', { error: msg });
        }
      });
  }, [isVisible, linkToken, isInitializing, isLoading, requestPlaidLinkToken]);

  /**
   * 处理 token 过期 - 自动刷新
   */
  useEffect(() => {
    if (!isVisible || !linkToken || !isTokenExpired() || tokenRefreshingRef.current) return;

    Logger.info('PlaidLinkModal', 'Token expired, auto-refreshing');
    tokenRefreshingRef.current = true;
    setError('Token expired. Requesting new one...');

    requestPlaidLinkToken()
      .then(() => {
        if (isMountedRef.current) {
          Logger.info('PlaidLinkModal', 'Token refreshed successfully');
          setError(null);
        }
      })
      .catch((err: any) => {
        if (isMountedRef.current) {
          const msg = err instanceof Error ? err.message : 'Failed to refresh token';
          setError(msg);
          Logger.error('PlaidLinkModal', 'Token refresh failed', { error: msg });
        }
      })
      .finally(() => {
        tokenRefreshingRef.current = false;
      });
  }, [isVisible, linkToken, isTokenExpired, requestPlaidLinkToken]);

  // ============================================================================
  // SECTION 2: 网络监听
  // ============================================================================

  useEffect(() => {
    if (isVisible && !isConnected) {
      setNetworkError('Network connection lost. Please check your connection and try again.');
      Logger.warn('PlaidLinkModal', 'Network disconnected');
    } else if (isConnected) {
      setNetworkError(null);
    }
  }, [isConnected, isVisible]);

  // ============================================================================
  // SECTION 3: Session 创建（独立 useEffect）
  // ============================================================================

  useEffect(() => {
    if (!isVisible || !linkToken || isTokenExpired() || sessionState !== 'idle') {
      return;
    }

    if (sessionRef.current) {
      Logger.debug('PlaidLinkModal', 'Session already exists, skipping creation');
      return;
    }

    let isMounted = true;

    const createSession = async () => {
      try {
        setSessionState('creating');
        setIsInitializing(true);
        setIsLoading(true);
        setError(null);

        Logger.debug('PlaidLinkModal', 'Creating Plaid session', {
          token: linkToken.substring(0, 20) + '...',
        });

        // create() is synchronous, no need for crash guard
        create({ token: linkToken });
        
        if (isMounted) {
          sessionRef.current = true;
          setSessionState('active');
          Logger.info('PlaidLinkModal', 'Plaid session created');
        }
      } catch (err: any) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to create session';
          Logger.error('PlaidLinkModal', 'Session creation failed', { error: msg });
          setError(msg);
          setSessionState('idle');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsInitializing(false);
        }
      }
    };

    createSession();

    return () => {
      isMounted = false;
    };
  }, [isVisible, linkToken, isTokenExpired, sessionState]);

  // ============================================================================
  // SECTION 4: 打开 Plaid UI（独立 useEffect）
  // ============================================================================

  useEffect(() => {
    if (sessionState !== 'active' || !isMountedRef.current) return;

    let isMounted = true;
    let plaidExitTimeoutRef: NodeJS.Timeout | null = null;
    let openDelayRef: NodeJS.Timeout | null = null;

    const openPlaidUI = () => {
      if (!isMounted) return;
      try {
        Logger.debug('PlaidLinkModal', 'Opening Plaid UI');

        // 设置 5 分钟超时保护
        plaidExitTimeoutRef = setTimeout(() => {
          if (isMounted && sessionRef.current) {
            Logger.warn('PlaidLinkModal', 'Plaid timeout after 5 minutes');
            setPlaidResult({ type: 'timeout' });
          }
        }, 5 * 60 * 1000);

        open({
          onSuccess: (linkSuccess: any) => {
            if (!isMounted) return;
            Logger.info('PlaidLinkModal', 'Plaid onSuccess', {
              institution: linkSuccess?.metadata?.institution?.name,
            });
            setPlaidResult({
              type: 'success',
              publicToken: linkSuccess?.publicToken,
              institution: linkSuccess?.metadata?.institution?.name,
            });
          },
          onExit: (linkExit: any) => {
            if (!isMounted) return;
            Logger.info('PlaidLinkModal', 'Plaid onExit', {
              hasError: !!linkExit?.error,
              errorCode: linkExit?.error?.errorCode,
            });
            setPlaidResult({
              type: 'exit',
              error: linkExit?.error?.displayMessage || linkExit?.error?.errorMessage,
              cancelled: !linkExit?.error || !linkExit.error.errorCode,
            });
          },
        });

        Logger.debug('PlaidLinkModal', 'Plaid UI opened successfully');

        // Mark a Plaid link session as in-flight from the moment the native UI is
        // presented — not only on OPEN_OAUTH. The native LinkKit view controller
        // lives OUTSIDE the RN tree, so any RN re-render / unmount / AppState churn
        // (incl. the app backgrounding for an OAuth bank) must NOT destroy() the
        // session or clear the DEK while it's up. cleanupSession() and appLock both
        // honor this flag; it's cleared on the terminal result (SECTION 5) and has
        // a 6-minute auto-expiry safety net.
        oauthInProgressRef.current = true;
        setPlaidOAuthInProgress(true);
      } catch (err: any) {
        if (isMounted) {
          Logger.error('PlaidLinkModal', 'Failed to open Plaid UI', {
            error: err instanceof Error ? err.message : String(err),
          });
          setError(err instanceof Error ? err.message : 'Failed to open Plaid');
          setSheetVisible(true); // show error UI again
          setSessionState('destroying');
          // open() threw before presenting — release the in-flight guard so normal
          // cleanup/lock behavior resumes.
          oauthInProgressRef.current = false;
          setPlaidOAuthInProgress(false);
        }
      }
    };

    // Hide our RN <Modal> first, then present Plaid once it has been dismissed.
    // If Plaid is presented while our Modal is on screen, Plaid will dismiss
    // our Modal on exit and leave the app unresponsive (iOS). The short delay
    // lets the Modal finish dismissing so Plaid presents from the root VC.
    setSheetVisible(false);
    openDelayRef = setTimeout(openPlaidUI, 400);

    return () => {
      isMounted = false;
      if (plaidExitTimeoutRef) clearTimeout(plaidExitTimeoutRef);
      if (openDelayRef) clearTimeout(openDelayRef);
    };
  }, [sessionState]);

  // ============================================================================
  // SECTION 5: 处理 Plaid 结果（独立 useEffect）
  // ============================================================================

  useEffect(() => {
    if (!plaidResult || !isMountedRef.current) return;

    const handleResult = async () => {
      // A terminal result means the OAuth roundtrip is over; allow the session to
      // be torn down again from here on.
      oauthInProgressRef.current = false;
      setPlaidOAuthInProgress(false);

      if (plaidResult.type === 'success') {
        try {
          setIsLoading(true);
          Logger.debug('PlaidLinkModal', 'Exchanging public token');

          await confirmPlaidExchange(
            plaidResult.publicToken,
            plaidResult.institution,
          );

          if (isMountedRef.current) {
            Logger.info('PlaidLinkModal', 'Token exchange and data sync complete');
            // 销毁 session
            cleanupSession();
            onSuccess?.();
            onClose();
          }
        } catch (err: any) {
          if (isMountedRef.current) {
            const msg = err instanceof Error ? err.message : 'Failed to exchange token';
            Logger.error('PlaidLinkModal', 'Token exchange failed', { error: msg });
            setError(msg);
            setSheetVisible(true); // bring our sheet back to show the error
            setPlaidResult(null);
          }
        } finally {
          setIsLoading(false);
        }
      } else if (plaidResult.type === 'exit') {
        // 处理用户退出或错误
        if (plaidResult.cancelled) {
          // 用户主动取消
          Logger.info('PlaidLinkModal', 'User cancelled Plaid');
          cleanupSession();
          onClose();
        } else if (plaidResult.error) {
          // 发生错误：记录日志、调用外部 onError、然后直接关闭 Modal
          Logger.warn('PlaidLinkModal', 'Plaid error', { error: plaidResult.error });
          cleanupSession();
          if (onError) {
            onError(plaidResult.error);
          }
          onClose(); // 直接关闭，不再卡在 Try Again/Cancel 画面
        }
      } else if (plaidResult.type === 'timeout') {
        Logger.warn('PlaidLinkModal', 'Plaid operation timeout');
        cleanupSession();
        const timeoutMsg = 'Connection timeout. Please try again.';
        if (onError) {
          onError(timeoutMsg);
        }
        onClose();
      }
    };

    handleResult();
  }, [plaidResult, confirmPlaidExchange, onClose, onSuccess, onError, cleanupSession]);

  // ============================================================================
  // SECTION 6: 清理和重置
  // ============================================================================

  /**
   * Modal 关闭时重置状态
   */
  useEffect(() => {
    if (!isVisible) {
      const resetTimer = setTimeout(() => {
        if (isMountedRef.current) {
          Logger.debug('PlaidLinkModal', 'Modal closed - resetting state');
          cleanupSession();
          setIsLoading(false);
          setError(null);
          setIsInitializing(false);
          setNetworkError(null);
          setSheetVisible(true);
          Logger.info('PlaidLinkModal', 'State reset complete');
        }
      }, 500);

      return () => clearTimeout(resetTimer);
    }
  }, [isVisible, cleanupSession]);

  /**
   * 组件挂载/卸载
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cleanupSession();
    };
  }, [cleanupSession]);

  /**
   * 重试处理
   */
  const handleRetry = async () => {
    setError(null);
    setNetworkError(null);
    setPlaidResult(null);
    setSheetVisible(true);

    try {
      Logger.debug('PlaidLinkModal', 'User clicked retry');
      await requestPlaidLinkToken();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to retry';
      setError(msg);
      Logger.error('PlaidLinkModal', 'Retry failed', { error: msg });
    }
  };

  return (
    <Modal 
      visible={isVisible && sheetVisible} 
      transparent 
      statusBarTranslucent 
      onRequestClose={() => {
        Logger.debug('PlaidLinkModal', 'onRequestClose triggered');
        onClose();
      }}
      onDismiss={() => {
        // NOTE: do not destroy the Plaid session here. This also fires when we
        // intentionally hide the sheet to launch Plaid's native UI. Session
        // cleanup is handled on real close (reset effect) and on unmount.
        Logger.info('PlaidLinkModal', 'Modal dismissed');
        Keyboard.dismiss();
      }}
    >
      <View className="flex-1 justify-center items-center p-4" style={{ backgroundColor: colors.overlay }}>
        <View
          className="border rounded-3xl overflow-hidden w-full"
          style={{ backgroundColor: colors.backgroundElevated, borderColor: colors.border }}
        >
          {/* Header */}
          <View
            className="border-b p-6 flex-row justify-between items-center"
            style={{ borderBottomColor: colors.border }}
          >
            <View>
              <Text className="text-xl font-bold" style={{ color: colors.text }}>Connect Bank Account</Text>
              <Text className="text-sm mt-1" style={{ color: colors.textMuted }}>via Plaid</Text>
            </View>
            {!isLoading && !isInitializing && (
              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 rounded-full justify-center items-center"
                style={{ backgroundColor: colors.surfaceInput }}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          <View className="p-6">
            {isLoading || isInitializing ? (
              <View className="items-center py-8">
                <LoadingDots color={colors.primary} size={10}    />
                <Text className="mt-4 text-center" style={{ color: colors.text }}>
                  {isInitializing ? 'Initializing Plaid Link...' : 'Processing...'}
                </Text>
                <Text className="text-xs mt-2 text-center" style={{ color: colors.textMuted }}>
                  {isInitializing ? 'Setting up secure connection' : 'Please wait'}
                </Text>
              </View>
            ) : networkError || error ? (
              <View>
                <View className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                  <View className="flex-row items-start">
                    <Ionicons name="alert-circle" size={16} color="#FCA5A5" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text className="text-red-300 text-sm flex-1">{networkError || error}</Text>
                  </View>
                </View>
                {!networkError && (
                  <TouchableOpacity
                    onPress={handleRetry}
                    className="rounded-xl py-3 items-center mb-2"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Text className="text-white font-semibold">Try Again</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={onClose}
                  className="border rounded-xl py-3 items-center"
                  style={{ borderColor: colors.border }}
                >
                  <Text className="font-semibold" style={{ color: colors.text }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="items-center py-4">
                <Text className="text-sm text-center" style={{ color: colors.textMuted }}>
                  {sessionState === 'active' ? 'Waiting for Plaid Link to open...' : 'Preparing Plaid...'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
