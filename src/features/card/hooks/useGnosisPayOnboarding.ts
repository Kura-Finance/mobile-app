/**
 * useGnosisPayOnboarding
 *
 * State machine for the full Gnosis Pay onboarding flow.
 * All API calls go to the Kura backend (/api/card/...) which proxies to GP.
 * The backend manages the GP JWT — no token storage on the frontend.
 *
 * Steps:
 *   1. siwe_auth      — GET /api/card/gp/nonce → sign → POST /api/card/gp/auth
 *   2. signup         — POST /api/card/gp/signup (email)
 *   3. terms          — POST /api/card/gp/terms
 *   4. kyc            — GET /api/card/gp/kyc/sdk-token → Sumsub SDK/WebView
 *   5. kyc_review     — poll GET /api/card/status until kycStatus === 'approved'
 *   6. sof            — POST /api/card/gp/sof
 *   7. phone          — POST /api/card/gp/phone/send + /verify
 *   8. safe_deploy    — POST /api/card/gp/safe/deploy
 *   9. safe_polling   — poll GET /api/card/gp/safe/status until ready: true
 *  10. card_issue     — POST /api/card/cards/virtual
 *  11. complete       — card active ✓
 *
 * Session expiry:
 *   If the backend returns 401 GP_SESSION_EXPIRED, we reset to siwe_auth
 *   so the user re-signs without losing other progress (backend retains state).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { createWalletClient, custom } from 'viem';
import { gnosis } from 'viem/chains';
import { useAppStore } from '../../../shared/store/useAppStore';
import Logger from '../../../shared/utils/Logger';
import { selectCanonicalEmbeddedWallet } from '../../../shared/utils/embeddedWallet';
import i18n from '../../../shared/locales/i18n';
import { KuraApiError } from '../../../lib/api/errors';
import {
  getGpNonce,
  gpAuth,
  gpSignup,
  gpAcceptTerms,
  getGpKycUrl,
  gpSubmitSof,
  gpSendPhoneOtp,
  gpVerifyPhoneOtp,
  gpDeploySafe,
  getGpSafeStatus,
  issueGpVirtualCard,
  getGpCardStatus,
  isGpSessionExpired,
  type GpVirtualCard,
  type GpSofSource,
  type GpOnboardingStatus,
} from '../../../lib/api/gp';

const TAG = 'GnosisPayOnboarding';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GpStep =
  | 'loading'       // Checking status from backend
  | 'siwe_auth'     // Need (re)authentication via SIWE
  | 'signup'        // Enter email
  | 'terms'         // Accept ToS
  | 'kyc'           // Start Sumsub KYC
  | 'kyc_review'    // KYC submitted, waiting for approval
  | 'sof'           // Declare source of funds
  | 'phone'         // Phone OTP verification
  | 'safe_deploy'   // Ready to deploy Gnosis Safe
  | 'safe_polling'  // Safe deploying — polling status
  | 'card_issue'    // Safe ready, issue card
  | 'complete'      // All done ✓
  | 'error';        // Unrecoverable error

export interface UseGnosisPayOnboardingReturn {
  step: GpStep;
  errorMessage: string;
  card: GpVirtualCard | null;
  gpSafeAddress: string | null;
  safeCurrency: string | null;
  /** Full Sumsub URL to load in the KYC WebView. */
  kycUrl: string | null;
  isLoading: boolean;
  status: GpOnboardingStatus | null;

  doSiweAuth: () => Promise<void>;
  doSignup: (email: string) => Promise<void>;
  doAcceptTerms: () => Promise<void>;
  doStartKyc: () => Promise<void>;
  doCheckKycStatus: () => Promise<void>;
  doSubmitSof: (source: GpSofSource) => Promise<void>;
  doSendPhoneOtp: (phone: string) => Promise<void>;
  doVerifyPhoneOtp: (code: string) => Promise<void>;
  doDeploySafe: () => Promise<void>;
  doIssueCard: () => Promise<void>;
  refresh: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step resolution from /api/card/status
// ─────────────────────────────────────────────────────────────────────────────

