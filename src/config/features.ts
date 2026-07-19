/**
 * Feature flags for the open-source client.
 *
 * Core wallet + WalletConnect work without the proprietary Kura backend.
 * TrackFi, Plaid, DeBank, and Dinari require EXPO_PUBLIC_API_BASE_URL
 * (official or self-hosted).
 *
 * Morpho Earn uses Morpho's public API (no Kura backend) but needs Pimlico
 * for on-chain deposits — see src/config/earn.ts.
 */

import { isMorphoEarnEnabled } from './earn';
import { env, hasKuraBackend, hasValidWalletConnectProjectId } from './env';

export const features = {
  /** Base smart account: send, receive, swap (with third-party keys). */
  wallet: true,

  /** Reown WalletConnect wallet mode (requires project id). */
  walletConnect: hasValidWalletConnectProjectId(),

  /** TrackFi hub: Plaid banking, brokers, DeBank DeFi portfolio. */
  trackFi: hasKuraBackend(),

  /** Plaid-linked accounts and transactions. */
  plaid: hasKuraBackend(),

  /** DeBank proxy (/api/debank/*). */
  debank: hasKuraBackend(),

  /** Dinari dShares in Invest → US Stock tab. */
  dinariStocks: hasKuraBackend(),

  /** Li.Fi bridge / swap integrator fee (optional). */
  lifiSwap: true,

  /**
   * Morpho vault earn on Base (public GraphQL + smart-account deposits).
   * Disable with EXPO_PUBLIC_MORPHO_EARN_ENABLED=false.
   */
  morphoEarn: isMorphoEarnEnabled(),
} as const;

export type AppFeatures = typeof features;
