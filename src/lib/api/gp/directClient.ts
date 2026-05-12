/**
 * Gnosis Pay API client — DIRECT (no backend proxy)
 *
 * Talks straight to https://api.gnosispay.com/api/v1/* using Gnosis Pay's
 * "Permissionless" integration model: the user authenticates with SIWE
 * (Sign-In with Ethereum) using their Privy embedded wallet and receives a JWT.
 * No partner API key is required.
 *
 * This module mirrors the function surface of ./client.ts (the backend-proxied
 * client) so it can be swapped in via ./index.ts behind the
 * EXPO_PUBLIC_GP_DIRECT_ENABLED flag, with NO changes to the onboarding hook.
 *
 * Key differences vs the backend client, hidden behind the shared surface:
 *   - The GP JWT is held on the client (in-memory + SecureStore), not the
 *     backend. On a 401 we surface KuraApiError(code: GP_SESSION_EXPIRED) so the
 *     existing hook re-runs SIWE.
 *   - `getGpNonce` builds the full EIP-4361 SIWE message locally (GP's /nonce
 *     returns only a raw nonce string), so the hook can keep signing `message`.
 *   - `getGpCardStatus` aggregates GET /api/v1/user (+ /user/terms + /safe/deploy)
 *     into the backend-shaped GpOnboardingStatus.
 *
 * Docs: https://docs.gnosispay.com  (auth, onboarding-flow, api-reference)
 */

import * as SecureStore from 'expo-secure-store';
import { getAddress } from 'viem';
import { KuraApiError, KuraNetworkError } from '../errors';
import Logger from '../../../shared/utils/Logger';
import {
  GP_API_BASE_URL,
  GP_CHAIN_ID,
  GP_JWT_STORE_KEY,
  GP_JWT_TTL_SECONDS,
  GP_PARTNER_ID,
  GP_SIWE_DOMAIN,
  GP_SIWE_STATEMENT,
  GP_SIWE_URI,
} from './directConfig';
import {
  GP_SESSION_EXPIRED_CODE,
  isGpSessionExpired,
  type GpNonceResponse,
  type GpAuthResponse,
  type GpKycTokenResponse,
  type GpOnboardingStatus,
  type GpKycStatus,
  type GpSofSource,
  type GpSafeStatusResponse,
  type GpVirtualCard,
  type GpTransaction,
  type GpCardStatus,
} from './client';

export {
  GP_SESSION_EXPIRED_CODE,
  isGpSessionExpired,
  type GpNonceResponse,
  type GpAuthResponse,
  type GpKycTokenResponse,
  type GpOnboardingStatus,
  type GpKycStatus,
  type GpSofSource,
  type GpSafeStatusResponse,
  type GpVirtualCard,
  type GpTransaction,
  type GpCardStatus,
};

const TAG = 'GnosisPayDirect';

// ─────────────────────────────────────────────────────────────────────────────
// JWT session management (in-memory + SecureStore)
// ─────────────────────────────────────────────────────────────────────────────

let cachedJwt: string | null = null;
let cachedJwtLoaded = false;

async function getStoredJwt(): Promise<string | null> {
  if (cachedJwt) return cachedJwt;
  if (cachedJwtLoaded) return cachedJwt;
  cachedJwtLoaded = true;
  try {
    cachedJwt = await SecureStore.getItemAsync(GP_JWT_STORE_KEY);
  } catch (err) {
    Logger.warn(TAG, 'Failed to read GP JWT from SecureStore', { err: String(err) });
    cachedJwt = null;
  }
  return cachedJwt;
}

async function setStoredJwt(token: string): Promise<void> {
  cachedJwt = token;
  cachedJwtLoaded = true;
  try {
    await SecureStore.setItemAsync(GP_JWT_STORE_KEY, token);
  } catch (err) {
    Logger.warn(TAG, 'Failed to persist GP JWT', { err: String(err) });
  }
}

/** Clear the persisted Gnosis Pay session. Call on logout / session reset. */
export async function clearGpSession(): Promise<void> {
  cachedJwt = null;
  cachedJwtLoaded = true;
  try {
    await SecureStore.deleteItemAsync(GP_JWT_STORE_KEY);
  } catch {
    // best-effort
  }
}

