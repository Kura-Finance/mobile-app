import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import type { WalletKitTypes } from '@reown/walletkit';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
import type { SessionTypes } from '@walletconnect/types';
import { getKuraWalletKit } from '../../../lib/walletconnect/kuraWalletKit';
import {
  pairWalletConnectUri,
  registerWalletConnectSessionHandlers,
  unregisterWalletConnectSessionHandlers,
} from '../../../lib/walletconnect/wcInboundPairing';
import { requiredEip155ChainsSatisfied } from '../../../lib/walletconnect/constants';
import {
  buildSupportedNamespaces,
  executeWalletConnectRequest,
  formatWcError,
  formatWcSuccess,
  formatWcUserRejected,
} from '../../../lib/walletconnect/sessionRouter';
import {
  clearDisconnectedDappHistory,
  loadDappSessionHistory,
  removeDappSessionHistoryEntry,
  saveDappSessionHistory,
  syncDappSessionHistory,
  type DappSessionRecord,
} from '../lib/dappSessionHistory';
import { selectCanonicalEmbeddedWallet } from '../../../shared/utils/embeddedWallet';
import Logger from '../../../shared/utils/Logger';
import WcPairScannerModal from '../components/WcPairScannerModal';
import WcSessionProposalModal from '../components/WcSessionProposalModal';
import WcSessionRequestModal from '../components/WcSessionRequestModal';

const TAG = 'KuraWalletConnect';

function redirectToDapp(redirectNative?: string | null): void {
  if (!redirectNative) return;
  void Linking.openURL(redirectNative).catch(() => undefined);
}

interface KuraWalletConnectContextValue {
  smartAddress: string;
  isReady: boolean;
  activeSessions: SessionTypes.Struct[];
  dappHistory: DappSessionRecord[];
  openPairScanner: () => void;
  pairUri: (uri: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  disconnectSession: (topic: string) => Promise<void>;
  removeDappHistoryEntry: (id: string) => Promise<void>;
  clearDisconnectedHistory: () => Promise<void>;
}

const KuraWalletConnectContext = createContext<KuraWalletConnectContextValue | null>(null);

export function useKuraWalletConnect(): KuraWalletConnectContextValue {
  const ctx = useContext(KuraWalletConnectContext);
  if (!ctx) {
    throw new Error('useKuraWalletConnect must be used within KuraWalletConnectProvider');
  }
  return ctx;
}

interface Props {
  smartAddress: string;
  walletReady: boolean;
  userId: string;
  children: React.ReactNode;
}

export function KuraWalletConnectProvider({ smartAddress, walletReady, userId, children }: Props) {
  const { t } = useTranslation();
  const { wallets: embeddedWallets } = useEmbeddedEthereumWallet();
  const embeddedWallet = selectCanonicalEmbeddedWallet(embeddedWallets);

  const [showScanner, setShowScanner] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<WalletKitTypes.SessionProposal | null>(null);
  const [pendingRequest, setPendingRequest] = useState<WalletKitTypes.SessionRequest | null>(null);
  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);
  const [dappHistory, setDappHistory] = useState<DappSessionRecord[]>([]);
  const [isKitReady, setIsKitReady] = useState(false);

  const dappHistoryRef = useRef<DappSessionRecord[]>([]);
  dappHistoryRef.current = dappHistory;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const smartAddressRef = useRef(smartAddress);
  smartAddressRef.current = smartAddress;

  const approvingRequestIdRef = useRef<number | null>(null);

  const getEmbeddedProvider = useCallback(async () => {
    if (!embeddedWallet) throw new Error('Embedded wallet not available.');
    return embeddedWallet.getProvider();
  }, [embeddedWallet]);

