/**
 * Morpho Blue + Earn vault address detection and activity classification.
 */

import type { WalletTx } from '../hooks/useWalletHistory';
import type { WalletActivityKind } from './walletTxEnrichment';

/** Morpho Blue singleton — keep in sync with lib/wallet/morphoBlue.ts */
export const MORPHO_BLUE_ADDRESS =
  '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const;

/** Default inner Morpho vaults on Base — keep in sync with config/earn.ts allowlist. */
const DEFAULT_MORPHO_EARN_VAULTS = [
  '0xbeef0e0834849aCC03f0089F01f4F1Eeb06873C9',
  '0x94Af495DE1F56Aa5576dEB17986bDCeE5Dd9778D',
  '0x050cE30b927Da55177A4914EC73480238BAD56f0',
  '0x1deEfABEe758AAbdC29a542B24ca3b75aFD56765',
] as const;

/** Inner → fee-wrapper vault map — keep in sync with config/earnFeeWrapper.ts defaults. */
const DEFAULT_MORPHO_FEE_WRAPPER_OVERRIDES: Record<string, string> = {
  '0xbeef0e0834849aCC03f0089F01f4F1Eeb06873C9': '0x0F457aa0AfD3D208cbfEE520804118f88965a529',
  '0x94Af495DE1F56Aa5576dEB17986bDCeE5Dd9778D': '0x6D10990b11f88EE40e4ABc2f8CbE1f7194190Db0',
  '0x050cE30b927Da55177A4914EC73480238BAD56f0': '0x50e8B8B50037322BE0Efc2048d66Cb957f349816',
  '0x1deEfABEe758AAbdC29a542B24ca3b75aFD56765': '0x07540AeeD4B12408c87365417aE7CE59A966CA47',
};

const USD_PEGGED = new Set([
  'USDC', 'USDT', 'DAI', 'USDBC', 'USD+', 'EURC', 'USDC.E', 'USDBC.E',
]);

function norm(addr: string | undefined): string {
  return (addr ?? '').toLowerCase();
}

function sym(token: string): string {
  return token.toUpperCase();
}

function isUsdPegged(token: string): boolean {
  return USD_PEGGED.has(sym(token));
}

const morphoBlueSet = new Set([MORPHO_BLUE_ADDRESS.toLowerCase()]);

let earnVaultSet: Set<string> | null = null;

function getEarnVaultAddresses(): Set<string> {
  if (!earnVaultSet) {
    earnVaultSet = new Set<string>();
    for (const addr of DEFAULT_MORPHO_EARN_VAULTS) {
      earnVaultSet.add(addr.toLowerCase());
    }
    for (const [inner, wrapper] of Object.entries(DEFAULT_MORPHO_FEE_WRAPPER_OVERRIDES)) {
      earnVaultSet.add(inner.toLowerCase());
      earnVaultSet.add(wrapper.toLowerCase());
    }
  }
  return earnVaultSet;
}

export function isMorphoBlueAddress(address: string | undefined): boolean {
  return !!address && morphoBlueSet.has(norm(address));
}

export function isMorphoEarnVaultAddress(address: string | undefined): boolean {
  return !!address && getEarnVaultAddresses().has(norm(address));
}

export function touchesMorphoBlue(
  tx: Pick<WalletTx, 'counterparty' | 'fromAddress' | 'toAddress'>,
): boolean {
  return (
    isMorphoBlueAddress(tx.counterparty)
    || isMorphoBlueAddress(tx.fromAddress)
    || isMorphoBlueAddress(tx.toAddress)
  );
}

export function touchesMorphoEarnVault(
  tx: Pick<WalletTx, 'counterparty' | 'fromAddress' | 'toAddress'>,
): boolean {
  return (
    isMorphoEarnVaultAddress(tx.counterparty)
    || isMorphoEarnVaultAddress(tx.fromAddress)
    || isMorphoEarnVaultAddress(tx.toAddress)
  );
}

function maxLeg(legs: WalletTx[]): WalletTx {
  return legs.reduce((best, leg) => (leg.amount > best.amount ? leg : best), legs[0]);
}

export type MorphoActivitySubkind = 'earn' | 'borrow_collateral';

function buildMorphoActivity(
  base: WalletTx,
  kind: WalletActivityKind,
  display: { symbol: string; amount: number; direction: WalletTx['direction'] },
  detail: { key: string; params?: Record<string, string> },
  subkind?: MorphoActivitySubkind,
): WalletTx {
  return {
    ...base,
    id: `activity-${base.hash}-${kind}-${sym(display.symbol)}-${display.direction}`,
    activityKind: kind,
    activitySubkind: subkind,
    direction: display.direction,
    tokenSymbol: display.symbol,
    amount: display.amount,
    counterpartyName: null,
    activityDetailKey: detail.key,
    activityDetailParams: detail.params,
    swapFromSymbol: undefined,
    swapToSymbol: undefined,
  };
}

