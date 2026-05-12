/**
 * Gnosis Pay client facade.
 *
 * Switches between the backend-proxied client (./client) and the direct
 * Gnosis Pay API client (./directClient) based on EXPO_PUBLIC_GP_DIRECT_ENABLED.
 *
 * Both implementations expose the same function surface, so consumers (the
 * onboarding hook, card screen) import from here and stay agnostic. Types and
 * the GP_SESSION_EXPIRED sentinel are canonical in ./client and re-exported.
 *
 * Default (flag off) = backend proxy, i.e. existing behaviour is unchanged.
 */

import { GP_DIRECT_ENABLED } from './directConfig';
import * as backend from './client';
import * as direct from './directClient';

const impl = GP_DIRECT_ENABLED ? direct : backend;

export const getGpNonce = impl.getGpNonce;
export const gpAuth = impl.gpAuth;
export const gpSignup = impl.gpSignup;
export const gpAcceptTerms = impl.gpAcceptTerms;
export const getGpKycSdkToken = impl.getGpKycSdkToken;
export const getGpKycUrl = impl.getGpKycUrl;
export const getGpCardStatus = impl.getGpCardStatus;
export const gpSubmitSof = impl.gpSubmitSof;
export const gpSendPhoneOtp = impl.gpSendPhoneOtp;
export const gpVerifyPhoneOtp = impl.gpVerifyPhoneOtp;
export const gpDeploySafe = impl.gpDeploySafe;
export const getGpSafeStatus = impl.getGpSafeStatus;
export const issueGpVirtualCard = impl.issueGpVirtualCard;
export const getGpTransactions = impl.getGpTransactions;
export const freezeGpCard = impl.freezeGpCard;
export const unfreezeGpCard = impl.unfreezeGpCard;

/** Clear the client-held GP session (only meaningful for the direct client). */
export async function clearGpSession(): Promise<void> {
  if (GP_DIRECT_ENABLED) await direct.clearGpSession();
}

export {
  GP_SESSION_EXPIRED_CODE,
  isGpSessionExpired,
  type GpNonceResponse,
  type GpAuthResponse,
  type GpKycTokenResponse,
  type GpOnboardingStatus,
  type GpKycStatus,
  type GpCardStatus,
  type GpSofSource,
  type GpSafeStatusResponse,
  type GpVirtualCard,
  type GpTransaction,
} from './client';
