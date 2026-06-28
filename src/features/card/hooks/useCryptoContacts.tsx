import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRIDGE_CHAINS } from '../../../lib/api/bridge/lifiClient';

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
/** Bridge destinations from Base (Li.Fi). */
export const ALL_CHAINS: ChainOption[] = [BASE_CHAIN, ...BRIDGE_CHAINS];

export interface CryptoContact {
  id: string;
  name: string;
  address: string;
  chainKey: string;
  createdAt: number;
}

interface CryptoContactsContextValue {
  contacts: CryptoContact[];
  isLoading: boolean;
  /** Increments whenever contacts are saved or removed — use to trigger UI refresh. */
  revision: number;
  addContact: (params: { name: string; address: string; chainKey: string }) => Promise<CryptoContact>;
  removeContact: (id: string) => Promise<void>;
  reloadContacts: () => Promise<void>;
  getChain: (chainKey: string) => ChainOption;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage key
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@kura/crypto_contacts_v1';

const CryptoContactsContext = createContext<CryptoContactsContextValue | null>(null);

async function readContactsFromStorage(): Promise<CryptoContact[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: CryptoContact[] = JSON.parse(raw);
  return parsed.sort((a, b) => b.createdAt - a.createdAt);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function CryptoContactsProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<CryptoContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const reloadContacts = useCallback(async () => {
    try {
      const next = await readContactsFromStorage();
      setContacts(next);
    } catch {
      // Keep last known list on read failure.
    }
  }, []);

  useEffect(() => {
    reloadContacts().finally(() => setIsLoading(false));
  }, [reloadContacts]);

  const persist = useCallback(async (next: CryptoContact[]) => {
    const sorted = [...next].sort((a, b) => b.createdAt - a.createdAt);
    setContacts(sorted);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    setRevision((r) => r + 1);
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
      const next = [contact, ...contacts.filter(
        (c) => c.address.toLowerCase() !== contact.address.toLowerCase(),
      )];
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

  const value = useMemo(
    () => ({
      contacts,
      isLoading,
      revision,
      addContact,
      removeContact,
      reloadContacts,
      getChain,
    }),
    [contacts, isLoading, revision, addContact, removeContact, reloadContacts, getChain],
  );

  return (
    <CryptoContactsContext.Provider value={value}>
      {children}
    </CryptoContactsContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useCryptoContacts() {
  const ctx = useContext(CryptoContactsContext);
  if (!ctx) {
    throw new Error('useCryptoContacts must be used within CryptoContactsProvider');
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

export function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
