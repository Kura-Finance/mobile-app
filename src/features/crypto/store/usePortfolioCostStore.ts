import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  type CostLot,
  type CostPosition,
  syncCostLots,
} from './portfolioCostBasis';

const STORAGE_KEY = 'portfolio.costBasis.v1';

/** Stable empty reference — never return a fresh `{}` from selectors. */
export const EMPTY_COST_LOTS: Record<string, CostLot> = {};

interface PortfolioCostState {
  byWallet: Record<string, Record<string, CostLot>>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  sync: (walletAddress: string, positions: CostPosition[]) => void;
}

function walletKey(address: string): string {
  return address.toLowerCase();
}

function lotsEqual(a: Record<string, CostLot>, b: Record<string, CostLot>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    const x = a[k];
    const y = b[k];
    if (!y || x.quantity !== y.quantity || x.costUsd !== y.costUsd) return false;
  }
  return true;
}

export const usePortfolioCostStore = create<PortfolioCostState>((set, get) => ({
  byWallet: {},
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, CostLot>>) : {};
      set({ byWallet: parsed && typeof parsed === 'object' ? parsed : {}, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  sync: (walletAddress, positions) => {
    const key = walletKey(walletAddress);
    const prev = get().byWallet[key] ?? EMPTY_COST_LOTS;
    const nextLots = syncCostLots(prev, positions);
    if (lotsEqual(prev, nextLots)) return;

    const byWallet = { ...get().byWallet, [key]: nextLots };
    set({ byWallet });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(byWallet)).catch(() => {});
  },
}));

export function selectWalletCostLots(
  state: PortfolioCostState,
  walletAddress: string | null | undefined,
): Record<string, CostLot> {
  if (!walletAddress) return EMPTY_COST_LOTS;
  return state.byWallet[walletKey(walletAddress)] ?? EMPTY_COST_LOTS;
}