function classifyMorphoBlueLegs(blueLegs: WalletTx[]): WalletTx[] {
  if (blueLegs.length === 0) return [];

  const outs = blueLegs.filter((l) => l.direction === 'out');
  const ins = blueLegs.filter((l) => l.direction === 'in');

  const loanOuts = outs.filter((l) => isUsdPegged(l.tokenSymbol));
  const loanIns = ins.filter((l) => isUsdPegged(l.tokenSymbol));
  const collOuts = outs.filter((l) => !isUsdPegged(l.tokenSymbol));
  const collIns = ins.filter((l) => !isUsdPegged(l.tokenSymbol));

  const result: WalletTx[] = [];
  const pairedCollateralBorrow = loanIns.length > 0 && collOuts.length > 0;

  if (loanIns.length > 0) {
    const leg = maxLeg(loanIns);
    const collateral = pairedCollateralBorrow ? maxLeg(collOuts) : null;
    result.push(
      buildMorphoActivity(
        leg,
        'borrow',
        { symbol: leg.tokenSymbol, amount: leg.amount, direction: 'in' },
        collateral
          ? {
              key: 'card.txDetailMorphoBorrowWithCollateral',
              params: { symbol: sym(collateral.tokenSymbol) },
            }
          : { key: 'card.txDetailMorphoBorrow' },
      ),
    );
  }

  if (loanOuts.length > 0) {
    const leg = maxLeg(loanOuts);
    result.push(
      buildMorphoActivity(
        leg,
        'repay',
        { symbol: leg.tokenSymbol, amount: leg.amount, direction: 'out' },
        { key: 'card.txDetailMorphoRepay' },
      ),
    );
  }

  if (collOuts.length > 0 && !pairedCollateralBorrow) {
    const leg = maxLeg(collOuts);
    result.push(
      buildMorphoActivity(
        leg,
        'deposit',
        { symbol: leg.tokenSymbol, amount: leg.amount, direction: 'out' },
        { key: 'card.txDetailMorphoCollateralDeposit' },
        'borrow_collateral',
      ),
    );
  }

  if (collIns.length > 0) {
    const leg = maxLeg(collIns);
    result.push(
      buildMorphoActivity(
        leg,
        'withdraw',
        { symbol: leg.tokenSymbol, amount: leg.amount, direction: 'in' },
        { key: 'card.txDetailMorphoCollateralWithdraw' },
        'borrow_collateral',
      ),
    );
  }

  return result;
}

function classifyMorphoEarnLegs(earnLegs: WalletTx[]): WalletTx[] {
  if (earnLegs.length === 0) return [];

  const outs = earnLegs.filter((l) => l.direction === 'out');
  const ins = earnLegs.filter((l) => l.direction === 'in');
  const result: WalletTx[] = [];

  if (outs.length > 0) {
    const leg = maxLeg(outs);
    result.push(
      buildMorphoActivity(
        leg,
        'deposit',
        { symbol: leg.tokenSymbol, amount: leg.amount, direction: 'out' },
        { key: 'card.txDetailMorphoEarnDeposit' },
        'earn',
      ),
    );
  }

  if (ins.length > 0) {
    const leg = maxLeg(ins);
    result.push(
      buildMorphoActivity(
        leg,
        'withdraw',
        { symbol: leg.tokenSymbol, amount: leg.amount, direction: 'in' },
        { key: 'card.txDetailMorphoEarnWithdraw' },
        'earn',
      ),
    );
  }

  return result;
}

/** Split hash legs into Morpho activities vs remaining on-chain legs. */
export function classifyMorphoActivities(
  legs: WalletTx[],
): { activities: WalletTx[]; otherLegs: WalletTx[] } {
  if (legs.length === 0) return { activities: [], otherLegs: [] };

  const morphoLegIds = new Set<string>();
  for (const leg of legs) {
    if (touchesMorphoBlue(leg) || touchesMorphoEarnVault(leg)) {
      morphoLegIds.add(leg.id);
    }
  }

  if (morphoLegIds.size === 0) return { activities: [], otherLegs: legs };

  const morphoLegs = legs.filter((l) => morphoLegIds.has(l.id));
  const otherLegs = legs.filter((l) => !morphoLegIds.has(l.id));

  const blueLegs = morphoLegs.filter(touchesMorphoBlue);
  const earnLegs = morphoLegs.filter((l) => touchesMorphoEarnVault(l) && !touchesMorphoBlue(l));

  return {
    activities: [...classifyMorphoBlueLegs(blueLegs), ...classifyMorphoEarnLegs(earnLegs)],
    otherLegs,
  };
}
