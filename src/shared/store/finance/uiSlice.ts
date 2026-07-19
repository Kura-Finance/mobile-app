import { StateCreator } from 'zustand';
import { UIState, CurrencyType, TimeRangeType, FinanceState } from './types';

/**
 * UI Slice - 處理 UI 狀態與偏好
 * 包括：時間範圍、貨幣、AI 選項、圖表數據
 */
export const createUISlice: StateCreator<FinanceState, [], [], UIState> = (set, _get, _api) => ({
  // Initial State
  selectedTimeRange: '1W',
  chartDataByTimeRange: {
    '1W': [],
    '1M': [],
    '6M': [],
    '1Y': [],
  },
  currency: 'usd',
  isAiOptedIn: false,

  // Actions
  toggleAiOptIn: () =>
    set((state) => ({ isAiOptedIn: !state.isAiOptedIn })),

  setSelectedTimeRange: (timeRange: TimeRangeType) =>
    set({ selectedTimeRange: timeRange }),

  setCurrency: (currency: CurrencyType) =>
    set({ currency }),
});