interface JwtPayload {
  exp?: number;
  userId?: string;
}

/** Decode a JWT payload without verifying the signature (RN-safe base64url). */
function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    let json: string;
    if (typeof globalThis.atob === 'function') {
      json = decodeURIComponent(
        Array.prototype.map
          .call(globalThis.atob(padded), (c: string) =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2),
          )
          .join(''),
      );
    } else if (typeof (globalThis as any).Buffer !== 'undefined') {
      json = (globalThis as any).Buffer.from(padded, 'base64').toString('utf8');
    } else {
      return null;
    }
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Whether the token is present, unexpired, and (optionally) carries a userId. */
function inspectToken(token: string | null): { valid: boolean; registered: boolean } {
  if (!token) return { valid: false, registered: false };
  const payload = decodeJwtPayload(token);
  if (!payload) {
    // Can't decode — assume valid and let the API be the source of truth.
    return { valid: true, registered: false };
  }
  if (payload.exp && payload.exp * 1000 <= Date.now()) {
    return { valid: false, registered: false };
  }
  return { valid: true, registered: Boolean(payload.userId) };
}

function sessionExpired(message = 'Gnosis Pay session expired'): KuraApiError {
  return new KuraApiError({ code: GP_SESSION_EXPIRED_CODE, message, status: 401 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-level request wrapper
// ─────────────────────────────────────────────────────────────────────────────

interface GpRequestOptions extends Omit<RequestInit, 'headers'> {
  /** Skip attaching the GP JWT (only the SIWE nonce/challenge endpoints). */
  skipAuth?: boolean;
  /** Parse the response body as plain text instead of JSON. */
  asText?: boolean;
}

async function gpRequest<T>(path: string, options: GpRequestOptions = {}): Promise<T> {
  const { skipAuth, asText, ...init } = options;
  const url = `${GP_API_BASE_URL}${path}`;
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const token = await getStoredJwt();
    if (!token) throw sessionExpired('No Gnosis Pay session');
    const { valid } = inspectToken(token);
    if (!valid) {
      await clearGpSession();
      throw sessionExpired();
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(TAG, 'Network error', { url, message });
    throw new KuraNetworkError(message);
  }

  const raw = await response.text();

  if (response.status === 401) {
    await clearGpSession();
    Logger.warn(TAG, 'GP 401 — session expired', { url });
    throw sessionExpired();
  }

  if (!response.ok) {
    let message = `Gnosis Pay request failed (${response.status})`;
    try {
      const parsed = raw ? (JSON.parse(raw) as { error?: string; message?: string }) : null;
      message = parsed?.error || parsed?.message || message;
    } catch {
      if (raw) message = raw.slice(0, 200);
    }
    Logger.warn(TAG, 'GP error response', { url, status: response.status, message });
    throw new KuraApiError({ code: 'GP_API_ERROR', message, status: response.status });
  }

  if (asText) return raw as unknown as T;
  if (!raw) return undefined as unknown as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIWE message builder (EIP-4361)
// ─────────────────────────────────────────────────────────────────────────────

function buildSiweMessage(address: string, nonce: string): string {
  const checksummed = getAddress(address);
  const issuedAt = new Date().toISOString();
  // EIP-4361 canonical layout (matches the `siwe` lib's toMessage() output).
  return [
    `${GP_SIWE_DOMAIN} wants you to sign in with your Ethereum account:`,
    checksummed,
    '',
    GP_SIWE_STATEMENT,
    '',
    `URI: ${GP_SIWE_URI}`,
    'Version: 1',
    `Chain ID: ${GP_CHAIN_ID}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}

function addressFromSiweMessage(message: string): string {
  const line = message.split('\n')[1]?.trim() ?? '';
  return line;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — SIWE auth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auth/nonce (returns a raw nonce string), then builds the full
 * EIP-4361 message locally so the hook can sign `message` exactly as before.
 */
export async function getGpNonce(address: string): Promise<GpNonceResponse> {
  Logger.debug(TAG, 'getGpNonce', { address });
  const nonce = (await gpRequest<string>('/api/v1/auth/nonce', {
    method: 'GET',
    skipAuth: true,
    asText: true,
  })).trim();
  const message = buildSiweMessage(address, nonce);
  return { nonce, message };
}

/**
 * POST /api/v1/auth/challenge — verifies the signature and returns a JWT,
 * which we persist for all subsequent GP calls.
 */
export async function gpAuth(body: { message: string; signature: string }): Promise<GpAuthResponse> {
  Logger.debug(TAG, 'gpAuth', { messagePrefix: body.message.slice(0, 40) });
  const res = await gpRequest<{ token: string }>('/api/v1/auth/challenge', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      message: body.message,
      signature: body.signature,
      ttlInSeconds: GP_JWT_TTL_SECONDS,
    }),
  });
  if (!res?.token) throw new KuraApiError({ code: 'GP_API_ERROR', message: 'No token from GP challenge', status: 502 });
  await setStoredJwt(res.token);
  return { address: addressFromSiweMessage(body.message) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Signup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/signup — registers the user's email. GP returns a fresh JWT
 * that now carries the userId, which we store in place of the pre-signup token.
 */
export async function gpSignup(email: string): Promise<void> {
  const body: Record<string, string> = { authEmail: email };
  if (GP_PARTNER_ID) body.partnerId = GP_PARTNER_ID;
  // TODO(gnosispay-setup): partnerId is required for production attribution.
  const res = await gpRequest<{ id?: string; token?: string; hasSignedUp?: boolean }>(
    '/api/v1/auth/signup',
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (res?.token) await setStoredJwt(res.token);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Terms
// ─────────────────────────────────────────────────────────────────────────────

interface GpTermItem {
  type: string;
  currentVersion: string;
  accepted: boolean;
}

async function getGpTerms(): Promise<GpTermItem[]> {
  const res = await gpRequest<{ terms?: GpTermItem[] }>('/api/v1/user/terms', { method: 'GET' });
  return res?.terms ?? [];
}

/**
 * Accept every not-yet-accepted Terms doc at its current version. The backend
 * client exposes a single gpAcceptTerms(); GP requires one POST per term type.
 */
export async function gpAcceptTerms(): Promise<void> {
  const terms = await getGpTerms();
  const pending = terms.filter((t) => !t.accepted);
  for (const term of pending) {
    await gpRequest<unknown>('/api/v1/user/terms', {
      method: 'POST',
      body: JSON.stringify({ terms: term.type, version: term.currentVersion }),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — KYC (Sumsub SDK token)
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/v1/kyc/integration/sdk → Sumsub SDK access token (native Mobile SDK). */
export async function getGpKycSdkToken(): Promise<GpKycTokenResponse> {
  const res = await gpRequest<{ token: string; type?: string; userId?: string }>(
    '/api/v1/kyc/integration/sdk',
    { method: 'GET' },
  );
  return { token: res.token };
}

/**
 * GET /api/v1/kyc/integration → ready-to-open Sumsub WEB url for the WebView.
 *
 * This is the correct source for an in-app WebView. The /sdk access token above
 * is only valid with Sumsub's native Mobile SDK; embedding it in an
 * `idensic/l/#/<token>` link makes the WebSDK fail with "Unknown url".
 */
export async function getGpKycUrl(): Promise<{ url: string }> {
  const res = await gpRequest<{ url: string; type?: string }>('/api/v1/kyc/integration', {
    method: 'GET',
  });
  if (!res?.url) {
    throw new KuraApiError({ code: 'GP_API_ERROR', message: 'No KYC url from Gnosis Pay', status: 502 });
  }
  return { url: res.url };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — Source of Funds
// ─────────────────────────────────────────────────────────────────────────────

interface GpSofQuestion {
  // GP returns questions with an id/label and a set of allowed answers; shape
  // varies, so we read defensively.
  question?: string;
  id?: string;
  label?: string;
  answers?: Array<string | { value?: string; label?: string }>;
  options?: Array<string | { value?: string; label?: string }>;
}

/**
 * GP's source-of-funds is a multi-question questionnaire, while the existing UI
 * collects a single GpSofSource value. We fetch the questions and answer the
 * one that looks like the "source of funds" question with the provided value.
 *
 * TODO(gnosispay-ux): The GP questionnaire may contain multiple questions. To
 * fully satisfy it, surface GET /api/v1/source-of-funds in the UI and submit
 * all answers. This best-effort mapping covers the single-source case only.
 */
export async function gpSubmitSof(sourceOfFunds: GpSofSource): Promise<void> {
  const questions = await gpRequest<GpSofQuestion[]>('/api/v1/source-of-funds', { method: 'GET' });
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new KuraApiError({
      code: 'GP_API_ERROR',
      message: 'Gnosis Pay returned no source-of-funds questions',
      status: 502,
    });
  }
  const answers = questions.map((q) => ({
    question: q.question ?? q.id ?? q.label ?? '',
    answer: sourceOfFunds,
  }));
  Logger.warn(TAG, 'Submitting SoF with single-value mapping (see TODO)', {
    questionCount: questions.length,
  });
  await gpRequest<unknown>('/api/v1/source-of-funds', {
    method: 'POST',
    body: JSON.stringify(answers),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6 — Phone verification
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/v1/verification { phoneNumber } */
export async function gpSendPhoneOtp(phone: string): Promise<void> {
  await gpRequest<unknown>('/api/v1/verification', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber: phone }),
  });
}

/** POST /api/v1/verification/check { code } */
export async function gpVerifyPhoneOtp(code: string): Promise<void> {
  await gpRequest<unknown>('/api/v1/verification/check', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 7 — Gnosis Safe deployment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/safe/deploy — GP deploys + configures the Safe server-side
 * (gasless, no user signature). Idempotent: returns 202 while in flight.
 */
export async function gpDeploySafe(): Promise<void> {
  await gpRequest<unknown>('/api/v1/safe/deploy', { method: 'POST' });
}

type GpDeployStatus = 'ok' | 'not_deployed' | 'processing' | 'failed';

/** GET /api/v1/safe/deploy — deployment status; combined with user safe wallet. */
export async function getGpSafeStatus(): Promise<GpSafeStatusResponse> {
  const [deploy, user] = await Promise.all([
    gpRequest<{ status?: GpDeployStatus }>('/api/v1/safe/deploy', { method: 'GET' }),
    getGpUser().catch(() => null),
  ]);
  const safe = pickSafeWallet(user);
  const ready = deploy?.status === 'ok';
  return {
    safeAddress: safe?.address,
    accountStatus: ready ? 0 : 1,
    currency: safe?.tokenSymbol ?? '',
    ready,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 8 — Virtual card issuance
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/v1/cards/virtual → { cardId }; we then resolve its details. */
export async function issueGpVirtualCard(): Promise<GpVirtualCard> {
  const res = await gpRequest<{ cardId: string }>('/api/v1/cards/virtual', { method: 'POST' });
  const cards = await listGpCards().catch(() => []);
  const found = cards.find((c) => c.id === res.cardId);
  if (found) return found;
  return { id: res.cardId, last4: '', status: 'active', isVirtual: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Status aggregation — GET /api/v1/user (+ terms) → GpOnboardingStatus
// ─────────────────────────────────────────────────────────────────────────────

interface GpSafeWallet {
  address: string;
  chainId?: string;
  tokenSymbol?: string;
}

interface GpCardRaw {
  id: string;
  lastFourDigits?: string;
  virtual?: boolean;
  statusCode?: number;
  statusName?: string;
}

interface GpUser {
  email?: string | null;
  kycStatus?: string;
  isSourceOfFundsAnswered?: boolean;
  isPhoneValidated?: boolean;
  safeWallets?: GpSafeWallet[];
  safeWallet?: GpSafeWallet[];
  cards?: GpCardRaw[];
}

async function getGpUser(): Promise<GpUser> {
  return gpRequest<GpUser>('/api/v1/user', { method: 'GET' });
}

function pickSafeWallet(user: GpUser | null): GpSafeWallet | undefined {
  const list = user?.safeWallets ?? user?.safeWallet ?? [];
  return Array.isArray(list) && list.length > 0 ? list[0] : undefined;
}

function mapKycStatus(gp: string | undefined): GpKycStatus {
  switch (gp) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'notStarted':
    case undefined:
      return 'not_started';
    default:
      // documentsRequested | pending | processing | resubmissionRequested | requiresAction
      return 'pending';
  }
}

function mapCardStatus(statusCode: number | undefined): GpCardStatus {
  switch (statusCode) {
    case 1000:
      return 'active';
    case 1009:
    case 1199:
      return 'cancelled';
    case 1062:
      return 'frozen';
    default:
      return statusCode == null ? null : 'active';
  }
}

async function listGpCards(): Promise<GpVirtualCard[]> {
  const res = await gpRequest<GpCardRaw[]>('/api/v1/cards', { method: 'GET' });
  if (!Array.isArray(res)) return [];
  return res.map((c) => ({
    id: c.id,
    last4: c.lastFourDigits ?? '',
    status: mapCardStatus(c.statusCode),
    isVirtual: Boolean(c.virtual),
  }));
}

/**
 * GET /api/v1/user (+ /user/terms + /safe/deploy) aggregated into the
 * backend-shaped GpOnboardingStatus the hook expects.
 */
export async function getGpCardStatus(): Promise<GpOnboardingStatus> {
  const token = await getStoredJwt();
  const { valid, registered } = inspectToken(token);

  // No / expired token → behave like the backend's GP_SESSION_EXPIRED (→ SIWE).
  if (!valid) {
    await clearGpSession();
    throw sessionExpired();
  }

  // Authenticated via SIWE but not yet registered (no userId in JWT) → signup.
  if (!registered) {
    return {
      gpAuthenticated: true,
      email: undefined,
      termsAccepted: false,
      kycStatus: 'not_started',
      sofSubmitted: false,
      phoneVerified: false,
      safeAddress: undefined,
      safeReady: false,
      hasCard: false,
    };
  }

  const user = await getGpUser();
  const kycStatus = mapKycStatus(user.kycStatus);
  const safe = pickSafeWallet(user);

  // Terms + safe-deploy status only matter once the relevant fields are present.
  const termsAccepted = await areAllTermsAccepted();

  let safeReady = false;
  if (safe?.address) {
    const deploy = await gpRequest<{ status?: GpDeployStatus }>('/api/v1/safe/deploy', {
      method: 'GET',
    }).catch(() => null);
    safeReady = deploy?.status === 'ok';
  }

  const activeCards = (user.cards ?? []).filter((c) => c.statusCode !== 1009 && c.statusCode !== 1199);
  const firstCard = activeCards[0];

  return {
    gpAuthenticated: true,
    email: user.email ?? undefined,
    termsAccepted,
    kycStatus,
    sofSubmitted: Boolean(user.isSourceOfFundsAnswered),
    phoneVerified: Boolean(user.isPhoneValidated),
    safeAddress: safe?.address,
    safeReady,
    hasCard: activeCards.length > 0,
    card: firstCard
      ? {
          id: firstCard.id,
          last4: firstCard.lastFourDigits ?? '',
          status: mapCardStatus(firstCard.statusCode),
          isVirtual: Boolean(firstCard.virtual),
        }
      : undefined,
  };
}

async function areAllTermsAccepted(): Promise<boolean> {
  try {
    const terms = await getGpTerms();
    if (terms.length === 0) return false;
    return terms.every((t) => t.accepted);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-onboarding — transactions & card actions
// ─────────────────────────────────────────────────────────────────────────────

export async function getGpTransactions(): Promise<GpTransaction[]> {
  const res = await gpRequest<{ results?: unknown[] } | unknown[]>('/api/v1/cards/transactions', {
    method: 'GET',
  });
  const list = Array.isArray(res) ? res : (res as { results?: unknown[] })?.results ?? [];
  return (list as Array<Record<string, unknown>>).map((t) => ({
    id: String(t.id ?? t.transactionId ?? ''),
    amount: Number(t.amount ?? t.billingAmount ?? 0),
    currency: String(t.currency ?? t.billingCurrency ?? ''),
    merchant: t.merchant ? String((t.merchant as any).name ?? t.merchant) : undefined,
    status: String(t.status ?? ''),
    createdAt: String(t.createdAt ?? t.clearedAt ?? ''),
  }));
}

export async function freezeGpCard(cardId: string): Promise<void> {
  await gpRequest<unknown>(`/api/v1/cards/${cardId}/freeze`, { method: 'POST' });
}

export async function unfreezeGpCard(cardId: string): Promise<void> {
  await gpRequest<unknown>(`/api/v1/cards/${cardId}/unfreeze`, { method: 'POST' });
}
