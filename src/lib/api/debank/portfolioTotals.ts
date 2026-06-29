/**
 * DeBank portfolio total helpers.
 *
 * Wallet totals are computed from normalized token + protocol rows so the UI
 * matches what users see and avoids double-counting mint/receipt tokens that
 * DeBank also reports inside protocol positions.
 *
 * Rules:
 * - Protocol netUsdValue !== 0 → count protocol net; skip linked mint tokens.
 * - Protocol netUsdValue === 0 → count linked mint tokens; protocol header uses
 *   portfolio item token sums for display.
 */

import type { DeBankProtocol, DeBankToken } from './types';

export function tokenUsdValue(token: DeBankToken): number {
  return token.amount * token.price;
}

/** Sum every token row without protocol de-duplication. */
export function sumTokenTotalUsd(tokens: DeBankToken[]): number {
  return tokens.reduce((sum, token) => sum + tokenUsdValue(token), 0);
}

function protocolsMatch(tokenProtocolId: string, protocolId: string): boolean {
  const tokenPid = tokenProtocolId.toLowerCase();
  const protocolPid = protocolId.toLowerCase();
  if (!tokenPid || !protocolPid) return false;
  if (tokenPid === protocolPid) return true;
  if (
    protocolPid.endsWith(`_${tokenPid}`) ||
    protocolPid.startsWith(`${tokenPid}_`) ||
    tokenPid.endsWith(`_${protocolPid}`) ||
    tokenPid.startsWith(`${protocolPid}_`)
  ) {
    return true;
  }
  const tokenBase = tokenPid.split(/[-_]/)[0] ?? '';
  const protocolBase = protocolPid.split(/[-_]/)[0] ?? '';
  return tokenBase.length > 2 && tokenBase === protocolBase;
}

export function findLinkedProtocol(
  token: DeBankToken,
  protocols: DeBankProtocol[],
): DeBankProtocol | undefined {
  if (!token.protocolId) return undefined;
  return protocols.find((p) => protocolsMatch(token.protocolId, p.id));
}

/** Count wallet / mint tokens; skip receipt tokens when protocol net already covers them. */
export function shouldCountTokenInSpotTotal(
  token: DeBankToken,
  protocols: DeBankProtocol[],
): boolean {
  if (!token.protocolId) return true;
  const linked = findLinkedProtocol(token, protocols);
  if (!linked) return true;
  return linked.netUsdValue <= 0;
}

/** Spot token rows that belong in allocation (excludes protocol-linked receipt tokens). */
export function shouldIncludeSpotTokenInAllocation(
  protocolId: string,
  protocols: Array<Pick<DeBankProtocol, 'id' | 'netUsdValue'>>,
): boolean {
  if (!protocolId) return true;
  const linked = protocols.find((p) => protocolsMatch(protocolId, p.id));
  if (!linked) return true;
  return linked.netUsdValue <= 0;
}

export function computeTokenSpotTotal(
  tokens: DeBankToken[],
  protocols: DeBankProtocol[],
): number {
  return tokens.reduce((sum, token) => {
    if (shouldCountTokenInSpotTotal(token, protocols)) {
      return sum + tokenUsdValue(token);
    }
    return sum;
  }, 0);
}

/** Sum protocol net values; zero-net mint-only rows stay in the token total. */
export function computeProtocolSpotTotal(protocols: DeBankProtocol[]): number {
  return protocols.reduce((sum, protocol) => {
    if (protocol.netUsdValue !== 0) {
      return sum + protocol.netUsdValue;
    }
    return sum;
  }, 0);
}

export function computeWalletPortfolioTotals(
  tokens: DeBankToken[],
  protocols: DeBankProtocol[],
): { tokenTotalUsd: number; protocolTotalUsd: number; totalUsd: number } {
  const tokenTotalUsd = computeTokenSpotTotal(tokens, protocols);
  const protocolTotalUsd = computeProtocolSpotTotal(protocols);
  return {
    tokenTotalUsd,
    protocolTotalUsd,
    totalUsd: tokenTotalUsd + protocolTotalUsd,
  };
}

export function sumProtocolPortfolioItemTokensUsd(protocol: {
  portfolioItems: Array<{ tokens: Array<{ usdValue: number }> }>;
}): number {
  return protocol.portfolioItems.reduce(
    (sum, item) => sum + item.tokens.reduce((itemSum, token) => itemSum + token.usdValue, 0),
    0,
  );
}

/** Protocol card header: use net when set, otherwise portfolio item token sums. */
export function effectiveProtocolDisplayUsd(protocol: {
  netUsdValue: number;
  portfolioItems: Array<{ tokens: Array<{ usdValue: number }>; usdValue: number }>;
}): number {
  if (protocol.netUsdValue !== 0) {
    return protocol.netUsdValue;
  }
  const tokenSum = sumProtocolPortfolioItemTokensUsd(protocol);
  if (tokenSum > 0) return tokenSum;
  return protocol.portfolioItems.reduce((sum, item) => sum + item.usdValue, 0);
}

export function walletPortfolioTotalUsd(
  tokenTotal: number,
  protocolEnvelopeTotal: number,
): number {
  return tokenTotal + protocolEnvelopeTotal;
}
