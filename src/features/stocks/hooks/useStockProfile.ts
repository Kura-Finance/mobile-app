import { useEffect, useState } from 'react';
import {
  fetchStockCompanyProfile,
  type StockCompanyProfile,
} from '../utils/stockCompanyProfile';

export function useStockProfile(
  symbol: string | null,
  name: string | null,
  geckoId: string | null,
  active: boolean,
) {
  const [profile, setProfile] = useState<StockCompanyProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active || !symbol || !name) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    fetchStockCompanyProfile(symbol, name, geckoId)
      .then((result) => {
        if (alive) setProfile(result);
      })
      .catch(() => {
        if (alive) setProfile(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [symbol, name, geckoId, active]);

  return { profile, loading };
}
