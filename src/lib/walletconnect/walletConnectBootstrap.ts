/**
 * Ensures AppKit (dApp) and WalletKit (wallet) share one WalletConnect Core +
 * one SignClient. Two SignClient instances on the same Core cause inbound
 * session_proposal events to hit the wrong client ("No listener for
 * session_proposal event").
 *
 * Import this module before createAppKit().
 */
import { Core } from '@walletconnect/core';
import SignClient from '@walletconnect/sign-client';
import UniversalProvider from '@walletconnect/universal-provider';
import { assertValidWalletConnectProjectId } from '../../config/env';

let sharedCore: InstanceType<typeof Core> | null = null;
let sharedSignClient: Awaited<ReturnType<typeof SignClient.init>> | null = null;
let sharedUniversalProvider: Awaited<ReturnType<typeof UniversalProvider.init>> | null =
  null;

export function getWalletConnectProjectId(): string {
  return assertValidWalletConnectProjectId();
}

export function getSharedWalletConnectCore(): InstanceType<typeof Core> {
  if (!sharedCore) {
    sharedCore = new Core({ projectId: getWalletConnectProjectId() });
  }
  return sharedCore;
}

export function getSharedSignClient(): Awaited<ReturnType<typeof SignClient.init>> | null {
  return sharedSignClient;
}

const originalSignClientInit = SignClient.init.bind(SignClient);

SignClient.init = (async (opts) => {
  const core = getSharedWalletConnectCore();
  if (sharedSignClient) {
    return sharedSignClient;
  }

  sharedSignClient = await originalSignClientInit({
    ...opts,
    core,
  });

  return sharedSignClient;
}) as typeof SignClient.init;

const originalUniversalProviderInit = UniversalProvider.init.bind(UniversalProvider);

UniversalProvider.init = (async (opts) => {
  if (sharedUniversalProvider) {
    return sharedUniversalProvider;
  }

  sharedUniversalProvider = await originalUniversalProviderInit({
    ...opts,
    core: getSharedWalletConnectCore(),
  });

  return sharedUniversalProvider;
}) as typeof UniversalProvider.init;

let walletKitWarmup: Promise<void> | null = null;

/** Initialise WalletKit (wallet-mode SignClient) before AppKit when possible. */
export function warmWalletConnectWalletMode(): Promise<void> {
  if (!walletKitWarmup) {
    walletKitWarmup = import('./walletKit')
      .then((m) => m.getWalletKit())
      .then(() => undefined)
      .catch((err) => {
        walletKitWarmup = null;
        throw err;
      });
  }
  return walletKitWarmup;
}
