import type { DepositPayerInfo, DepositResult } from './client';

export type DepositStatusBucket = 'completed' | 'processing' | 'review' | 'refunded' | string;

/** Whether to show account last-4 for this rail (never for ACH / wire). */
export function shouldShowDepositAccountLast4(
  paymentRail: string | null | undefined,
  accountLast4: string | null | undefined,
): boolean {
  if (!accountLast4) return false;
  const rail = paymentRail?.trim().toLowerCase() ?? '';
  if (rail === 'ach_push' || rail === 'ach' || rail === 'wire') return false;
  return true;
}

/** Format aggregated deposit payer for list / subtitle (rail-aware). */
export function formatDepositPayer(d: DepositPayerInfo): string | null {
  const senderName = d.senderName?.trim() || null;
  const accountLast4 = d.accountLast4?.trim() || null;
  const routing = d.senderBankRoutingNumber?.trim() || null;
  const rail = d.paymentRail?.trim().toLowerCase() ?? '';

  if (!senderName && !accountLast4 && !routing) return null;

  const parts: string[] = [];
  if (senderName) parts.push(senderName);

  if (shouldShowDepositAccountLast4(rail, accountLast4)) {
    parts.push(`****${accountLast4}`);
  } else if (routing && (rail === 'ach_push' || rail === 'ach' || !accountLast4)) {
    parts.push(`Routing ${routing}`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Optional ACH / wire description line (separate from payer name). */
export function formatDepositSenderDescription(
  description: string | null | undefined,
): string | null {
  const trimmed = description?.trim();
  return trimmed || null;
}

/** Map Bridge deposit status to UI bucket (completed / processing / review / refunded). */
export function getDepositStatusBucket(d: Pick<DepositResult, 'completed' | 'status'>): DepositStatusBucket {
  if (d.completed) return 'completed';
  switch (d.status) {
    case 'funds_received':
    case 'payment_submitted':
      return 'processing';
    case 'in_review':
      return 'review';
    case 'refunded':
      return 'refunded';
    default:
      return d.status;
  }
}

/** True when deposits should poll more frequently (~15s). */
export function hasPendingBridgeDeposits(deposits: Pick<DepositResult, 'completed' | 'status'>[]): boolean {
  return deposits.some((d) => !d.completed && d.status === 'funds_received');
}
