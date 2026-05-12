import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRIDGE_CHAINS, BridgeChain } from '../../../lib/api/bridge/lifiClient';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChainOption {
  id: number;
  key: string;
  name: string;
  color: string;
}

export const BASE_CHAIN: ChainOption = { id: 8453, key: 'BASE', name: 'Base', color: '#2151F5' };
/** Bridge destinations from Base (Li.Fi). Includes Gnosis for Gnosis Pay wallet funding. */
export const ALL_CHAINS: ChainOption[] = [BASE_CHAIN, ...BRIDGE_CHAINS];

export interface CryptoContact {
  id: string;
  name: string;
  address: string;
  chainKey: string;
  createdAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage key
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@kura/crypto_contacts_v1';

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useCryptoContacts() {
  const [contacts, setContacts] = useState<CryptoContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed: CryptoContact[] = JSON.parse(raw);
          setContacts(parsed.sort((a, b) => b.createdAt - a.createdAt));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const persist = useCallback(async (next: CryptoContact[]) => {
    setContacts(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addContact = useCallback(
    async (params: { name: string; address: string; chainKey: string }) => {
      const contact: CryptoContact = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: params.name.trim() || shortenAddress(params.address),
        address: params.address,
        chainKey: params.chainKey,
        createdAt: Date.now(),
      };
      const next = [contact, ...contacts];
      await persist(next);
      return contact;
    },
    [contacts, persist],
  );

  const removeContact = useCallback(
    async (id: string) => {
      const next = contacts.filter((c) => c.id !== id);
      await persist(next);
    },
    [contacts, persist],
  );

  const getChain = useCallback((chainKey: string): ChainOption => {
    return ALL_CHAINS.find((c) => c.key === chainKey) ?? BASE_CHAIN;
  }, []);

  return { contacts, isLoading, addContact, removeContact, getChain };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

export function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
