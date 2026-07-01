import { describe, expect, it } from 'vitest';
import type { Investment, InvestmentAccount } from '../../../../shared/store/finance/types';
import {
  getPlaidBrokerAccounts,
  hasPlaidBrokerHoldings,
  isPlaidBrokerHoldingsPending,
} from '../plaidBrokerHoldings';

describe('plaidBrokerHoldings', () => {
  const brokerAccount: InvestmentAccount = {
    id: 'broker-1',
    name: 'Fidelity',
    type: 'Broker',
    logo: '',
  };

  const exchangeAccount: InvestmentAccount = {
    id: 'ex-1',
    name: 'Binance',
    type: 'Exchange',
    logo: '',
  };

  const holding: Investment = {
    id: 'inv-1',
    accountId: 'broker-1',
    symbol: 'AAPL',
    name: 'Apple',
    holdings: 1,
    currentPrice: 100,
    change24h: 0,
    usdValue: 100,
    type: 'stock',
    logo: '',
  };

  it('detects pending holdings when broker accounts exist without investments', () => {
    expect(isPlaidBrokerHoldingsPending([brokerAccount], [])).toBe(true);
    expect(hasPlaidBrokerHoldings([brokerAccount], [])).toBe(false);
  });

  it('is not pending once broker holdings are present', () => {
    expect(isPlaidBrokerHoldingsPending([brokerAccount], [holding])).toBe(false);
    expect(hasPlaidBrokerHoldings([brokerAccount], [holding])).toBe(true);
  });

  it('ignores exchange accounts when checking plaid broker state', () => {
    expect(getPlaidBrokerAccounts([brokerAccount, exchangeAccount])).toEqual([brokerAccount]);
    expect(isPlaidBrokerHoldingsPending([exchangeAccount], [])).toBe(false);
    expect(hasPlaidBrokerHoldings([], [])).toBe(true);
  });
});
