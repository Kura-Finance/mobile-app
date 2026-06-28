import type { CryptoContact } from '../hooks/useCryptoContacts';
import { isLifiAddress } from './walletTxEnrichment';
import { isMorphoBlueAddress, isMorphoEarnVaultAddress } from './walletTxMorpho';

export type TxContactLookup = Pick<CryptoContact, 'name' | 'address'>;

export function findContactName(
  address: string | undefined,
  contacts: TxContactLookup[],
): string | null {
  if (!address) return null;
  const needle = address.toLowerCase();
  return contacts.find((c) => c.address.toLowerCase() === needle)?.name ?? null;
}

export function resolvePeerAddress(tx: {
  activityKind?: string;
  direction: string;
  counterparty: string;
  fromAddress?: string;
  toAddress?: string;
}): string | undefined {
  if (tx.activityKind === 'send' || tx.direction === 'out') {
    return tx.toAddress ?? tx.counterparty;
  }
  if (tx.activityKind === 'receive' || tx.direction === 'in') {
    return tx.fromAddress ?? tx.counterparty;
  }
  return tx.counterparty;
}

export function isKnownRouterAddress(address: string | undefined): boolean {
  return (
    isLifiAddress(address)
    || isMorphoBlueAddress(address)
    || isMorphoEarnVaultAddress(address)
  );
}
