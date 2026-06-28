import type { TFunction } from 'i18next';

import type { BluechipToken } from '../config/blueChips';
import type { Timeframe } from '../hooks/useTokenDetail';

export const TIMEFRAME_I18N_KEYS: Record<Timeframe, string> = {
  '24H': 'crypto.chartTimeframe24H',
  '1W': 'crypto.chartTimeframe1W',
  '1M': 'crypto.chartTimeframe1M',
  '6M': 'crypto.chartTimeframe6M',
  '1Y': 'crypto.chartTimeframe1Y',
};

export function formatChartTimeframe(t: TFunction, tf: Timeframe): string {
  return t(TIMEFRAME_I18N_KEYS[tf]);
}

export function getTokenLocalizedName(
  token: Pick<BluechipToken, 'name'>,
): string {
  return token.name;
}