  const refreshSessions = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) {
      setSessions([]);
      setDappHistory([]);
      return;
    }
    try {
      const kit = await getKuraWalletKit();
      const active = Object.values(kit.getActiveSessions());
      setSessions(active);
      const synced = syncDappSessionHistory(active, dappHistoryRef.current);
      setDappHistory(synced);
      await saveDappSessionHistory(uid, synced);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    registerWalletConnectSessionHandlers({
      onProposal: (proposal) => {
        if (!mounted) return;
        setPendingProposal(proposal);
      },
      onRequest: (event) => {
        if (!mounted) return;
        setPendingRequest(event);
      },
      onDelete: () => {
        void refreshSessions();
      },
    });

    void (async () => {
      try {
        if (!userId) {
          setDappHistory([]);
          setSessions([]);
          return;
        }
        const history = await loadDappSessionHistory(userId);
        setDappHistory(history);
        await getKuraWalletKit();
        if (mounted) {
          setIsKitReady(true);
          await refreshSessions();
        }
      } catch (err) {
        Logger.error(TAG, 'WalletKit init failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return () => {
      mounted = false;
      unregisterWalletConnectSessionHandlers();
      setSessions([]);
      setDappHistory([]);
      setPendingProposal(null);
      setPendingRequest(null);
      setShowScanner(false);
    };
  }, [refreshSessions, userId]);

  const pairUri = useCallback(async (uri: string) => {
    await pairWalletConnectUri(uri);
  }, []);

  const openPairScanner = useCallback(() => {
    if (!walletReady || !smartAddress) return;
    setShowScanner(true);
  }, [walletReady, smartAddress]);

  const disconnectSession = useCallback(async (topic: string) => {
    const kit = await getKuraWalletKit();
    await kit.disconnectSession({ topic, reason: getSdkError('USER_DISCONNECTED') });
    await refreshSessions();
  }, [refreshSessions]);

  const removeDappHistoryEntry = useCallback(async (id: string) => {
    const uid = userIdRef.current;
    if (!uid) return;
    const next = await removeDappSessionHistoryEntry(uid, id);
    setDappHistory(next);
  }, []);

  const clearDisconnectedHistory = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    const next = await clearDisconnectedDappHistory(uid);
    setDappHistory(next);
  }, []);

  const handleApproveProposal = useCallback(async () => {
    if (!pendingProposal) return;
    const sca = smartAddressRef.current;
    if (!sca) return;

    try {
      const kit = await getKuraWalletKit();
      const requiredChains = pendingProposal.params.requiredNamespaces.eip155?.chains ?? [];
      if (!requiredEip155ChainsSatisfied(requiredChains)) {
        Logger.warn(TAG, 'Rejecting WC proposal — unsupported required chains', {
          required: requiredChains,
        });
        await kit.rejectSession({
          id: pendingProposal.id,
          reason: getSdkError('UNSUPPORTED_CHAINS'),
        });
        return;
      }

      const approvedNamespaces = buildApprovedNamespaces({
        proposal: pendingProposal.params,
        supportedNamespaces: buildSupportedNamespaces(sca),
      });
      await kit.approveSession({ id: pendingProposal.id, namespaces: approvedNamespaces });
      await refreshSessions();
      redirectToDapp(pendingProposal.params.proposer.metadata.redirect?.native);
    } catch (err) {
      Logger.error(TAG, 'Session approval failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      const kit = await getKuraWalletKit();
      await kit.rejectSession({
        id: pendingProposal.id,
        reason: getSdkError('USER_REJECTED'),
      });
    } finally {
      setPendingProposal(null);
    }
  }, [pendingProposal, refreshSessions]);

  const handleRejectProposal = useCallback(async () => {
    if (!pendingProposal) return;
    try {
      const kit = await getKuraWalletKit();
      await kit.rejectSession({
        id: pendingProposal.id,
        reason: getSdkError('USER_REJECTED'),
      });
    } finally {
      setPendingProposal(null);
    }
  }, [pendingProposal]);

  const handleApproveRequest = useCallback(async () => {
    if (!pendingRequest) return;
    if (approvingRequestIdRef.current === pendingRequest.id) return;
    const sca = smartAddressRef.current;
    if (!sca) return;

    const request = pendingRequest;
    const { topic, id, params } = request;
    approvingRequestIdRef.current = id;
    setPendingRequest(null);

    try {
      const kit = await getKuraWalletKit();
      const result = await executeWalletConnectRequest(
        getEmbeddedProvider,
        sca,
        params.request,
      );
      await kit.respondSessionRequest({
        topic,
        response: formatWcSuccess(id, result),
      });
      const sessions = kit.getActiveSessions();
      redirectToDapp(sessions[topic]?.peer?.metadata?.redirect?.native);
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Request failed';
      const message = /Insufficient USDC|transfer amount exceeds balance|ERC20:/i.test(rawMessage)
        ? t('walletConnect.insufficientUsdcForGas')
        : rawMessage;
      try {
        const kit = await getKuraWalletKit();
        await kit.respondSessionRequest({
          topic,
          response: formatWcError(id, message),
        });
        const sessions = kit.getActiveSessions();
        redirectToDapp(sessions[topic]?.peer?.metadata?.redirect?.native);
      } catch (respondErr) {
        Logger.error(TAG, 'Failed to respond to WC request after error', {
          error: respondErr instanceof Error ? respondErr.message : String(respondErr),
        });
      }
      Logger.error(TAG, 'WC request failed', {
        error: message,
        method: params.request.method,
      });
    } finally {
      if (approvingRequestIdRef.current === id) {
        approvingRequestIdRef.current = null;
      }
    }
  }, [pendingRequest, getEmbeddedProvider, t]);

  const handleRejectRequest = useCallback(async () => {
    if (!pendingRequest) return;
    const kit = await getKuraWalletKit();
    const { topic } = pendingRequest;
    await kit.respondSessionRequest({
      topic: pendingRequest.topic,
      response: formatWcUserRejected(pendingRequest.id),
    });
    setPendingRequest(null);
    const sessions = kit.getActiveSessions();
    redirectToDapp(sessions[topic]?.peer?.metadata?.redirect?.native);
  }, [pendingRequest]);

  const value = useMemo<KuraWalletConnectContextValue>(() => ({
    smartAddress,
    isReady: walletReady && isKitReady && !!smartAddress,
    activeSessions: sessions,
    dappHistory,
    openPairScanner,
    pairUri,
    refreshSessions,
    disconnectSession,
    removeDappHistoryEntry,
    clearDisconnectedHistory,
  }), [
    smartAddress,
    walletReady,
    isKitReady,
    sessions,
    dappHistory,
    openPairScanner,
    pairUri,
    refreshSessions,
    disconnectSession,
    removeDappHistoryEntry,
    clearDisconnectedHistory,
  ]);

  return (
    <KuraWalletConnectContext.Provider value={value}>
      {children}

      <WcPairScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onUri={async (uri) => {
          setShowScanner(false);
          await pairUri(uri);
        }}
      />

      <WcSessionProposalModal
        visible={!!pendingProposal}
        proposal={pendingProposal}
        smartAddress={smartAddress}
        onApprove={handleApproveProposal}
        onReject={handleRejectProposal}
      />

      <WcSessionRequestModal
        visible={!!pendingRequest}
        request={pendingRequest}
        smartAddress={smartAddress}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
      />
    </KuraWalletConnectContext.Provider>
  );
}
