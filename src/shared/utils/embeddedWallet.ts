/**
 * Canonical Privy embedded-wallet selector.
 *
 * Privy retains *every* embedded EOA it has ever provisioned for a user, so
 * `useEmbeddedEthereumWallet().wallets` can contain many entries (see the long
 * list of EVM wallets in the Privy dashboard). The order of that array is NOT
 * guaranteed to be stable across sessions or devices, so indexing with
 * `wallets[0]` can silently resolve to a *different* EOA over time — which then
 * derives a different Safe Smart Account address and looks like funds vanished.
 *
 * To avoid that, the entire app must lock onto a single, deterministic EOA.
 * We pick the wallet with the lowest HD `walletIndex` (the original, first
 * wallet Privy created for the user). This is stable forever: index 0 is always
 * the first wallet, and Privy never re-numbers existing wallets.
 */

import type { ConnectedEthereumWallet } from '@privy-io/expo';

/**
 * Deterministically select the canonical embedded EOA from Privy's wallet list.
 *
 * Selection rule: lowest `walletIndex`, tie-broken by lowest-cased address so
 * the result is fully reproducible even if two wallets somehow share an index.
 *
 * @returns the canonical wallet, or `null` if the user has no embedded wallet.
 */
export function selectCanonicalEmbeddedWallet(
  wallets: readonly ConnectedEthereumWallet[] | undefined | null,
): ConnectedEthereumWallet | null {
  if (!wallets || wallets.length === 0) return null;

  return wallets.reduce((best, current) => {
    if (current.walletIndex !== best.walletIndex) {
      return current.walletIndex < best.walletIndex ? current : best;
    }
    return current.address.toLowerCase() < best.address.toLowerCase() ? current : best;
  });
}
