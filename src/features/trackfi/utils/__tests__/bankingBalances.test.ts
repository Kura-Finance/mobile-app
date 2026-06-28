import { describe, expect, test } from 'vitest';
import type { Account } from '../../../../shared/store/finance/types';
import {
  bankingAssetAllocation,
  creditLiabilityAmount,
  netBankingBalance,
  sumCreditLiabilities,
  sumDepositoryBalances,
} from '../bankingBalances';

function account(partial: Pick<Account, 'type' | 'balance'> & Partial<Account>): Account {
  return {
    id: '1',
    name: 'Test',
    logo: '',
    ...partial,
  };
}

describe('bankingBalances', () => {
  test('creditLiabilityAmount normalizes sign', () => {
    expect(creditLiabilityAmount(500)).toBe(500);
    expect(creditLiabilityAmount(-500)).toBe(500);
  });

  test('netBankingBalance subtracts credit liabilities', () => {
    const accounts = [
      account({ type: 'checking', balance: 10_000 }),
      account({ type: 'credit', balance: 2_000 }),
    ];
    expect(netBankingBalance(accounts)).toBe(8_000);
  });

  test('netBankingBalance handles negative credit balances as liability', () => {
    const accounts = [
      account({ type: 'checking', balance: 1_000 }),
      account({ type: 'credit', balance: -500 }),
    ];
    expect(sumCreditLiabilities(accounts)).toBe(500);
    expect(netBankingBalance(accounts)).toBe(500);
  });

  test('bankingAssetAllocation excludes credit debt from asset weight', () => {
    const accounts = [
      account({ type: 'checking', balance: 1_000 }),
      account({ type: 'credit', balance: 5_000 }),
    ];
    expect(sumDepositoryBalances(accounts)).toBe(1_000);
    expect(netBankingBalance(accounts)).toBe(-4_000);
    expect(bankingAssetAllocation(accounts)).toBe(1_000);
  });

  test('bankingAssetAllocation is zero when only credit accounts exist', () => {
    const accounts = [account({ type: 'credit', balance: 3_000 })];
    expect(bankingAssetAllocation(accounts)).toBe(0);
  });
});
