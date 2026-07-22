import { AppState, type AppStateStatus } from 'react-native';
import * as Linking from 'expo-linking';
import type { WalletKitTypes } from '@reown/walletkit';
import { parseWalletConnectDeepLink } from './deepLink';
import { warmWalletConnectWalletMode } from './walletConnectBootstrap';
import Logger from '../../shared/utils/Logger';

async function loadWalletKit() {
  const { getWalletKit } = await import('./walletKit');
  return getWalletKit();
}

const TAG = 'WcInbound';

type SessionHandlers = {
  onProposal: (proposal: WalletKitTypes.SessionProposal) => void;
  onRequest: (request: WalletKitTypes.SessionRequest) => void;
  onDelete?: () => void;
};

let listenersAttached = false;
let kitListenersPromise: Promise<void> | null = null;
let sessionHandlers: SessionHandlers | null = null;
let deepLinkInstalled = false;
let appStateSubscription: { remove: () => void } | null = null;

const pendingUris: string[] = [];
const seenUris = new Set<string>();
let bufferedProposal: WalletKitTypes.SessionProposal | null = null;

function isExpoDevBootstrapUrl(url: string): boolean {
  return url.includes('expo-development-client') || url.startsWith('exp+');
}

function enqueueUri(uri: string): void {
  if (seenUris.has(uri) || pendingUris.includes(uri)) return;
  pendingUris.push(uri);
  Logger.info(TAG, 'Queued pairing URI', { queueLength: pendingUris.length });
  void flushPendingUris();
}

function dispatchProposal(proposal: WalletKitTypes.SessionProposal): void {
  Logger.info(TAG, 'session_proposal', {
    dapp: proposal.params.proposer.metadata.name,
    id: proposal.id,
  });
  if (sessionHandlers) {
    sessionHandlers.onProposal(proposal);
  } else {
    bufferedProposal = proposal;
    Logger.info(TAG, 'Buffered session_proposal until UI handlers mount');
  }
}

function dispatchRequest(request: WalletKitTypes.SessionRequest): void {
  sessionHandlers?.onRequest(request);
}

async function ensureKitListeners(): Promise<void> {
  if (kitListenersPromise) return kitListenersPromise;

  kitListenersPromise = (async () => {
    await warmWalletConnectWalletMode();
    const kit = await loadWalletKit();

    if (!listenersAttached) {
      kit.on('session_proposal', dispatchProposal);
      kit.on('session_request', dispatchRequest);
      kit.on('session_delete', () => {
        sessionHandlers?.onDelete?.();
      });
      listenersAttached = true;
      Logger.info(TAG, 'WalletKit event listeners attached');
    }
  })().catch((err) => {
    kitListenersPromise = null;
    throw err;
  });

  return kitListenersPromise;
}

async function pairWalletConnectUriInternal(uri: string): Promise<void> {
  const trimmed = uri.trim();
  if (!trimmed || seenUris.has(trimmed)) return;

  await ensureKitListeners();
  seenUris.add(trimmed);

  const kit = await loadWalletKit();
  Logger.info(TAG, 'Pairing WC URI');
  try {
    await kit.pair({ uri: trimmed });
  } catch (err) {
    seenUris.delete(trimmed);
    throw err;
  }
}

async function flushPendingUris(): Promise<void> {
  if (pendingUris.length === 0) return;

  await ensureKitListeners();

  while (pendingUris.length > 0) {
    const uri = pendingUris.shift();
    if (!uri) break;
    try {
      await pairWalletConnectUriInternal(uri);
    } catch (err) {
      Logger.error(TAG, 'Queued pairing failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function registerWalletConnectSessionHandlers(handlers: SessionHandlers): void {
  sessionHandlers = handlers;

  if (bufferedProposal) {
    handlers.onProposal(bufferedProposal);
    bufferedProposal = null;
  }

  void ensureKitListeners().then(() => flushPendingUris());
}

export function unregisterWalletConnectSessionHandlers(): void {
  sessionHandlers = null;
}

export async function pairWalletConnectUri(uri: string): Promise<void> {
  await pairWalletConnectUriInternal(uri);
}

function handleIncomingUrl(url: string | null): void {
  if (!url || isExpoDevBootstrapUrl(url)) return;

  const pairingUri = parseWalletConnectDeepLink(url);
  if (!pairingUri) {
    if (/kura:|wc:|\/wc\?/i.test(url)) {
      Logger.warn(TAG, 'Unrecognized WalletConnect deep link', { url: url.slice(0, 200) });
    }
    return;
  }

  Logger.info(TAG, 'Inbound deep link');
  enqueueUri(pairingUri);
}

async function captureInitialUrl(): Promise<void> {
  try {
    const url = await Linking.getInitialURL();
    if (url) {
      Logger.info(TAG, 'getInitialURL', { url: url.slice(0, 160) });
      handleIncomingUrl(url);
    }
  } catch (err) {
    Logger.warn(TAG, 'getInitialURL failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Call once React Native has mounted (App.tsx). `index.ts` is too early —
 * getInitialURL() often returns null before the native bridge is ready.
 */
export function startDeepLinkCapture(): void {
  void captureInitialUrl();
}

/**
 * Capture `kura://wc?uri=wc:…` as early as possible and keep listening for
 * warm-start redirects from external dApps (DeBank, etc.).
 */
export function installWalletConnectDeepLinkListener(): void {
  if (deepLinkInstalled) return;
  deepLinkInstalled = true;

  void warmWalletConnectWalletMode();

  Linking.addEventListener('url', ({ url }) => {
    Logger.info(TAG, 'Link event', { url: url.slice(0, 160) });
    handleIncomingUrl(url);
  });

  appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      void captureInitialUrl();
    }
  });

  Logger.info(TAG, 'Global deep link listener installed');
}

export function uninstallWalletConnectDeepLinkListenerForTests(): void {
  appStateSubscription?.remove();
  appStateSubscription = null;
  deepLinkInstalled = false;
  sessionHandlers = null;
  bufferedProposal = null;
  pendingUris.length = 0;
  seenUris.clear();
  listenersAttached = false;
  kitListenersPromise = null;
}
