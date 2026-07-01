import type { DepositEvent, DepositEventType, DepositPayerInfo, DepositResult } from './client';

export interface DepositEventSource extends DepositPayerInfo {
  last4?: string | null;
  ibanLast4?: string | null;
}

export type NormalizedDepositEvent = DepositEvent;

export type NormalizedDepositResult = DepositResult;

function readNullableString(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const val = obj[key];
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed || null;
    }
  }
  return null;
}

function readRequiredString(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return undefined;
}

function parsePayerFields(raw: Record<string, unknown>): DepositPayerInfo {
  const accountLast4 =
    readNullableString(raw, 'accountLast4', 'account_last_4')
    ?? readNullableString(raw, 'last4', 'last_4', 'ibanLast4', 'iban_last_4');

  return {
    paymentRail: readNullableString(raw, 'paymentRail', 'payment_rail'),
    senderName: readNullableString(raw, 'senderName', 'sender_name'),
    accountLast4,
    senderBankRoutingNumber: readNullableString(
      raw,
      'senderBankRoutingNumber',
      'sender_bank_routing_number',
      'routingNumber',
      'routing_number',
      'bankRoutingNumber',
      'bank_routing_number',
    ),
    senderDescription: readNullableString(
      raw,
      'senderDescription',
      'sender_description',
      'description',
    ),
  };
}

function hasPayerInfo(info: DepositPayerInfo): boolean {
  return !!(
    info.paymentRail
    || info.senderName
    || info.accountLast4
    || info.senderBankRoutingNumber
    || info.senderDescription
  );
}

function mergePayerInfo(
  primary: DepositPayerInfo,
  fallback?: DepositPayerInfo,
): DepositPayerInfo {
  return {
    paymentRail: primary.paymentRail ?? fallback?.paymentRail ?? null,
    senderName: primary.senderName ?? fallback?.senderName ?? null,
    accountLast4: primary.accountLast4 ?? fallback?.accountLast4 ?? null,
    senderBankRoutingNumber:
      primary.senderBankRoutingNumber ?? fallback?.senderBankRoutingNumber ?? null,
    senderDescription:
      primary.senderDescription ?? fallback?.senderDescription ?? null,
  };
}

export function parseDepositEventSource(raw: unknown): DepositEventSource | null {
  if (raw === null || typeof raw !== 'object') return null;
  return parsePayerFields(raw as Record<string, unknown>);
}

export function normalizeDepositEvent(raw: unknown): NormalizedDepositEvent | null {
  if (raw === null || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const type = readRequiredString(row, 'type');
  if (!type) return null;

  const sourceRaw = row.source;
  const source = sourceRaw != null ? parseDepositEventSource(sourceRaw) : null;
  const direct = parsePayerFields(row);
  const payer = mergePayerInfo(direct, source ?? undefined);

  return {
    type: type as DepositEventType,
    amount: readNullableString(row, 'amount'),
    currency: readNullableString(row, 'currency'),
    subtotalAmount: readNullableString(row, 'subtotalAmount', 'subtotal_amount'),
    developerFeeAmount: readNullableString(row, 'developerFeeAmount', 'developer_fee_amount'),
    exchangeFeeAmount: readNullableString(row, 'exchangeFeeAmount', 'exchange_fee_amount'),
    gasFee: readNullableString(row, 'gasFee', 'gas_fee'),
    destinationTxHash: readNullableString(row, 'destinationTxHash', 'destination_tx_hash'),
    occurredAt: readNullableString(row, 'occurredAt', 'occurred_at'),
    ...payer,
  };
}

/** Client-side fallback when API top-level payer fields are still null (pre re-sync). */
export function extractPayerFromFundsReceived(
  events: NormalizedDepositEvent[],
): DepositPayerInfo | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type !== 'funds_received') continue;
    const fromEvent: DepositPayerInfo = {
      paymentRail: event.paymentRail,
      senderName: event.senderName,
      accountLast4: event.accountLast4,
      senderBankRoutingNumber: event.senderBankRoutingNumber,
      senderDescription: event.senderDescription,
    };
    if (hasPayerInfo(fromEvent)) return fromEvent;
  }
  return null;
}

export function normalizeDepositRecord(raw: unknown): NormalizedDepositResult | null {
  if (raw === null || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;

  const bridgeVirtualAccountId = readRequiredString(
    row,
    'bridgeVirtualAccountId',
    'bridge_virtual_account_id',
  );
  const status = readRequiredString(row, 'status');
  const createdAt = readRequiredString(row, 'createdAt', 'created_at');
  const updatedAt = readRequiredString(row, 'updatedAt', 'updated_at');
  if (!bridgeVirtualAccountId || !status || !createdAt || !updatedAt) {
    return null;
  }

  const depositId =
    readNullableString(row, 'depositId', 'deposit_id')
    ?? `${bridgeVirtualAccountId}:${createdAt}`;

  const eventsRaw = row.events;
  const events = Array.isArray(eventsRaw)
    ? eventsRaw
      .map(normalizeDepositEvent)
      .filter((event): event is NormalizedDepositEvent => event != null)
      .sort((a, b) => {
        const ta = a.occurredAt ? Date.parse(a.occurredAt) : 0;
        const tb = b.occurredAt ? Date.parse(b.occurredAt) : 0;
        return ta - tb;
      })
    : [];

  const topLevel = parsePayerFields(row);
  const fromFundsReceived = extractPayerFromFundsReceived(events);
  const payer = hasPayerInfo(topLevel)
    ? topLevel
    : mergePayerInfo(topLevel, fromFundsReceived ?? undefined);

  return {
    depositId,
    bridgeVirtualAccountId,
    status: status as DepositEventType,
    completed: row.completed === true,
    amount: readNullableString(row, 'amount'),
    currency: readNullableString(row, 'currency'),
    netAmount: readNullableString(row, 'netAmount', 'net_amount'),
    developerFeeAmount: readNullableString(row, 'developerFeeAmount', 'developer_fee_amount'),
    exchangeFeeAmount: readNullableString(row, 'exchangeFeeAmount', 'exchange_fee_amount'),
    gasFee: readNullableString(row, 'gasFee', 'gas_fee'),
    destinationTxHash: readNullableString(row, 'destinationTxHash', 'destination_tx_hash'),
    createdAt,
    updatedAt,
    events,
    ...payer,
  };
}

export function normalizeDepositsList(res: unknown): NormalizedDepositResult[] {
  const rows: unknown[] = Array.isArray(res)
    ? res
    : res !== null && typeof res === 'object'
      ? (['deposits', 'items', 'data'] as const)
        .map((key) => (res as Record<string, unknown>)[key])
        .find((val) => Array.isArray(val)) as unknown[] | undefined ?? []
      : [];

  return rows
    .map(normalizeDepositRecord)
    .filter((deposit): deposit is NormalizedDepositResult => deposit != null)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
