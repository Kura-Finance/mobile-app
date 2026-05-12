/**
 * Header scroll state.
 *
 * Tracks whether the currently active tab screen has been scrolled past a small
 * threshold. The global Header consumes this to switch between its default
 * (opaque, blends with the background) and scrolled (translucent frosted blur)
 * appearance.
 */

import { create } from 'zustand';

interface HeaderState {
  scrolled: boolean;
  setScrolled: (v: boolean) => void;
}

export const useHeaderStore = create<HeaderState>((set) => ({
  scrolled: false,
  setScrolled: (v) => set((s) => (s.scrolled === v ? s : { scrolled: v })),
}));
