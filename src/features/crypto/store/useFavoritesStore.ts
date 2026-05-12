/**
 * Crypto favorites (watchlist) store.
 *
 * Persists the set of starred token symbols to AsyncStorage so the user's
 * favorite assets survive app restarts. Components subscribe to the `favorites`
 * array for reactivity and use `toggleFavorite` to star / unstar a token.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'crypto.favorites.v1';

interface FavoritesState {
  favorites: string[]; // token symbols, in the order they were starred
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggleFavorite: (symbol: string) => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      set({ favorites: Array.isArray(parsed) ? parsed : [], hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  toggleFavorite: (symbol) => {
    const current = get().favorites;
    const next = current.includes(symbol)
      ? current.filter((s) => s !== symbol)
      : [...current, symbol];
    set({ favorites: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },
}));
