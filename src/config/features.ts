/**
 * Feature flags for the mobile client.
 *
 * The switch is EXPO_PUBLIC_API_BASE_URL:
 *   - empty (default) → on-chain only. Login, wallet, swap/bridge, WalletConnect
 *     and Morpho talk to Privy, the chain and public APIs directly.
 *   - set → the self-hosted app backend is used and every `backend`-derived
 *     flag below turns on (TrackFi, fiat ramp, card, stocks, referrals, …).
 *
 * Gate UI on these flags instead of calling `hasAppBackend()` in feature code.
 *
 * Morpho Earn uses Morpho's public API (no app backend). On-chain deposits use
 * the SCA bundler (public + ETH, or Pimlico + USDC) — see src/config/earn.ts.
 */

import { isMorphoEarnEnabled } from './earn';
import { env, hasAppBackend, hasValidWalletConnectProjectId } from './env';

export const features = {
  /** App backend configured — session, profile and partner features go through it. */
  backend: hasAppBackend(),

  /** Base smart account: send, receive, swap (with third-party keys). */
  wallet: true,

  /** Reown WalletConnect wallet mode (requires project id). */
  walletConnect: hasValidWalletConnectProjectId(),

  /** TrackFi hub: Plaid banking, brokers, DeBank DeFi portfolio. */
  trackFi: hasAppBackend(),

  /** Plaid-linked accounts and transactions. */
  plaid: hasAppBackend(),

  /** DeBank proxy (/api/debank/*). */
  debank: hasAppBackend(),

  /** Dinari dShares in Invest → US Stock tab (on when backend URL is set). */
  dinariStocks: hasAppBackend(),

  /** Bridge.xyz fiat on/off-ramp and USDT (Tron) deposits (/api/bridge/*). */
  fiatRamp: hasAppBackend(),

  /** Card entry on Home + card waitlist (/api/waitlist/*). */
  card: hasAppBackend(),

  /** Referral codes and cashback (/api/auth/me/referral-code, cashback). */
  referrals: hasAppBackend(),

  /** Settings → Connected accounts (Plaid banks, exchanges, tracked wallets). */
  connectedAccounts: hasAppBackend(),

  /**
   * Settings → Delete account. With a backend it is deleted in-app
   * (DELETE /api/auth/me also removes the Privy user). Without one the row
   * opens EXPO_PUBLIC_ACCOUNT_DELETION_URL and is hidden when that is unset.
   */
  accountDeletion: hasAppBackend() || env.accountDeletionUrl.length > 0,

  /** Li.Fi bridge / swap (public API; optional API key). */
  lifiSwap: true,

  /** Morpho vault earn on Base (public GraphQL + smart-account deposits).*/
  morphoEarn: isMorphoEarnEnabled(),
} as const;

export type AppFeatures = typeof features;
