function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Dinari returns 0 when there is no active bid/ask on the book. */
function parseQuotePrice(value: unknown): number | undefined {
  const n = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseQuoteSize(value: unknown): number | undefined {
  const n = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Unwrap common proxy / envelope shapes before reading quote fields. */
function unwrapQuotePayload(raw: unknown): Record<string, unknown> {
  if (!isObject(raw)) return {};

  const nested = raw.quote ?? raw.current_quote ?? raw.currentQuote ?? raw.data;
  if (isObject(nested) && (
    nested.bid_price != null
    || nested.ask_price != null
    || nested.bid != null
    || nested.ask != null
    || nested.bidPrice != null
    || nested.askPrice != null
    || nested.BidPrice != null
    || nested.AskPrice != null
  )) {
    return nested;
  }

  return raw;
}

/**
 * Map Dinari `StockQuote:v1/v2` payloads to UI fields.
 * Upstream uses snake_case (`bid_price`, `ask_price`); 0 means no resting quote.
 */
export function normalizeDinariStockQuote(raw: unknown): {
  bid?: number;
  ask?: number;
  spread?: number;
  bidSize?: number;
  askSize?: number;
  timestamp?: string;
} {
  const payload = unwrapQuotePayload(raw);

  const bid = parseQuotePrice(
    payload.bid ?? payload.bid_price ?? payload.bidPrice ?? payload.BidPrice,
  );
  const ask = parseQuotePrice(
    payload.ask ?? payload.ask_price ?? payload.askPrice ?? payload.AskPrice,
  );
  let spread = parseQuotePrice(
    payload.spread ?? payload.bid_ask_spread ?? payload.bidAskSpread,
  );
  if (spread == null && bid != null && ask != null) {
    spread = ask - bid;
  }

  const timestampRaw = payload.timestamp ?? payload.time_stamp ?? payload.TimeStamp;
  const timestamp = typeof timestampRaw === 'string'
    ? timestampRaw
    : timestampRaw instanceof Date
      ? timestampRaw.toISOString()
      : undefined;

  return {
    bid,
    ask,
    spread,
    bidSize: parseQuoteSize(
      payload.bid_size ?? payload.bidSize ?? payload.BidSize,
    ),
    askSize: parseQuoteSize(
      payload.ask_size ?? payload.askSize ?? payload.AskSize,
    ),
    timestamp,
  };
}

export function normalizeDinariStockPrice(raw: unknown): number | undefined {
  if (!isObject(raw)) return undefined;
  const payload = isObject(raw.data) && raw.price == null && raw.last_price == null
    ? raw.data
    : raw;
  return parseQuotePrice(
    payload.price ?? payload.lastPrice ?? payload.last_price ?? payload.fmv,
  );
}
