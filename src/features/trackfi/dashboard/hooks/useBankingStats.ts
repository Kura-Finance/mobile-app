import { useMemo } from 'react';
import type { Account } from '../../../../shared/store/finance';
import {
  netBankingBalance,
  sumCreditLiabilities,
  sumDepositoryBalances,
} from '../../utils/bankingBalances';

export function useBankingStats(accounts: Account[]) {
  return useMemo(() => {
    const depositoryAccounts = accounts.filter(
      (a) => a.type === 'checking' || a.type === 'saving',
    );
    const creditAccounts = accounts.filter((a) => a.type === 'credit');

    const depositoryTotal = sumDepositoryBalances(accounts);
    const creditUsed = sumCreditLiabilities(accounts);
    const netBalance = netBankingBalance(accounts);

    const totalCreditLimit = creditAccounts.reduce(
      (sum, a) => sum + (a.creditLimit ?? 0),
      0,
    );
    const hasCreditLimit = totalCreditLimit > 0;
    const availableCredit = hasCreditLimit ? Math.max(0, totalCreditLimit - creditUsed) : null;
    const creditUtilPct = hasCreditLimit
      ? Math.min(100, (creditUsed / totalCreditLimit) * 100)
      : null;

    return {
      depositoryAccounts,
      creditAccounts,
      netBalance,
      creditUsed,
      availableCredit,
      totalCreditLimit,
      creditUtilPct,
      hasCreditLimit,
      accountCount: accounts.length,
    };
  }, [accounts]);
}
