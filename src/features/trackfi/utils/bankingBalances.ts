/**
 * Banking balance helpers — consistent credit liability sign handling.
 *
 * Plaid credit balances are stored as positive amounts owed; some paths may
 * still surface negative values. Liability helpers always normalize with abs().
 */

import type { Account } from '../../../shared/store/finance/types';

export function creditLiabilityAmount(balance: number): number {
  return Math.abs(balance);
}

export function sumDepositoryBalances(
  accounts: Pick<Account, 'type' | 'balance'>[],
): number {
  return accounts
    .filter((a) => a.type === 'checking' || a.type === 'saving')
    .reduce((sum, a) => sum + a.balance, 0);
}

export function sumCreditLiabilities(
  accounts: Pick<Account, 'type' | 'balance'>[],
): number {
  return accounts
    .filter((a) => a.type === 'credit')
    .reduce((sum, a) => sum + creditLiabilityAmount(a.balance), 0);
}

export function netBankingBalance(
  accounts: Pick<Account, 'type' | 'balance'>[],
): number {
  return sumDepositoryBalances(accounts) - sumCreditLiabilities(accounts);
}

/** Asset allocation: depository cash only — credit debt is a liability, not an asset. */
export function bankingAssetAllocation(
  accounts: Pick<Account, 'type' | 'balance'>[],
): number {
  return Math.max(0, sumDepositoryBalances(accounts));
}
