/**
 * Feature flags for the open-source client.
 *
 * Core wallet + WalletConnect work without the proprietary Kura backend.
 * TrackFi, Plaid, DeBank, Dinari, and backend-proxied Gnosis Pay require
 * EXPO_PUBLIC_API_BASE_URL (official or self-hosted).
 *
 * Morpho Earn uses Morpho's public API (no Kura backend) but needs Pimlico
 * for on-chain deposits — see src/config/earn.ts.
 */

import { isMorphoEarnEnabled } from './earn';
import { env, hasKuraBackend } from './env';

export const features = {
  /** Base smart account: send, receive, swap (with third-party keys). */
  wallet: true,

  /** Reown WalletConnect wallet mode (requires project id). */
  walletConnect: env.walletConnectProjectId.length > 0,

  /** TrackFi hub: Plaid banking, brokers, DeBank DeFi portfolio. */
  trackFi: hasKuraBackend(),

  /** Plaid-linked accounts and transactions. */
  plaid: hasKuraBackend(),

  /** DeBank proxy (/api/debank/*). */
  debank: hasKuraBackend(),

  /** Dinari dShares in Discover → US Stock tab. */
  dinariStocks: false,

  /** Gnosis Pay card — direct SIWE mode or backend proxy. */
  gnosisPay: env.gpDirectEnabled || hasKuraBackend(),

  /** MoonPay ramp widget. */
  moonPay: env.moonpayApiKey.length > 0,

  /** Li.Fi bridge / swap integrator fee (optional). */
  lifiSwap: true,

  /**
   * Morpho vault earn on Base (public GraphQL + smart-account deposits).
   * Disable with EXPO_PUBLIC_MORPHO_EARN_ENABLED=false.
   */
  morphoEarn: isMorphoEarnEnabled(),
} as const;

export type AppFeatures = typeof features;
