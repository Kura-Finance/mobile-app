/**
 * Shared Dinari KYC / wallet-connect gate — single source for Invest + Portfolio.
 */

import { create } from 'zustand';

import * as dinari from '../../../lib/api/dinari/client';
import type { DinariAccount, DinariEntity } from '../../../lib/api/dinari/client';
import {
  formatDinariErrorForLog,
  getDinariConnectErrorMessage,
  isDinariKycRequiredError,
  isDinariWhitelistError,
} from '../../../lib/api/dinari/errors';
import { KuraApiError } from '../../../lib/api/errors';
import Logger from '../../../shared/utils/Logger';
import type { GateState } from '../types';

type SignMessageFn = (message: string) => Promise<string>;

interface DinariGateStoreState {
  scaAddress: string;
  state: GateState;
  entity: DinariEntity | null;
  account: DinariAccount | null;
  error: string | null;
  connecting: boolean;
  bindScaAddress: (address: string) => void;
  resolve: (force?: boolean) => Promise<GateState>;
  refreshEntity: () => Promise<DinariEntity | null>;
  startKyc: (name?: string) => Promise<string>;
  connectWallet: (signMessage: SignMessageFn) => Promise<void>;
  reset: () => void;
}

let resolveInFlight: Promise<GateState> | null = null;

const INITIAL_STATE = {
  scaAddress: '',
  state: 'idle' as GateState,
  entity: null as DinariEntity | null,
  account: null as DinariAccount | null,
  error: null as string | null,
  connecting: false,
};

function isTerminalGateState(state: GateState): boolean {
  return state === 'ready' || state === 'waitlist' || state === 'kyc' || state === 'connect';
}

export const useDinariGateStore = create<DinariGateStoreState>((set, get) => ({
  ...INITIAL_STATE,

  bindScaAddress: (address) => {
    const normalized = address ?? '';
    if (get().scaAddress === normalized) return;
    set({
      ...INITIAL_STATE,
      scaAddress: normalized,
    });
    resolveInFlight = null;
  },

  resolve: async (force = false) => {
    const { scaAddress, state } = get();
    if (!force && isTerminalGateState(state)) {
      return state;
    }

    if (resolveInFlight) {
      return resolveInFlight;
    }

    set({ error: null, state: 'checking' });

    resolveInFlight = (async () => {
      try {
        const ent = await dinari.getEntity();
        set({ entity: ent });
        if (!ent.canTransact) {
          set({ state: 'kyc' });
          return 'kyc' as GateState;
        }

        const acc = await dinari.getAccount();
        set({ account: acc });
        const connected =
          !!acc.walletAddress &&
          scaAddress &&
          acc.walletAddress.toLowerCase() === scaAddress.toLowerCase();
        const next: GateState = connected ? 'ready' : 'connect';
        set({ state: next });
        return next;
      } catch (e: unknown) {
        if (isDinariWhitelistError(e)) {
          set({
            error: e instanceof KuraApiError ? e.message : 'Not on whitelist.',
            state: 'waitlist',
          });
          return 'waitlist';
        }
        set({
          error: e instanceof Error ? e.message : 'Dinari is unavailable right now.',
          state: 'unsupported',
        });
        return 'unsupported';
      } finally {
        resolveInFlight = null;
      }
    })();

    return resolveInFlight;
  },

  refreshEntity: async () => {
    try {
      const ent = await dinari.getEntity();
      set({ entity: ent });
      if (ent.canTransact) {
        await get().resolve();
      }
      return ent;
    } catch {
      return null;
    }
  },

  startKyc: async (name?: string) => {
    const link = await dinari.createKycLink(name);
    return link.embedUrl;
  },

  connectWallet: async (signMessage) => {
    const { scaAddress, entity, account } = get();
    if (!scaAddress) throw new Error('Wallet not ready.');

    set({ connecting: true, error: null });
    try {
      const ent = entity ?? await dinari.getEntity();
      set({ entity: ent });
      if (ent.kycStatus !== 'PASS' || !ent.canTransact) {
        set({
          state: 'kyc',
          error: 'Complete Dinari identity verification before connecting your wallet.',
        });
        return;
      }

      const existing = account ?? await dinari.getAccount();
      set({ account: existing });
      if (
        existing.walletAddress
        && existing.walletAddress.toLowerCase() === scaAddress.toLowerCase()
      ) {
        set({ state: 'ready' });
        return;
      }

      const { nonce, message } = await dinari.getWalletNonce(scaAddress);
      const signature = await signMessage(message);
      const acc = await dinari.connectWallet({
        walletAddress: scaAddress,
        nonce,
        signature,
      });
      set({ account: acc, state: 'ready' });
    } catch (e: unknown) {
      Logger.warn('DinariGate', 'Wallet connect failed', formatDinariErrorForLog(e));

      if (isDinariKycRequiredError(e)) {
        set({ state: 'kyc' });
      }

      const message = getDinariConnectErrorMessage(e);
      set({ error: message });
      throw e instanceof Error ? e : new Error(message);
    } finally {
      set({ connecting: false });
    }
  },

  reset: () => {
    set({ ...INITIAL_STATE });
    resolveInFlight = null;
  },
}));

export function resetDinariGateStore(): void {
  resolveInFlight = null;
  useDinariGateStore.getState().reset();
}
