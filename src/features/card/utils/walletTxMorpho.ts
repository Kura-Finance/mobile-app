/**
 * Morpho Blue + Earn vault address detection and activity classification.
 */

import { defaultMorphoEarnVaultAddressSet } from '../../../config/morphoVaultAddresses';
import type { WalletTx } from '../hooks/useWalletHistory';
import type { WalletActivityKind } from './walletTxEnrichment';
import { isUsdPeggedSymbol, maxWalletTxLeg, tokenSymbolUpper } from './walletTxConstants';

/** Morpho Blue singleton — keep in sync with lib/wallet/morphoBlue.ts */
export const MORPHO_BLUE_ADDRESS =
  '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const;

function norm(addr: string | undefined): string {
  return (addr ?? '').toLowerCase();
}

function sym(token: string): string {
  return tokenSymbolUpper(token);
}

/** Legacy Kura Morpho fee-wrapper share tokens (historical activity only). */
export function isMorphoEarnShareSymbol(symbol: string): boolean {
  const s = sym(symbol);
  // e.g. KGTUSDCF — former Kura Gauntlet USDC fee-wrapper shares
  return /^KGT[A-Z0-9]+F$/i.test(s);
}

/** Underlying asset ticker embedded in a legacy fee-wrapper share symbol, when present. */
export function morphoEarnShareUnderlyingSymbol(symbol: string): string | null {
  const s = sym(symbol);
  const match = s.match(/^KGT(.+)F$/i);
  if (!match) return null;
  const underlying = match[1];
  return isUsdPeggedSymbol(underlying) ? underlying : null;
}

const morphoBlueSet = new Set([MORPHO_BLUE_ADDRESS.toLowerCase()]);

let earnVaultSet: Set<string> | null = null;

function getEarnVaultAddresses(): Set<string> {
  if (!earnVaultSet) {
    earnVaultSet = defaultMorphoEarnVaultAddressSet();
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
  return maxWalletTxLeg(legs);
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

  const loanOuts = outs.filter((l) => isUsdPeggedSymbol(l.tokenSymbol));
  const loanIns = ins.filter((l) => isUsdPeggedSymbol(l.tokenSymbol));
  const collOuts = outs.filter((l) => !isUsdPeggedSymbol(l.tokenSymbol));
  const collIns = ins.filter((l) => !isUsdPeggedSymbol(l.tokenSymbol));

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

/** USDC/EURC ↔ fee-wrapper share mint/burn in the same tx hash. */
export function tryClassifyMorphoEarnShareFlow(legs: WalletTx[]): WalletTx[] | null {
  if (legs.length === 0) return null;

  const outs = legs.filter((l) => l.direction === 'out');
  const ins = legs.filter((l) => l.direction === 'in');

  const stableOuts = outs.filter(
    (l) => isUsdPeggedSymbol(l.tokenSymbol) && !isMorphoEarnShareSymbol(l.tokenSymbol),
  );
  const stableIns = ins.filter(
    (l) => isUsdPeggedSymbol(l.tokenSymbol) && !isMorphoEarnShareSymbol(l.tokenSymbol),
  );
  const shareIns = ins.filter((l) => isMorphoEarnShareSymbol(l.tokenSymbol));
  const shareOuts = outs.filter((l) => isMorphoEarnShareSymbol(l.tokenSymbol));

  if (stableOuts.length > 0 && shareIns.length > 0) {
    const leg = maxLeg(stableOuts);
    return [
      buildMorphoActivity(
        leg,
        'deposit',
        { symbol: leg.tokenSymbol, amount: leg.amount, direction: 'out' },
        { key: 'card.txDetailMorphoEarnDeposit' },
        'earn',
      ),
    ];
  }

  if (shareOuts.length > 0 && stableIns.length > 0) {
    const leg = maxLeg(stableIns);
    return [
      buildMorphoActivity(
        leg,
        'withdraw',
        { symbol: leg.tokenSymbol, amount: leg.amount, direction: 'in' },
        { key: 'card.txDetailMorphoEarnWithdraw' },
        'earn',
      ),
    ];
  }

  return null;
}

function classifyMorphoEarnLegs(earnLegs: WalletTx[]): WalletTx[] {
  if (earnLegs.length === 0) return [];

  const shareFlow = tryClassifyMorphoEarnShareFlow(earnLegs);
  if (shareFlow) return shareFlow;

  const outs = earnLegs.filter(
    (l) => l.direction === 'out' && !isMorphoEarnShareSymbol(l.tokenSymbol),
  );
  const ins = earnLegs.filter(
    (l) => l.direction === 'in' && !isMorphoEarnShareSymbol(l.tokenSymbol),
  );
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
