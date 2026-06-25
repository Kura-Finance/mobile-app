/**
 * useEarnVaultChart — historical net APY series for EarnDetail charts.
 */
import { useEffect, useRef, useState } from 'react';
import i18n from '../../../shared/locales/i18n';
import type { Timeframe } from '../../crypto/hooks/useTokenDetail';
import {
  getVaultNetApyHistory,
  type MorphoTimeseriesInterval,
} from '../../../lib/api/morpho/client';

const CHART_TTL = 60_000;

const TIMEFRAME_OPTIONS: Record<
  Timeframe,
  { seconds: number; interval: MorphoTimeseriesInterval }
> = {
  '24H': { seconds: 86_400, interval: 'HOUR' },
  '1W': { seconds: 7 * 86_400, interval: 'HOUR' },
  '1M': { seconds: 30 * 86_400, interval: 'DAY' },
  '6M': { seconds: 180 * 86_400, interval: 'DAY' },
  '1Y': { seconds: 365 * 86_400, interval: 'DAY' },
};

interface CacheEntry {
  apys: number[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

export function useEarnVaultChart(
  vaultAddress: string | null,
  timeframe: Timeframe,
  active: boolean,
) {
  const [apys, setApys] = useState<number[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!active || !vaultAddress) {
      setApys([]);
      return;
    }

    const key = `${vaultAddress.toLowerCase()}:${timeframe}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CHART_TTL) {
      setApys(cached.apys);
      return;
    }

    const { seconds, interval } = TIMEFRAME_OPTIONS[timeframe];
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - seconds;

    const id = ++reqId.current;
    setChartLoading(true);
    setError(null);

    void getVaultNetApyHistory(vaultAddress, { startTimestamp, endTimestamp, interval })
      .then((series) => {
        if (id !== reqId.current) return;
        const asPercent = series.map((y) => y * 100);
        cache.set(key, { apys: asPercent, fetchedAt: Date.now() });
        setApys(asPercent);
      })
      .catch((err) => {
        if (id !== reqId.current) return;
        setError(err instanceof Error ? err.message : i18n.t('crypto.chartFailed'));
        setApys([]);
      })
      .finally(() => {
        if (id === reqId.current) setChartLoading(false);
      });
  }, [vaultAddress, timeframe, active]);

  return { apys, chartLoading, error };
}
