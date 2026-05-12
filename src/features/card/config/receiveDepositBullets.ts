import type { TFunction } from 'i18next';
import {
  buildBridgeFiatDepositBullets,
  buildBridgeUsdtDepositBullets,
} from '../../../lib/api/ramp/bridgeDepositInfo';
import type { FiatCurrency, MinDeposit } from '../../../lib/api/ramp/client';

export function buildFiatDepositBullets(
  currency: FiatCurrency,
  t: TFunction,
  opts: {
    minDeposit?: MinDeposit | null;
    feeLabel?: string | null;
    paymentRails?: string[] | null;
  },
): string[] {
  return buildBridgeFiatDepositBullets(currency, t, opts);
}

export function buildUsdtDepositBullets(
  t: TFunction,
  opts: {
    minDeposit?: MinDeposit | null;
    feeLabel?: string | null;
  },
): string[] {
  return buildBridgeUsdtDepositBullets(t, opts);
}
