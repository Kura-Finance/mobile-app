/**
 * Bridge virtual-account on-ramp limits & settlement notes.
 *
 * Source of truth (Bridge Orchestration):
 *   https://apidocs.bridge.xyz/platform/orchestration/more/rail-specific
 * Route minimums (when backend omits minDeposit):
 *   https://apidocs.bridge.xyz/get-started/introduction/what-we-support/payment-routes
 */

import type { TFunction } from 'i18next';
import type { FiatCurrency, MinDeposit } from './client';

/** Bridge rail-specific volume / transaction limit — rendered via i18n templates. */
export type BridgeLimitValue =
  | { kind: 'unlimited' }
  | { kind: 'contact' }
  /** e.g. MXN 1st party 1,000,000 MXN */
  | { kind: 'up_to'; amount: string; currency: string }
  /** USD ACH: 3rd-party P2P under $4,000 */
  | { kind: 'p2p_under'; amount: string; currency: string };

export interface BridgeVirtualAccountOnrampInfo {
  /** Fiat-side minimum from Bridge rail-specific docs (fallback when API has no minDeposit). */
  docMin: MinDeposit;
  ownAccount: BridgeLimitValue;
  anotherPerson: BridgeLimitValue;
  business: BridgeLimitValue;
  /** i18n key suffix under card.bridgeArrival.* */
  arrivalKey: string;
  /** Optional override when payment_rails includes a slower rail (e.g. USD wire). */
  arrivalKeyByRail?: Partial<Record<string, string>>;
}

/**
 * Bridge virtual-account ONRAMP limits per source currency.
 * @see https://apidocs.bridge.xyz/platform/orchestration/more/rail-specific
 */
export const BRIDGE_VA_ONRAMP: Record<FiatCurrency, BridgeVirtualAccountOnrampInfo> = {
  usd: {
    docMin: { amount: '1', currency: 'usd' },
    ownAccount: { kind: 'unlimited' },
    anotherPerson: { kind: 'p2p_under', amount: '4,000', currency: 'USD' },
    business: { kind: 'unlimited' },
    arrivalKey: 'usdAch',
    arrivalKeyByRail: { wire: 'usdWire' },
  },
  eur: {
    docMin: { amount: '1', currency: 'eur' },
    ownAccount: { kind: 'unlimited' },
    anotherPerson: { kind: 'contact' },
    business: { kind: 'unlimited' },
    arrivalKey: 'sepa',
  },
  gbp: {
    docMin: { amount: '2', currency: 'gbp' },
    ownAccount: { kind: 'unlimited' },
    anotherPerson: { kind: 'contact' },
    business: { kind: 'unlimited' },
    arrivalKey: 'gbpFps',
  },
  mxn: {
    docMin: { amount: '50', currency: 'mxn' },
    ownAccount: { kind: 'up_to', amount: '1,000,000', currency: 'MXN' },
    anotherPerson: { kind: 'up_to', amount: '15,000', currency: 'MXN' },
    business: { kind: 'unlimited' },
    arrivalKey: 'spei',
  },
  brl: {
    docMin: { amount: '10', currency: 'brl' },
    ownAccount: { kind: 'unlimited' },
    anotherPerson: { kind: 'contact' },
    business: { kind: 'unlimited' },
    arrivalKey: 'pix',
  },
  cop: {
    docMin: { amount: '100', currency: 'cop' },
    ownAccount: { kind: 'unlimited' },
    anotherPerson: { kind: 'contact' },
    business: { kind: 'unlimited' },
    arrivalKey: 'copBreB',
  },
};

/** Tron USDT → Base USDC liquidation address (Bridge payment routes min: 5 USDT). */
export const BRIDGE_CRYPTO_USDT_DEPOSIT = {
  docMin: { amount: '5', currency: 'usdt' } satisfies MinDeposit,
  arrivalKey: 'tronUsdt',
} as const;

export function formatBridgeLimitLabel(limit: BridgeLimitValue, t: TFunction): string {
  switch (limit.kind) {
    case 'unlimited':
      return t('card.bridgeLimitUnlimited');
    case 'contact':
      return t('card.bridgeLimitContactAccountManager');
    case 'p2p_under':
      return t('card.bridgeLimitP2pUnder', { amount: limit.amount, currency: limit.currency });
    case 'up_to':
      return t('card.bridgeLimitUpTo', { amount: limit.amount, currency: limit.currency });
  }
}

export function resolveBridgeArrivalKey(
  currency: FiatCurrency,
  paymentRails?: string[] | null,
): string {
  const info = BRIDGE_VA_ONRAMP[currency];
  if (paymentRails?.length && info.arrivalKeyByRail) {
    for (const rail of paymentRails) {
      const key = info.arrivalKeyByRail[rail.toLowerCase()];
      if (key) return key;
    }
  }
  return info.arrivalKey;
}

export function resolveMinDepositLabel(
  apiMin: MinDeposit | null | undefined,
  docMin: MinDeposit,
): string | null {
  const min = apiMin ?? docMin;
  const amount = min.amount;
  if (amount == null || amount === '') return null;
  const currency = (min.currency ?? '').toUpperCase();
  return currency ? `${amount} ${currency}` : amount;
}

export function buildBridgeFiatDepositBullets(
  currency: FiatCurrency,
  t: TFunction,
  opts: {
    minDeposit?: MinDeposit | null;
    feeLabel?: string | null;
    paymentRails?: string[] | null;
  },
): string[] {
  const info = BRIDGE_VA_ONRAMP[currency];
  const bullets: string[] = [];

  const minLabel = resolveMinDepositLabel(opts.minDeposit, info.docMin);
  if (minLabel) {
    bullets.push(t('card.depositBulletMin', { amount: minLabel }));
  }

  bullets.push(
    t('card.depositBulletOwnAccount', {
      limit: formatBridgeLimitLabel(info.ownAccount, t),
    }),
  );
  bullets.push(
    t('card.depositBulletAnotherPerson', {
      limit: formatBridgeLimitLabel(info.anotherPerson, t),
    }),
  );
  bullets.push(
    t('card.depositBulletBusiness', {
      limit: formatBridgeLimitLabel(info.business, t),
    }),
  );

  const arrivalKey = resolveBridgeArrivalKey(currency, opts.paymentRails);
  const arrival = t(`card.bridgeArrival.${arrivalKey}`, { defaultValue: '' });
  if (arrival) {
    bullets.push(t('card.depositBulletArrive', { timing: arrival }));
  }

  if (opts.feeLabel) {
    bullets.push(t('card.depositBulletFee', { fee: opts.feeLabel }));
  }

  return bullets;
}

export function buildBridgeUsdtDepositBullets(
  t: TFunction,
  opts: {
    minDeposit?: MinDeposit | null;
    feeLabel?: string | null;
  },
): string[] {
  const bullets: string[] = [];
  const minLabel = resolveMinDepositLabel(opts.minDeposit, BRIDGE_CRYPTO_USDT_DEPOSIT.docMin);
  if (minLabel) {
    bullets.push(t('card.depositBulletMin', { amount: minLabel }));
  }

  const arrival = t(`card.bridgeArrival.${BRIDGE_CRYPTO_USDT_DEPOSIT.arrivalKey}`, { defaultValue: '' });
  if (arrival) {
    bullets.push(t('card.depositBulletArrive', { timing: arrival }));
  }

  if (opts.feeLabel) {
    bullets.push(t('card.depositBulletFee', { fee: opts.feeLabel }));
  }

  return bullets;
}
