/**
 * Client-side aggregation for the Phase 3 encrypted asset history.
 *
 * Backend stores **one row per metric per snapshot**, where the `metric`
 * field is either:
 *   - Base name (single source):       `cashFlow` | `plaidInvestment`
 *   - Sub-scoped (multi-source):       `{base}:{source}:{id}`
 *                                      e.g. `cryptoSpot:exchange:acct-123`,
 *                                           `cryptoSpot:debank:0xabc...`,
 *                                           `defiProtocol:debank:0xabc...`
 *
 * The aggregator turns a flat list of decrypted rows into one point per
 * UTC day, with four base-metric columns plus a `totalAssets` sum.
 *
 * Rules (per backend spec):
 *   1. Day bucket by `recordedAt` (UTC `YYYY-MM-DD`).
 *   2. Within a day, for **each** sub-scoped key, keep only the latest
 *      `recordedAt` — this de-duplicates repeated syncs.
 *   3. Within a day, for each base metric, **sum** all distinct sub-scoped
 *      values (e.g. cryptoSpot across exchange + multiple wallets).
 *   4. `totalAssets` = `plaidInvestment` + `cryptoSpot` only (net-worth curve).
 *   5. If a base metric has no row on a given day, the value falls back to
 *      the most recent prior day's value when `carryForward` is enabled,
 *      otherwise to `0`.
 */

export const ASSET_METRIC_BASES = [
  'cashFlow',
  'plaidInvestment',
  'cryptoSpot',
  'defiProtocol',
] as const;

/** Net-worth curve uses only these two metrics (backend spec). */
export const NET_WORTH_METRIC_BASES = ['plaidInvestment', 'cryptoSpot'] as const;

export type AssetMetricBase = (typeof ASSET_METRIC_BASES)[number];

const ASSET_METRIC_BASE_SET = new Set<string>(ASSET_METRIC_BASES);

export interface DecryptedAssetSnapshot {
  id: string;
  /** Either a base metric name or `{base}:{source}:{id}`. */
  metric: string;
  /** ISO timestamp; UTC day used for bucketing. */
  recordedAt: string;
  value: number;
}

export interface AssetHistoryPoint {
  /** UTC `YYYY-MM-DD`. */
  date: string;
  cashFlow: number;
  plaidInvestment: number;
  cryptoSpot: number;
  defiProtocol: number;
  /** Sum of all four base metrics. */
  totalAssets: number;
}

export interface AggregationOptions {
  /**
   * If true, days that have no row for a given base metric inherit the most
   * recent prior day's value. Useful for drawing a continuous chart even
   * when sync didn't run every day.
   *
   * Default: true.
   */
  carryForward?: boolean;
  /**
   * If non-empty, restrict output to these UTC days, ordered ascending.
   * Days with no underlying data still show up (zeroed or carried).
   *
   * If omitted, output uses the natural set of UTC days observed in the
   * input rows, ordered ascending.
   */
  days?: string[];
}

export interface MetricKeyParts {
  base: AssetMetricBase | null;
  /** Sub-scope without the leading base prefix; `null` for pure base rows. */
  subScope: string | null;
  /** True if the parsed base is one of the four supported bases. */
  isSupported: boolean;
}

/**
 * Parse `metric` into `{ base, subScope }`. Unknown bases come back with
 * `base: null` so callers can decide whether to drop or surface as warning.
 */
export function parseMetricKey(metric: string): MetricKeyParts {
  const idx = metric.indexOf(':');
  if (idx === -1) {
    const isSupported = ASSET_METRIC_BASE_SET.has(metric);
    return {
      base: isSupported ? (metric as AssetMetricBase) : null,
      subScope: null,
      isSupported,
    };
  }
  const head = metric.slice(0, idx);
  const tail = metric.slice(idx + 1);
  const isSupported = ASSET_METRIC_BASE_SET.has(head);
  return {
    base: isSupported ? (head as AssetMetricBase) : null,
    subScope: tail,
    isSupported,
  };
}

function toUtcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function emptyBaseTotals(): Record<AssetMetricBase, number> {
  return {
    cashFlow: 0,
    plaidInvestment: 0,
    cryptoSpot: 0,
    defiProtocol: 0,
  };
}

/**
 * Group rows by `(day, base, subScopeKey)` keeping only the latest
 * `recordedAt` per group, then sum across sub-scopes within each
 * `(day, base)`.
 *
 * The pure-base case is treated as `subScopeKey = '__base__'` so a pure
 * `cashFlow` row coexists with `cashFlow:scope:x` sub-scoped rows.
 */
/**
 * Returned shape: only the (day, base) pairs that actually have rows. The
 * caller decides what to do with absent (day, base) combos (zero or carry).
 */
function reduceRowsToDailyBaseTotals(
  rows: DecryptedAssetSnapshot[],
): Map<string, Partial<Record<AssetMetricBase, number>>> {
  // (day -> (base -> (subScopeKey -> { value, recordedAt })))
  const latestPerSubScope = new Map<
    string,
    Map<AssetMetricBase, Map<string, { value: number; recordedAt: number }>>
  >();

  for (const row of rows) {
    const parsed = parseMetricKey(row.metric);
    if (!parsed.base) continue;

    const day = toUtcDay(row.recordedAt);
    const baseMap =
      latestPerSubScope.get(day) ?? new Map<AssetMetricBase, Map<string, { value: number; recordedAt: number }>>();
    if (!latestPerSubScope.has(day)) latestPerSubScope.set(day, baseMap);

    const subMap =
      baseMap.get(parsed.base) ?? new Map<string, { value: number; recordedAt: number }>();
    if (!baseMap.has(parsed.base)) baseMap.set(parsed.base, subMap);

    const subScopeKey = parsed.subScope ?? '__base__';
    const existing = subMap.get(subScopeKey);
    const recordedAtMs = new Date(row.recordedAt).getTime();
    if (!existing || recordedAtMs > existing.recordedAt) {
      subMap.set(subScopeKey, { value: row.value, recordedAt: recordedAtMs });
    }
  }

  const result = new Map<string, Partial<Record<AssetMetricBase, number>>>();
  for (const [day, baseMap] of latestPerSubScope) {
    const totals: Partial<Record<AssetMetricBase, number>> = {};
    for (const [base, subMap] of baseMap) {
      let sum = 0;
      for (const { value } of subMap.values()) sum += value;
      totals[base] = sum;
    }
    result.set(day, totals);
  }
  return result;
}

export function aggregateAssetHistory(
  rows: DecryptedAssetSnapshot[],
  options: AggregationOptions = {},
): AssetHistoryPoint[] {
  const carryForward = options.carryForward ?? true;

  const dailyTotals = reduceRowsToDailyBaseTotals(rows);

  const orderedDays = options.days && options.days.length > 0
    ? [...options.days].sort()
    : [...dailyTotals.keys()].sort();

  const last = emptyBaseTotals();
  const points: AssetHistoryPoint[] = [];

  for (const day of orderedDays) {
    const observed = dailyTotals.get(day);
    const next = emptyBaseTotals();

    for (const base of ASSET_METRIC_BASES) {
      if (observed && Object.prototype.hasOwnProperty.call(observed, base)) {
        next[base] = observed[base] as number;
      } else if (carryForward) {
        next[base] = last[base];
      } else {
        next[base] = 0;
      }
      last[base] = next[base];
    }

    const totalAssets = NET_WORTH_METRIC_BASES.reduce((sum, base) => sum + next[base], 0);
    points.push({
      date: day,
      cashFlow: next.cashFlow,
      plaidInvestment: next.plaidInvestment,
      cryptoSpot: next.cryptoSpot,
      defiProtocol: next.defiProtocol,
      totalAssets,
    });
  }

  return points;
}

/**
 * Convenience: extract the contiguous list of UTC days observed across rows
 * (ascending), useful for callers that want the natural day window.
 */
export function uniqueUtcDays(rows: DecryptedAssetSnapshot[]): string[] {
  const seen = new Set<string>();
  for (const r of rows) seen.add(toUtcDay(r.recordedAt));
  return [...seen].sort();
}
