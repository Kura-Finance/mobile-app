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

/** Morpho / vault receipt tokens held in wallet (e.g. KGTUSDCF fee-wrapper shares). */
export function isProtocolVaultShareToken(
  token: Pick<DeBankToken, 'protocolId' | 'symbol'>,
): boolean {
  if (token.protocolId?.trim()) return true;
  return /^KGT[A-Z0-9]+F$/i.test(token.symbol.trim());
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

/** Count wallet spot; skip vault/receipt tokens covered by a protocol row. */
export function shouldCountTokenInSpotTotal(
  token: DeBankToken,
  protocols: DeBankProtocol[],
): boolean {
  if (isProtocolVaultShareToken(token)) {
    if (!token.protocolId) return false;
    const linked = findLinkedProtocol(token, protocols);
    if (!linked) return false;
    return effectiveProtocolDisplayUsd(linked) <= 0;
  }
  if (!token.protocolId) return true;
  const linked = findLinkedProtocol(token, protocols);
  if (!linked) return true;
  if (effectiveProtocolDisplayUsd(linked) > 0) return false;
  return linked.netUsdValue <= 0;
}

/** Minimal protocol shape for allocation dedupe (UI + API models). */
type ProtocolForAllocation = {
  id: string;
  netUsdValue: number;
  portfolioItems: { tokens: { usdValue: number }[]; usdValue: number }[];
};

/** Spot token rows that belong in allocation / token list (excludes protocol vault shares). */
export function shouldIncludeSpotTokenInAllocation(
  token: Pick<DeBankToken, 'protocolId' | 'symbol'>,
  protocols: ProtocolForAllocation[],
): boolean {
  if (isProtocolVaultShareToken(token)) return false;
  if (!token.protocolId) return true;
  const linked = protocols.find((p) => protocolsMatch(token.protocolId, p.id));
  if (!linked) return true;
  if (effectiveProtocolDisplayUsd(linked) > 0) return false;
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

/** Sum protocol display values (net or portfolio item breakdown). */
export function computeProtocolSpotTotal(protocols: DeBankProtocol[]): number {
  return protocols.reduce(
    (sum, protocol) => sum + effectiveProtocolDisplayUsd(protocol),
    0,
  );
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
  portfolioItems: { tokens: { usdValue: number }[] }[];
}): number {
  return protocol.portfolioItems.reduce(
    (sum, item) => sum + item.tokens.reduce((itemSum, token) => itemSum + token.usdValue, 0),
    0,
  );
}

/** Protocol card header: use net when set, otherwise portfolio item token sums. */
export function effectiveProtocolDisplayUsd(protocol: {
  netUsdValue: number;
  portfolioItems: { tokens: { usdValue: number }[]; usdValue: number }[];
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
