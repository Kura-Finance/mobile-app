import type { Investment, InvestmentAccount } from '../../../shared/store/finance/types';

export function getPlaidBrokerAccounts(accounts: InvestmentAccount[]): InvestmentAccount[] {
  return accounts.filter((a) => a.type !== 'Exchange' && a.type !== 'Web3 Wallet');
}

export function hasPlaidBrokerHoldings(
  accounts: InvestmentAccount[],
  investments: Investment[],
): boolean {
  const plaidAccounts = getPlaidBrokerAccounts(accounts);
  if (plaidAccounts.length === 0) return true;
  return investments.some((inv) => plaidAccounts.some((acc) => acc.id === inv.accountId));
}

/** Plaid investment account metadata is present but holdings are not in the store yet. */
export function isPlaidBrokerHoldingsPending(
  accounts: InvestmentAccount[],
  investments: Investment[],
): boolean {
  return getPlaidBrokerAccounts(accounts).length > 0 && !hasPlaidBrokerHoldings(accounts, investments);
}