function resolveStepFromStatus(s: GpOnboardingStatus): GpStep {
  if (!s.gpAuthenticated) return 'siwe_auth';
  if (!s.email) return 'signup';
  if (!s.termsAccepted) return 'terms';
  if (s.kycStatus === 'not_started') return 'kyc';
  if (s.kycStatus === 'pending') return 'kyc_review';
  if (s.kycStatus === 'rejected') return 'error';
  // kycStatus === 'approved' from here
  if (!s.sofSubmitted) return 'sof';
  if (!s.phoneVerified) return 'phone';
  if (!s.safeAddress) return 'safe_deploy';
  if (!s.safeReady) return 'safe_polling';
  if (!s.hasCard) return 'card_issue';
  return 'complete';
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useGnosisPayOnboarding(): UseGnosisPayOnboardingReturn {
  const [step, setStep] = useState<GpStep>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [card, setCard] = useState<GpVirtualCard | null>(null);
  const [gpSafeAddress, setGpSafeAddress] = useState<string | null>(null);
  const [safeCurrency, setSafeCurrency] = useState<string | null>(null);
  const [kycUrl, setKycUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<GpOnboardingStatus | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userEmail = useAppStore((s) => s.userProfile.email);
  const authToken = useAppStore((s) => s.authToken);
  const { wallets } = useEmbeddedEthereumWallet();
  // Always use the same canonical EOA the rest of the app derives the Safe SCA
  // from — never just wallets[0], whose ordering is not stable.
  const embeddedWallet = selectCanonicalEmbeddedWallet(wallets) ?? undefined;

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function withLoading<T>(fn: () => Promise<T>): Promise<T> {
    setIsLoading(true);
    setErrorMessage('');
    try {
      return await fn();
    } finally {
      setIsLoading(false);
    }
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  /**
   * If the backend signals GP session expired, reset to siwe_auth
   * (the user's other onboarding progress is still stored on the backend).
   */
  function handleError(context: string, err: unknown): void {
    if (isGpSessionExpired(err)) {
      Logger.warn(TAG, `${context}: GP session expired → siwe_auth`);
      setStep('siwe_auth');
      setErrorMessage('');
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    Logger.error(TAG, context, { error: msg });
    setErrorMessage(msg);
    setStep('error');
  }

  // ── Status resolution ────────────────────────────────────────────────────

  const resolveStep = useCallback(async () => {
    setStep('loading');
    setErrorMessage('');
    try {
      const s = await getGpCardStatus();
      setStatus(s);

      if (s.card) setCard(s.card);
      if (s.safeAddress) setGpSafeAddress(s.safeAddress);

      const resolved = resolveStepFromStatus(s);
      Logger.info(TAG, 'Step resolved', { resolved, kycStatus: s.kycStatus });

      if (resolved === 'error') {
        setErrorMessage(i18n.t('card.kycRejectedContactSupport'));
      }
      if (resolved === 'safe_polling') {
        setStep(resolved);
        startSafePolling();
        return;
      }
      setStep(resolved);
    } catch (err) {
      if (isGpSessionExpired(err)) {
        setStep('siwe_auth');
        return;
      }
      // If /api/card/status returns 404 it means no GP record at all
      if (err instanceof KuraApiError && err.status === 404) {
        setStep('siwe_auth');
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      Logger.error(TAG, 'resolveStep failed', { error: msg });
      setErrorMessage(msg);
      setStep('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Safe polling loop ─────────────────────────────────────────────────────

  function startSafePolling() {
    stopPolling();
    Logger.info(TAG, 'Safe polling started');

    pollingRef.current = setInterval(async () => {
      try {
        const s = await getGpSafeStatus();
        Logger.debug(TAG, 'Safe poll', s);
        if (s.safeAddress) setGpSafeAddress(s.safeAddress);
        if (s.currency) setSafeCurrency(s.currency);
        if (s.ready) {
          stopPolling();
          setStep('card_issue');
        }
      } catch (err) {
        if (isGpSessionExpired(err)) {
          stopPolling();
          setStep('siwe_auth');
        } else {
          Logger.warn(TAG, 'Safe poll error', { error: String(err) });
        }
      }
    }, 5_000);
  }

  // ── Init — wait for Kura JWT before calling /api/card/status ────────────
  // resolveStep fires immediately on mount, but the Kura JWT may not be ready
  // yet (PrivyBridgeProvider takes 2-4s to exchange the token).
  // Gating on authToken prevents "Authorization token not provided" errors.

  useEffect(() => {
    if (!authToken) {
      // JWT not ready yet — stay in loading state
      Logger.debug(TAG, 'Waiting for Kura JWT before resolveStep');
      return;
    }
    void resolveStep();
    return () => stopPolling();
  }, [authToken, resolveStep]);

  // ─────────────────────────────────────────────────────────────────────────
  // Step actions
  // ─────────────────────────────────────────────────────────────────────────

  const doSiweAuth = useCallback(async () => {
    await withLoading(async () => {
      if (!embeddedWallet) throw new Error('Privy embedded wallet not available');

      const provider = await embeddedWallet.getProvider();
      const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      if (!address) throw new Error('No wallet address available');

      Logger.info(TAG, 'SIWE auth', { address });

      // Backend returns a pre-formatted EIP-4361 SIWE message — sign as-is
      const nonceRes = await getGpNonce(address);
      Logger.debug(TAG, 'Nonce response', {
        keys: Object.keys(nonceRes ?? {}),
        nonce: nonceRes?.nonce?.slice(0, 20),
        messageStart: nonceRes?.message?.slice(0, 60),
      });

      const message = nonceRes.message;
      if (!message) {
        throw new Error('Backend did not return a SIWE message. Check /api/card/gp/nonce response.');
      }

      // Guard: detect if backend accidentally returned hex nonce instead of EIP-4361 text
      const looksLikeEip4361 = message.includes('wants you to sign in') || message.includes('Nonce:');
      if (!looksLikeEip4361) {
        Logger.warn(TAG, 'SIWE message does not look like EIP-4361 text', {
          messageStart: message.slice(0, 80),
          length: message.length,
        });
        throw new Error(
          `Backend returned unexpected SIWE message format (got: "${message.slice(0, 40)}..."). Ensure /api/card/gp/nonce returns the full EIP-4361 message.`,
        );
      }

      Logger.debug(TAG, 'SIWE message received ✓', { preview: message.slice(0, 80) });

      // Must use Gnosis Chain (100) — GP validates chain ID in the SIWE message
      const walletClient = createWalletClient({ chain: gnosis, transport: custom(provider) });
      const signature = await walletClient.signMessage({
        account: address as `0x${string}`,
        message,
      });
      Logger.debug(TAG, 'SIWE signature', { sigPrefix: signature.slice(0, 20) });

      await gpAuth({ message, signature });
      Logger.info(TAG, 'GP auth complete ✓');

      // Re-resolve to pick up the next step
      await resolveStep();
    }).catch((err) => handleError('doSiweAuth', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embeddedWallet, resolveStep]);

  const doSignup = useCallback(async (email: string) => {
    await withLoading(async () => {
      await gpSignup(email);
      setStep('terms');
    }).catch((err) => {
      if (err instanceof KuraApiError && err.status === 409) {
        setStep('terms');
        return;
      }
      handleError('doSignup', err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doAcceptTerms = useCallback(async () => {
    await withLoading(async () => {
      await gpAcceptTerms();
      setStep('kyc');
    }).catch((err) => {
      if (err instanceof KuraApiError && err.status === 409) {
        setStep('kyc');
        return;
      }
      handleError('doAcceptTerms', err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doStartKyc = useCallback(async () => {
    await withLoading(async () => {
      const { url } = await getGpKycUrl();
      setKycUrl(url);
      // GnosisPayOnboardingScreen will open the Sumsub WebView once kycUrl is set
    }).catch((err) => handleError('doStartKyc', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doCheckKycStatus = useCallback(async () => {
    await withLoading(async () => {
      const s = await getGpCardStatus();
      setStatus(s);
      Logger.info(TAG, 'KYC status', { kycStatus: s.kycStatus });
      if (s.kycStatus === 'approved') {
        setStep('sof');
      } else if (s.kycStatus === 'rejected') {
        setErrorMessage(i18n.t('card.kycVerificationRejected'));
        setStep('error');
      } else {
        setStep('kyc_review');
      }
    }).catch((err) => handleError('doCheckKycStatus', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSubmitSof = useCallback(async (source: GpSofSource) => {
    await withLoading(async () => {
      await gpSubmitSof(source);
      setStep('phone');
    }).catch((err) => {
      if (err instanceof KuraApiError && err.status === 409) {
        setStep('phone');
        return;
      }
      handleError('doSubmitSof', err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSendPhoneOtp = useCallback(async (phone: string) => {
    await withLoading(async () => {
      await gpSendPhoneOtp(phone);
      // Screen handles sub-step transition to OTP input internally
    }).catch((err) => handleError('doSendPhoneOtp', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doVerifyPhoneOtp = useCallback(async (code: string) => {
    await withLoading(async () => {
      await gpVerifyPhoneOtp(code);
      setStep('safe_deploy');
    }).catch((err) => handleError('doVerifyPhoneOtp', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doDeploySafe = useCallback(async () => {
    await withLoading(async () => {
      await gpDeploySafe();
      setStep('safe_polling');
      startSafePolling();
    }).catch((err) => {
      if (err instanceof KuraApiError && err.status === 409) {
        // Already initiated — just start polling
        setStep('safe_polling');
        startSafePolling();
        return;
      }
      handleError('doDeploySafe', err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doIssueCard = useCallback(async () => {
    await withLoading(async () => {
      const issued = await issueGpVirtualCard();
      setCard(issued);
      setStep('complete');
    }).catch((err) => {
      if (err instanceof KuraApiError && err.status === 409) {
        // Card already exists — refresh to get it
        void resolveStep();
        return;
      }
      handleError('doIssueCard', err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveStep]);

  const refresh = useCallback(() => resolveStep(), [resolveStep]);

  return {
    step,
    errorMessage,
    card,
    gpSafeAddress,
    safeCurrency,
    kycUrl,
    isLoading,
    status,
    doSiweAuth,
    doSignup,
    doAcceptTerms,
    doStartKyc,
    doCheckKycStatus,
    doSubmitSof,
    doSendPhoneOtp,
    doVerifyPhoneOtp,
    doDeploySafe,
    doIssueCard,
    refresh,
  };
}
