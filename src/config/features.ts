/**
 * Feature flags for the mobile client.
 *
 * Core wallet + WalletConnect work without a hosted backend.
 * TrackFi, Plaid, DeBank, and Dinari require EXPO_PUBLIC_API_BASE_URL.
 *
 * Morpho Earn uses Morpho's public API (no app backend) but needs Pimlico
 * for on-chain deposits — see src/config/earn.ts.
 */

import { isMorphoEarnEnabled } from './earn';
import { hasAppBackend, hasValidWalletConnectProjectId } from './env';

export const features = {
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

  /** Li.Fi bridge / swap integrator fee (optional). */
  lifiSwap: true,

  /**
   * Morpho vault earn on Base (public GraphQL + smart-account deposits).
   * Disable with EXPO_PUBLIC_MORPHO_EARN_ENABLED=false.
   */
  morphoEarn: isMorphoEarnEnabled(),
} as const;

export type AppFeatures = typeof features;
