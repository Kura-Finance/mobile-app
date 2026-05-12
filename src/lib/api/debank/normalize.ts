/**
 * Normalise the raw DeBank OpenAPI shapes (carried in each decrypted row's
 * `rawData`) to flat, predictable UI types.
 *
 * Ported from WebClient/app/lib/debankApi.ts. The upstream JSON is sprawling
 * (multiple list keys: `token_list / asset_list / supply_token_list /
 * borrow_token_list / reward_token_list / portfolio_item_list / detail`) and
 * field names vary (`logo_url` vs `logo`, `optimized_symbol` vs `symbol`,
 * `chain` vs `chain_id`, etc.). Single-source the normalisation here so the
 * store / UI never reaches into the raw shape directly.
 */

import type {
  DeBankProtocol,
  DeBankProtocolAsset,
  DeBankToken,
} from './types';

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Normalise + validate an EVM address. Throws if it can't be coerced into the
 * canonical `0x` + 40 lowercase hex form.
 */
export function normalizeEvmAddress(address: string): string {
  const trimmed = (address || '').trim().toLowerCase();
  if (!EVM_ADDRESS_RE.test(trimmed)) {
    throw new Error('Invalid EVM address (expected 0x + 40 hex chars)');
  }
  return trimmed;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeDeBankToken(opts: {
  rawData: unknown;
  symbol: string;
  chain: string;
  tokenId: string;
  cachedAt: string;
}): DeBankToken | null {
  const raw = toRecord(opts.rawData);
  if (!raw) return null;

  const symbol = toStringValue(
    raw.optimized_symbol ?? raw.symbol,
    opts.symbol || 'TOKEN',
  );
  const name = toStringValue(raw.name, symbol);
  const amount = toNumber(raw.amount ?? raw.balance ?? raw.raw_amount);
  const price = toNumber(raw.price ?? raw.price_usd ?? raw.usd_price);
  const chain = toStringValue(raw.chain ?? raw.chain_id, opts.chain);
  const id =
    toStringValue(raw.id) ||
    toStringValue(raw.token_id) ||
    opts.tokenId ||
    `${chain || 'evm'}-${symbol.toLowerCase()}`;
  const logo = toStringValue(raw.logo_url) || toStringValue(raw.logo);
  const protocolId = toStringValue(raw.protocol_id);
  const isWallet = raw.is_wallet !== false;

  return {
    id,
    symbol,
    name,
    amount,
    price,
    logo,
    chain,
    protocolId,
    isWallet,
    cachedAt: opts.cachedAt,
  };
}

function normalizeProtocolAsset(raw: unknown, fallbackId: string): DeBankProtocolAsset | null {
  const token = toRecord(raw);
  if (!token) return null;

  const symbol = toStringValue(token.optimized_symbol ?? token.symbol, 'ASSET');
  const name = toStringValue(token.name, symbol);
  const amount = toNumber(token.amount ?? token.balance ?? token.raw_amount);
  const price = toNumber(token.price ?? token.price_usd ?? token.usd_price);
  const explicitUsd = toNumber(token.usd_value ?? token.net_usd_value ?? token.value);
  const usdValue = explicitUsd > 0 ? explicitUsd : amount * price;
  const id = toStringValue(token.id) || toStringValue(token.token_id) || `${fallbackId}-${symbol.toLowerCase()}`;
  const logo = toStringValue(token.logo_url) || toStringValue(token.logo);

  return { id, symbol, name, amount, price, usdValue, logo };
}

/**
 * DeBank repeats the same token across summary lists (`token_list`) and typed
 * lists (`supply_token_list`, etc.). Pick one canonical source per position.
 */
function collectTokensFromRecord(record: Record<string, unknown>): unknown[] {
  const supply = arrayOrEmpty<unknown>(record.supply_token_list);
  const borrow = arrayOrEmpty<unknown>(record.borrow_token_list);
  const reward = arrayOrEmpty<unknown>(record.reward_token_list);
  const assetTokens = arrayOrEmpty<unknown>(record.asset_token_list);
  const assetList = arrayOrEmpty<unknown>(record.asset_list);
  const tokenList = arrayOrEmpty<unknown>(record.token_list);

  const hasTypedLending = supply.length > 0 || borrow.length > 0 || reward.length > 0;
  const hasLiquidity = assetTokens.length > 0 || assetList.length > 0;

  if (hasTypedLending) {
    return [...supply, ...borrow, ...reward];
  }
  if (hasLiquidity) {
    return [...assetTokens, ...assetList];
  }
  return tokenList;
}

/** Drop identical rows that appear in both summary and typed token lists. */
function dedupeRawTokenEntries(entries: unknown[]): unknown[] {
  const seen = new Set<string>();
  const result: unknown[] = [];

  for (const entry of entries) {
    const raw = toRecord(entry);
    if (!raw) continue;

    const id = toStringValue(raw.id) || toStringValue(raw.token_id);
    const symbol = toStringValue(raw.optimized_symbol ?? raw.symbol, 'ASSET');
    const amount = toNumber(raw.amount ?? raw.balance ?? raw.raw_amount);
    const key = id ? `${id}|${amount}` : `${symbol}|${amount}`;

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }

  return result;
}

function extractTokensFromPortfolioItem(itemRecord: Record<string, unknown>): unknown[] {
  const itemDetail = toRecord(itemRecord.detail);
  const fromDetail = itemDetail ? collectTokensFromRecord(itemDetail) : [];
  const fromItem = collectTokensFromRecord(itemRecord);
  const candidates = fromDetail.length > 0 ? fromDetail : fromItem;
  return dedupeRawTokenEntries(candidates);
}

function extractPortfolioItems(
  raw: Record<string, unknown>,
  protocolId: string,
): DeBankProtocol['portfolioItems'] {
  const detail = toRecord(raw.detail);
  const topLevelItems = arrayOrEmpty<unknown>(raw.portfolio_item_list);
  const detailItems = arrayOrEmpty<unknown>(detail?.portfolio_item_list);
  const portfolioItems = topLevelItems.length > 0 ? topLevelItems : detailItems;

  return portfolioItems.flatMap((item, itemIndex) => {
    const itemRecord = toRecord(item);
    if (!itemRecord) return [];
    const itemStats = toRecord(itemRecord.stats);

    const tokens = extractTokensFromPortfolioItem(itemRecord)
      .map((token, tokenIndex) =>
        normalizeProtocolAsset(token, `${protocolId}-item-${itemIndex}-asset-${tokenIndex}`),
      )
      .filter((asset): asset is DeBankProtocolAsset => Boolean(asset));

    return [
      {
        type: toStringValue(itemRecord.name, 'position'),
        tokens,
        usdValue: toNumber(itemStats?.net_usd_value ?? itemRecord.usd_value),
      },
    ];
  });
}

export function normalizeDeBankProtocol(opts: {
  rawData: unknown;
  protocolId: string;
  chain: string;
  cachedAt: string;
}): DeBankProtocol | null {
  const raw = toRecord(opts.rawData);
  if (!raw) return null;

  const stats = toRecord(raw.stats);
  const id =
    toStringValue(raw.id) ||
    toStringValue(raw.protocol_id) ||
    opts.protocolId ||
    toStringValue(raw.name, 'protocol').toLowerCase().replace(/\s+/g, '-');
  const name = toStringValue(raw.name, 'Protocol Position');
  const netUsdValue = toNumber(
    raw.net_usd_value ?? stats?.net_usd_value ?? raw.usd_value ?? raw.value,
  );
  const assetUsdValue = toNumber(raw.asset_usd_value ?? stats?.asset_usd_value);
  const debtUsdValue = toNumber(raw.debt_usd_value ?? stats?.debt_usd_value);
  const chain = toStringValue(raw.chain ?? raw.chain_id, opts.chain);
  const logo = toStringValue(raw.logo_url) || toStringValue(raw.logo);
  const siteUrl = toStringValue(raw.site_url);
  const portfolioItems = extractPortfolioItems(raw, id);

  return {
    id,
    name,
    netUsdValue,
    assetUsdValue,
    debtUsdValue,
    chain,
    logo,
    siteUrl,
    portfolioItems,
    cachedAt: opts.cachedAt,
  };
}
