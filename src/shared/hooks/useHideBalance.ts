import { useAppStore } from '../store/useAppStore';

export function useHideBalance(): boolean {
  return useAppStore((state) => state.preferences.hideBalance);
}
