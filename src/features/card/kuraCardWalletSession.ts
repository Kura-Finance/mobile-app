/**
 * Module-level Kura card wallet session state.
 *
 * Kept separate from useKuraCardWallet.ts so useAppStore can reset on logout
 * without creating a require cycle (store ↔ hook).
 */

let globalProvisionedSca: string | null = null;
let globalProvisionPromise: Promise<string | null> | null = null;

export function getGlobalProvisionedSca(): string | null {
  return globalProvisionedSca;
}

export function setGlobalProvisionedSca(address: string | null): void {
  globalProvisionedSca = address;
}

export function getGlobalProvisionPromise(): Promise<string | null> | null {
  return globalProvisionPromise;
}

export function setGlobalProvisionPromise(promise: Promise<string | null> | null): void {
  globalProvisionPromise = promise;
}

/** Clear on logout so the next account provisions fresh. */
export function resetKuraCardWalletSession(): void {
  globalProvisionedSca = null;
  globalProvisionPromise = null;
}
