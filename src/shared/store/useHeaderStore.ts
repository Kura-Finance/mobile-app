/**
 * Header scroll state and tab title.
 */

import { create } from 'zustand';

interface HeaderState {
  scrolled: boolean;
  title: string | null;
  subtitle: string | null;
  trackFiToolbar: { showBack: boolean } | null;
  portfolioToolbar: boolean;
  setScrolled: (v: boolean) => void;
  setHeaderContent: (title: string | null, subtitle?: string | null) => void;
  setTrackFiToolbar: (toolbar: { showBack: boolean } | null) => void;
  setPortfolioToolbar: (show: boolean) => void;
}

export const useHeaderStore = create<HeaderState>((set) => ({
  scrolled: false,
  title: null,
  subtitle: null,
  trackFiToolbar: null,
  portfolioToolbar: false,
  setScrolled: (v) => set((s) => (s.scrolled === v ? s : { scrolled: v })),
  setHeaderContent: (title, subtitle = null) => set({ title, subtitle }),
  setTrackFiToolbar: (trackFiToolbar) => set({ trackFiToolbar }),
  setPortfolioToolbar: (portfolioToolbar) => set({ portfolioToolbar }),
}));
