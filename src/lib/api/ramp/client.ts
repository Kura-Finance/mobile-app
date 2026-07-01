/**
 * Bridge On/Off-Ramp API — /api/bridge/* domain
 *
 * Wraps the Kura backend's Bridge.xyz (Stripe's fiat ⇄ stablecoin infra)
 * integration. All endpoints require JWT authentication (handled by the
 * shared request client).
 *
 * Flow:
 *   1. openBridgeHostedKycFlow() → ToS browser, then KYC browser (see hostedFlow.ts)
 *   1b. completeBridgeEndorsementFlow() → endorsement-link + poll (see endorsementFlow.ts)
 *   2. getBridgeCustomer()  → poll until canTransact === true
 *   3a. getOrCreateOnRampAccount() → persistent virtual account (fiat → stablecoin),
 *       returns depositInstructions; track via listDeposits()
 *   3b. listPayoutOptions() → createExternalAccount() + getOrCreatePayoutAddress()
 *       → user sends Base USDC to depositAddress; track via listPayoutDrains()
 *   4. listTransfers() / getTransfer() → track crypto deposit (Tron USDT) state
 *
 * NOTE: This is distinct from `lib/api/bridge/*` (Li.Fi cross-chain bridge).
 */

import { requestJson } from '../client';
import { KuraApiError } from '../errors';
import { normalizeRoutingNumber, normalizeSortCode, normalizeBridgeAddress } from './externalAccountNormalize';
import { normalizeBridgeCustomer } from './bridgeKyc';
import {
  isUnsupportedCurrencyError,
  parseEndorsementError,
  type EndorsementRequiredDetail,
} from './bridgeErrors';
import { normalizeDepositsList } from './bridgeDepositNormalize';

export { isUnsupportedCurrencyError, parseEndorsementError, type EndorsementRequiredDetail };

export {
  BRIDGE_ADDRESS_LIMITS,
  clampBridgeText,
  isBridgeStreetLine1Valid,
  normalizeBridgeAddress,
  normalizeRoutingNumber,
  normalizeSortCode,
} from './externalAccountNormalize';

const apiName = 'BridgeRampApi';

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

export type KycStatus =
  | 'not_started'
  | 'under_review'
  | 'incomplete'
  | 'approved'
  | 'rejected'
  // KYB (business) in-progress states — more info required on Bridge's hosted page
  | 'awaiting_questionnaire'
  | 'awaiting_ubo'
  | string;

export type TosStatus = 'pending' | 'approved' | string;

/** Whether the Bridge customer is an individual (KYC) or a business (KYB). */
export type CustomerType = 'individual' | 'business';

/** Fiat rails accepted by the backend on-ramp source / off-ramp destination. */
export type FiatRail =
  | 'ach_push'
  | 'ach_same_day'
  | 'wire'
  | 'sepa'
  | 'spei'
  | 'pix'
  | 'faster_payments';

/** Crypto rails (on-ramp destination / off-ramp source). */
export type CryptoRail =
  | 'ethereum'
  | 'base'
  | 'polygon'
  | 'arbitrum'
  | 'optimism'
  | 'solana'
  | 'avalanche'
  | 'stellar'
  | 'tron';

export type StableCoin = 'usdc' | 'usdb' | 'eurc' | 'usdt' | 'dai' | 'pyusd';

export type FiatCurrency = 'usd' | 'eur' | 'gbp' | 'brl' | 'mxn' | 'cop';

/** Backend-computed deposit fee (USDT liquidation address or fiat VA). */
export interface DepositFee {
  /** Fee rate on base 100, e.g. "0.5" = 0.5%. */
  developerFeePercent: string;
  /** Currency the fee is quoted in, e.g. "usdt", "usd", "brl". */
  feeCurrency: string;
}

/** Format backend `depositFee` for display, e.g. "0.5% USDT". */
export function formatDepositFeeLabel(depositFee?: DepositFee | null): string | null {
  const percent = depositFee?.developerFeePercent;
  if (percent == null || percent === '') return null;
  const currency = (depositFee?.feeCurrency ?? '').toUpperCase();
  return currency ? `${percent}% ${currency}` : `${percent}%`;
}

/** Backend-computed minimum deposit amount (fiat VA or USDT liquidation address). */
export interface MinDeposit {
  amount: string;
  /** Currency code, e.g. "usd", "usdt", "brl". */
  currency: string;
}

/** Format backend `minDeposit` for display, e.g. "10 USD". */
export function formatMinDepositLabel(minDeposit?: MinDeposit | null): string | null {
  const amount = minDeposit?.amount;
  if (amount == null || amount === '') return null;
  const currency = (minDeposit?.currency ?? '').toUpperCase();
  return currency ? `${amount} ${currency}` : amount;
}

export interface DepositInstructions {
  payment_rail?: string;
  amount?: string;
  currency?: string;
  from_address?: string;
  to_address?: string;
  deposit_message?: string;
  blockchain_memo?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_routing_number?: string;
  bank_beneficiary_name?: string;
  iban?: string;
  bic?: string;
}

export interface TransferResult {
  bridgeTransferId: string;
  direction: 'onramp' | 'offramp' | 'crypto';
  state: string;
  amount: string | null;
  sourceRail: string | null;
  sourceCurrency: string | null;
  destinationRail: string | null;
  destinationCurrency: string | null;
  destinationAddress: string | null;
  destinationExternalId: string | null;
  depositInstructions: DepositInstructions | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. KYC link
// ─────────────────────────────────────────────────────────────────────────────

export interface KycLinkRequest {
  /** Person's full name (individual) or company legal name (business). */
  fullName: string;
  email?: string;
  type?: CustomerType;
  /** KYB only — pre-request payment rails (e.g. ['base', 'sepa']). */
  endorsements?: string[];
  /** URL to return to after the hosted flow completes. */
  redirectUri?: string;
  /** Required when the name contains non-Latin-1 characters. */
  transliteratedFirstName?: string;
  transliteratedLastName?: string;
  /** KYB only — required when the legal name contains non-Latin-1 characters. */
  transliteratedBusinessLegalName?: string;
}

export interface KycLinkResult {
  bridgeCustomerId: string | null;
  kycLinkId: string | null;
  customerType: CustomerType;
  kycLink: string | null;
  tosLink: string | null;
  kycStatus: KycStatus;
  tosStatus: TosStatus;
}

export async function createKycLink(body: KycLinkRequest): Promise<KycLinkResult> {
  return requestJson<KycLinkResult>('/api/bridge/kyc-link', {
    method: 'POST',
    body: JSON.stringify(body),
    apiName,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1b. Endorsement link (rail permission — e.g. pix for BRL, cop for COP)
// ─────────────────────────────────────────────────────────────────────────────

export interface EndorsementLinkResult {
  /** Hosted Bridge page (ToS and/or KYC) for this endorsement. */
  kycLink: string | null;
  tosLink?: string | null;
}

/**
 * POST /api/bridge/endorsement-link
 * Request a hosted flow URL for a fiat rail (e.g. COP → cop endorsement).
 */
export async function createEndorsementLink(currency: FiatCurrency): Promise<EndorsementLinkResult> {
  return requestJson<EndorsementLinkResult>('/api/bridge/endorsement-link', {
    method: 'POST',
    body: JSON.stringify({ currency }),
    apiName,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Customer / KYC status
// ─────────────────────────────────────────────────────────────────────────────

export interface BridgeEndorsement {
  name: string;
  status: string;
  requirements?: Record<string, unknown>;
}

export interface BridgeCustomer {
  bridgeCustomerId: string | null;
  customerType: CustomerType | null;
  kycStatus: KycStatus;
  tosStatus: TosStatus;
  endorsements: BridgeEndorsement[];
  canTransact: boolean;
}

export function isEndorsementApproved(
  customer: BridgeCustomer | null,
  endorsement: string,
): boolean {
  return (
    customer?.endorsements?.some(
      (e) => e.name === endorsement && e.status === 'approved',
    ) ?? false
  );
}

/**
 * Bridge endorsement names required before POST /onramp for specific fiats.
 * @see https://apidocs.bridge.xyz/platform/customers/customers/endorsements
 */
export const FIAT_ENDORSEMENT_BY_CURRENCY: Partial<Record<FiatCurrency, string>> = {
  brl: 'pix',
  cop: 'cop',
  mxn: 'spei',
  gbp: 'faster_payments',
};

function isFiatCurrency(value: string): value is FiatCurrency {
  return ['usd', 'eur', 'gbp', 'brl', 'mxn', 'cop'].includes(value);
}

/** Resolve fiat currency for POST /api/bridge/endorsement-link from an error/detail payload. */
export function resolveEndorsementCurrency(
  detail: Pick<EndorsementRequiredDetail, 'currency' | 'endorsement'>,
): FiatCurrency {
  const code = detail.currency?.toLowerCase();
  if (code && isFiatCurrency(code)) return code;
  for (const [currency, endorsement] of Object.entries(FIAT_ENDORSEMENT_BY_CURRENCY)) {
    if (endorsement === detail.endorsement) return currency as FiatCurrency;
  }
  throw new Error(`Unknown endorsement rail: ${detail.endorsement}`);
}

function isBaseKycApproved(kycStatus: string): boolean {
  const key = kycStatus.toLowerCase().replace(/-/g, '_');
  return key === 'approved' || key === 'active';
}

/** Pending rail endorsement for a fiat currency, if any. Requires base KYC approval. */
export function getPendingFiatEndorsement(
  customer: BridgeCustomer | null,
  currency: FiatCurrency,
): EndorsementRequiredDetail | null {
  const endorsement = FIAT_ENDORSEMENT_BY_CURRENCY[currency];
  if (!endorsement || !customer) return null;
  if (!isBaseKycApproved(customer.kycStatus)) return null;
  if (isEndorsementApproved(customer, endorsement)) return null;
  return {
    code: 'endorsement_required',
    endorsement,
    currency,
  };
}

/**
 * Parse a 409 endorsement_required error, with a currency fallback when the
 * backend embeds the payload in a non-standard shape (BRL pix, COP cop, etc.).
 */
export function resolveEndorsementDetail(
  error: unknown,
  currency: FiatCurrency,
): EndorsementRequiredDetail | null {
  const parsed = parseEndorsementError(error);
  if (parsed) return parsed;

  const fallbackEndorsement = FIAT_ENDORSEMENT_BY_CURRENCY[currency];
  if (
    fallbackEndorsement &&
    error instanceof KuraApiError &&
    error.status === 409 &&
    (error.code === 'BRIDGE_API_ERROR' || error.code === 'ENDORSEMENT_REQUIRED')
  ) {
    return {
      code: 'endorsement_required',
      endorsement: fallbackEndorsement,
      currency,
      message: `${currency.toUpperCase()} virtual accounts require the "${fallbackEndorsement}" endorsement.`,
    };
  }
  return null;
}

/**
 * Fetch the Bridge customer / KYC status.
 * Returns `null` when no KYC link has been created yet (404 / BRIDGE_API_ERROR),
 * which the UI treats as "needs onboarding".
 */
export async function getBridgeCustomer(): Promise<BridgeCustomer | null> {
  try {
    const raw = await requestJson<BridgeCustomer>('/api/bridge/customer', {
      method: 'GET',
      apiName,
    });
    return normalizeBridgeCustomer(raw);
  } catch (error) {
    if (
      error instanceof KuraApiError &&
      (error.status === 404 || error.code === 'BRIDGE_API_ERROR')
    ) {
      return null;
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3a. On-ramp (fiat → stablecoin) — Bridge Virtual Accounts
//
// Each user gets a dedicated, persistent fiat deposit account per
// (sourceCurrency, destinationRail, destinationCurrency). There is NO per-deposit
// amount or memo: the bank details are fixed, and any fiat sent to them is
// converted to the destination stablecoin and forwarded to `destinationAddress`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bank details for a virtual account — display these so the user can fund it.
 *
 * Fields vary by currency (render conditionally):
 *   USD → bank_routing_number + bank_account_number + bank_beneficiary_name
 *   EUR → iban + bic
 *   GBP → sort_code + account_number
 *   MXN → clabe ; BRL → pix_key ; COP → PSE fields
 */
export interface VirtualAccountDepositInstructions {
  currency?: string;
  bank_name?: string;
  bank_address?: string;
  bank_routing_number?: string;
  bank_account_number?: string;
  bank_beneficiary_name?: string;
  bank_beneficiary_address?: string;
  /** Accepted payment methods, e.g. ['ach_push', 'wire'] (US) or ['sepa'] (EU). */
  payment_rails?: string[];
  // EUR (SEPA)
  iban?: string;
  bic?: string;
  // GBP (Faster Payments)
  sort_code?: string;
  account_number?: string;
  // MXN
  clabe?: string;
  // BRL
  pix_key?: string;
  // COP (Bre-B)
  bre_b_key?: string;
  account_holder_name?: string;
  // Allow forward-compatible fields without breaking the build.
  [key: string]: string | string[] | undefined;
}

export interface VirtualAccount {
  bridgeVirtualAccountId: string;
  status: string;
  sourceCurrency: string;
  destinationRail: string;
  destinationCurrency: string;
  destinationAddress: string | null;
  developerFeePercent: string | null;
  depositFee?: DepositFee | null;
  minDeposit?: MinDeposit | null;
  depositInstructions: VirtualAccountDepositInstructions | null;
  createdAt: string;
}

export interface OnRampRequest {
  /** Fiat currency the user will deposit (e.g. 'usd'). */
  sourceCurrency: FiatCurrency;
  /** Destination chain for the converted stablecoin. */
  destinationRail: CryptoRail;
  /** Destination stablecoin. */
  destinationCurrency: StableCoin;
  /** Where converted funds land. Defaults to the user's SCA/wallet server-side. */
  toAddress?: string;
}

/**
 * Get (or lazily create) the user's persistent virtual account for the given
 * currency/rail combo. Idempotent — returns the same account on repeat calls.
 */
export async function getOrCreateOnRampAccount(
  body: OnRampRequest,
): Promise<VirtualAccount> {
  return requestJson<VirtualAccount>('/api/bridge/onramp', {
    method: 'POST',
    body: JSON.stringify(body),
    apiName,
    // 400 = currency not supported, 409 = endorsement_required. Both are
    // handled by the UI (FiatReceivePanel), so don't log them as warnings.
    expectedStatuses: [400, 409],
  });
}

/** List all of the user's virtual (deposit) accounts. */
export async function listOnRampAccounts(): Promise<VirtualAccount[]> {
  return requestJson<VirtualAccount[]>('/api/bridge/onramp', {
    method: 'GET',
    apiName,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3a2. Crypto deposit (Tron USDT → Base USDC) — Liquidation Address
//
// One permanent Tron deposit address per user. Any USDT sent (with memo) is
// auto-converted to Base USDC and forwarded to the user's SCA.
// ─────────────────────────────────────────────────────────────────────────────

export interface LiquidationAddressResult {
  bridgeLiquidationAddressId: string;
  state: 'active' | 'deactivated';
  sourceChain: 'tron';
  sourceCurrency: 'usdt';
  destinationRail: 'base';
  destinationCurrency: 'usdc';
  destinationAddress: string;
  /** Bridge permanent Tron address — user's payment target. */
  depositAddress: string;
  /** Required on Tron transfers; omitting causes severe processing delays. */
  blockchainMemo: string | null;
  developerFeePercent: string | null;
  depositFee?: DepositFee | null;
  minDeposit?: MinDeposit | null;
  createdAt: string;
}

export interface CryptoDepositAddressListResult {
  addresses: LiquidationAddressResult[];
  count: number;
}

export interface CreateCryptoDepositAddressBody {
  /** Base SCA; defaults to the backend-registered scaAddress. */
  toAddress?: string;
  /** Tron refund address (T...) — recommended when the user has a Tron wallet. */
  returnAddress?: string;
}

/** GET /api/bridge/crypto-deposit-address */
export async function listCryptoDepositAddresses(): Promise<CryptoDepositAddressListResult> {
  return requestJson<CryptoDepositAddressListResult>('/api/bridge/crypto-deposit-address', {
    method: 'GET',
    apiName,
  });
}

/** POST /api/bridge/crypto-deposit-address — idempotent get-or-create. */
export async function createCryptoDepositAddress(
  body: CreateCryptoDepositAddressBody = {},
): Promise<LiquidationAddressResult> {
  return requestJson<LiquidationAddressResult>('/api/bridge/crypto-deposit-address', {
    method: 'POST',
    body: JSON.stringify(body),
    apiName,
    expectedStatuses: [400, 409],
  });
}

/** Idempotent get-or-create — always POST so depositFee reflects current backend rates. */
export async function getOrCreateCryptoDepositAddress(
  body: CreateCryptoDepositAddressBody = {},
): Promise<LiquidationAddressResult> {
  return createCryptoDepositAddress(body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3c. Deposit records (incoming fiat → stablecoin activity)
//
// Driven by Bridge webhooks, so there may be a few seconds of lag after a wire
// lands. Poll while any record has `completed === false`.
// ─────────────────────────────────────────────────────────────────────────────

export type DepositEventType =
  | 'funds_scheduled'
  | 'funds_received'
  | 'in_review'
  | 'payment_submitted'
  | 'payment_processed'
  | 'refunded'
  | string;

export interface DepositPayerInfo {
  paymentRail: string | null;
  senderName: string | null;
  accountLast4: string | null;
  senderBankRoutingNumber: string | null;
  senderDescription: string | null;
}

export interface DepositEvent extends DepositPayerInfo {
  type: DepositEventType;
  amount: string | null;
  currency: string | null;
  subtotalAmount: string | null;
  developerFeeAmount: string | null;
  exchangeFeeAmount: string | null;
  gasFee: string | null;
  destinationTxHash: string | null;
  occurredAt: string | null;
}

export interface DepositResult extends DepositPayerInfo {
  depositId: string | null;
  bridgeVirtualAccountId: string;
  /** Latest event type. */
  status: DepositEventType;
  /** Whether stablecoin has reached payment_processed. */
  completed: boolean;
  amount: string | null;
  currency: string | null;
  netAmount: string | null;
  developerFeeAmount: string | null;
  exchangeFeeAmount: string | null;
  gasFee: string | null;
  destinationTxHash: string | null;
  createdAt: string;
  updatedAt: string;
  /** Time-ascending event timeline. */
  events: DepositEvent[];
}

/** All deposit records for the user (most recent first). */
export { normalizeDepositsList };
export type { NormalizedDepositResult } from './bridgeDepositNormalize';

export interface ListDepositsOptions {
  /** Bypass backend cache and sync history from Bridge immediately. */
  force?: boolean;
}

function depositsQuery(options?: ListDepositsOptions): string {
  return options?.force ? '?force=true' : '';
}

export async function listDeposits(options?: ListDepositsOptions): Promise<DepositResult[]> {
  const raw = await requestJson<unknown>(`/api/bridge/deposits${depositsQuery(options)}`, {
    method: 'GET',
    apiName,
  });
  return normalizeDepositsList(raw);
}

/** Deposit records for a single virtual account (most recent first). */
export async function listAccountDeposits(
  virtualAccountId: string,
  options?: ListDepositsOptions,
): Promise<DepositResult[]> {
  const raw = await requestJson<unknown>(
    `/api/bridge/onramp/${virtualAccountId}/deposits${depositsQuery(options)}`,
    { method: 'GET', apiName },
  );
  return normalizeDepositsList(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3b. Off-ramp (stablecoin → fiat)
// ─────────────────────────────────────────────────────────────────────────────

export type ExternalAccountType = 'us' | 'iban' | 'gb' | 'pix' | 'clabe' | 'bre_b';

export interface ExternalAccountAddress {
  street_line_1: string;
  street_line_2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
}

/** Form-friendly input collected in the add-bank UI. */
export interface ExternalAccountFormInput {
  currency: FiatCurrency;
  accountType: ExternalAccountType;
  firstName: string;
  lastName: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  /** GBP Faster Payments — 6 digits, no hyphen. */
  sortCode?: string;
  checkingOrSavings?: 'checking' | 'savings';
  pixKey?: string;
  documentNumber?: string;
  /** MXN SPEI — 18-digit CLABE. */
  clabe?: string;
  /** COP Bre-B — recipient key (phone, email, etc.). */
  breBKey?: string;
  iban?: string;
  bic?: string;
  address?: ExternalAccountAddress;
}

/** Kura POST /api/bridge/external-accounts request (camelCase). */
export interface ExternalAccountRequest {
  currency: FiatCurrency;
  accountType: ExternalAccountType;
  accountOwnerName: string;
  firstName: string;
  lastName: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  sortCode?: string;
  checkingOrSavings?: 'checking' | 'savings';
  pixKey?: string;
  documentNumber?: string;
  clabe?: string;
  breBKey?: string;
  iban?: string;
  bic?: string;
  address?: ExternalAccountAddress;
}

export function accountTypeForCurrency(currency: FiatCurrency): ExternalAccountType {
  switch (currency) {
    case 'usd':
      return 'us';
    case 'gbp':
      return 'gb';
    case 'brl':
      return 'pix';
    case 'mxn':
      return 'clabe';
    case 'cop':
      return 'bre_b';
    default:
      return 'iban';
  }
}


/** Build the Kura external-account body from UI form values. */
export function buildExternalAccountBody(
  input: ExternalAccountFormInput,
): ExternalAccountRequest {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const base: ExternalAccountRequest = {
    currency: input.currency,
    accountType: input.accountType,
    accountOwnerName: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    ...(input.address ? { address: normalizeBridgeAddress(input.address) } : {}),
    ...(input.bankName?.trim() ? { bankName: input.bankName.trim() } : {}),
  };

  switch (input.currency) {
    case 'usd':
      return {
        ...base,
        routingNumber: normalizeRoutingNumber(input.routingNumber ?? ''),
        accountNumber: input.accountNumber!.trim(),
        checkingOrSavings: input.checkingOrSavings ?? 'checking',
      };
    case 'gbp':
      return {
        ...base,
        sortCode: normalizeSortCode(input.sortCode ?? ''),
        accountNumber: input.accountNumber!.trim(),
      };
    case 'brl':
      return {
        ...base,
        pixKey: input.pixKey!.trim(),
        documentNumber: input.documentNumber!.trim().replace(/\D/g, ''),
      };
    case 'mxn':
      return {
        ...base,
        clabe: input.clabe!.trim().replace(/\D/g, ''),
      };
    case 'cop':
      return {
        ...base,
        breBKey: input.breBKey!.trim(),
      };
    case 'eur':
      return {
        ...base,
        iban: input.iban!.trim().replace(/\s/g, '').toUpperCase(),
        ...(input.bic?.trim() ? { bic: input.bic.trim().toUpperCase() } : {}),
      };
    default:
      return base;
  }
}

export interface ExternalAccountResult {
  bridgeExternalAccountId: string;
  bankName: string | null;
  accountOwnerName: string | null;
  last4: string | null;
  currency: string;
  active: boolean;
}

export async function createExternalAccount(
  body: ExternalAccountRequest,
): Promise<ExternalAccountResult> {
  return requestJson<ExternalAccountResult>('/api/bridge/external-accounts', {
    method: 'POST',
    body: JSON.stringify(body),
    apiName,
  });
}

export async function listExternalAccounts(): Promise<ExternalAccountResult[]> {
  return requestJson<ExternalAccountResult[]>('/api/bridge/external-accounts', {
    method: 'GET',
    apiName,
  });
}

/** Soft-delete a saved bank account (sets active=false; removed from GET list). */
export async function deleteExternalAccount(
  externalAccountId: string,
): Promise<ExternalAccountResult> {
  return requestJson<ExternalAccountResult>(
    `/api/bridge/external-accounts/${externalAccountId}`,
    {
      method: 'DELETE',
      apiName,
      expectedStatuses: [404, 409],
    },
  );
}

/** Pay-out rail + currency combo returned by GET /payout-options. */
export interface PayoutOption {
  destinationRail: FiatRail;
  destinationCurrency: FiatCurrency;
  label?: string;
}

/** Documented rails when GET /payout-options is empty or unparseable. */
export const DEFAULT_PAYOUT_OPTIONS: PayoutOption[] = [
  { destinationRail: 'ach_same_day', destinationCurrency: 'usd', label: 'ACH Same Day' },
  { destinationRail: 'wire', destinationCurrency: 'usd', label: 'Wire' },
  { destinationRail: 'faster_payments', destinationCurrency: 'gbp', label: 'Faster Payments' },
  { destinationRail: 'pix', destinationCurrency: 'brl', label: 'Pix' },
  { destinationRail: 'spei', destinationCurrency: 'mxn', label: 'SPEI' },
];

const FIAT_CURRENCY_CODES = new Set<FiatCurrency>(['usd', 'eur', 'gbp', 'brl', 'mxn', 'cop']);

function parsePayoutOptionRow(
  row: unknown,
  currencyHint?: string,
): PayoutOption | null {
  if (typeof row === 'string' && currencyHint && FIAT_CURRENCY_CODES.has(currencyHint as FiatCurrency)) {
    return {
      destinationRail: row as FiatRail,
      destinationCurrency: currencyHint as FiatCurrency,
    };
  }
  if (row === null || typeof row !== 'object') return null;

  const r = row as Record<string, unknown>;
  const destinationRail = (
    r.destinationRail ??
    r.destination_rail ??
    r.rail ??
    r.paymentRail ??
    r.payment_rail
  ) as string | undefined;
  const rawCurrency = (
    r.destinationCurrency ??
    r.destination_currency ??
    r.currency ??
    currencyHint
  ) as string | undefined;
  if (!destinationRail || !rawCurrency) return null;

  const destinationCurrency = rawCurrency.toLowerCase() as FiatCurrency;
  if (!FIAT_CURRENCY_CODES.has(destinationCurrency)) return null;

  return {
    destinationRail: destinationRail as FiatRail,
    destinationCurrency,
    label: typeof r.label === 'string' ? r.label : undefined,
  };
}

function flattenCurrencyKeyedOptions(obj: Record<string, unknown>): PayoutOption[] {
  const result: PayoutOption[] = [];
  for (const [key, val] of Object.entries(obj)) {
    const currencyHint = key.toLowerCase();
    if (!FIAT_CURRENCY_CODES.has(currencyHint as FiatCurrency)) continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        const opt = parsePayoutOptionRow(item, currencyHint);
        if (opt) result.push(opt);
      }
    } else {
      const opt = parsePayoutOptionRow(val, currencyHint);
      if (opt) result.push(opt);
    }
  }
  return result;
}

function normalizePayoutOptionsList(res: unknown): PayoutOption[] {
  if (Array.isArray(res)) {
    const parsed = res
      .map((row) => parsePayoutOptionRow(row))
      .filter((row): row is PayoutOption => row !== null);
    return parsed;
  }
  if (res !== null && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    for (const key of ['options', 'payoutOptions', 'items', 'data', 'rails'] as const) {
      const val = obj[key];
      if (Array.isArray(val)) {
        const parsed = val
          .map((row) => parsePayoutOptionRow(row))
          .filter((row): row is PayoutOption => row !== null);
        if (parsed.length > 0) return parsed;
      }
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        const nested = flattenCurrencyKeyedOptions(val as Record<string, unknown>);
        if (nested.length > 0) return nested;
      }
    }
    const fromMap = flattenCurrencyKeyedOptions(obj);
    if (fromMap.length > 0) return fromMap;
    const single = parsePayoutOptionRow(obj);
    if (single) return [single];
  }
  return [];
}

/** GET /api/bridge/payout-options */
export async function listPayoutOptions(): Promise<PayoutOption[]> {
  const res = await requestJson<unknown>('/api/bridge/payout-options', {
    method: 'GET',
    apiName,
  });
  const normalized = normalizePayoutOptionsList(res);
  if (normalized.length > 0) return normalized;
  // Explicit empty list from backend — respect it.
  if (Array.isArray(res) && res.length === 0) return [];
  return DEFAULT_PAYOUT_OPTIONS;
}

export interface CreatePayoutAddressRequest {
  destinationRail: FiatRail;
  destinationCurrency: FiatCurrency;
  externalAccountId: string;
  /** User's Base SCA — refund target if a payout fails. */
  returnAddress: string;
  destinationReference?: string;
}

/** Permanent Base USDC liquidation address for off-ramp payouts. */
export interface PayoutAddressResult {
  bridgeLiquidationAddressId: string;
  depositAddress: string;
  sourceChain: CryptoRail;
  sourceCurrency: StableCoin;
  destinationRail: FiatRail;
  destinationCurrency: FiatCurrency;
  bridgeExternalAccountId: string;
  payoutFee?: DepositFee | null;
  destinationReference?: string | null;
  state?: string;
  createdAt?: string;
}

interface PayoutAddressListResult {
  addresses?: PayoutAddressResult[];
  count?: number;
}

function normalizePayoutAddressList(
  res: PayoutAddressResult[] | PayoutAddressListResult,
): PayoutAddressResult[] {
  if (Array.isArray(res)) return res;
  return res.addresses ?? [];
}

/** GET /api/bridge/payout-address */
export async function listPayoutAddresses(): Promise<PayoutAddressResult[]> {
  const res = await requestJson<PayoutAddressResult[] | PayoutAddressListResult>(
    '/api/bridge/payout-address',
    { method: 'GET', apiName },
  );
  return normalizePayoutAddressList(res);
}

/** POST /api/bridge/payout-address — create a permanent payout LA (once per combo). */
export async function createPayoutAddress(
  body: CreatePayoutAddressRequest,
): Promise<PayoutAddressResult> {
  return requestJson<PayoutAddressResult>('/api/bridge/payout-address', {
    method: 'POST',
    body: JSON.stringify(body),
    apiName,
    expectedStatuses: [400, 409],
  });
}

/** Return an existing payout LA or create one if missing. */
export async function getOrCreatePayoutAddress(
  body: CreatePayoutAddressRequest,
): Promise<PayoutAddressResult> {
  const findExisting = (rows: PayoutAddressResult[]) =>
    rows.find(
      (a) =>
        a.bridgeExternalAccountId === body.externalAccountId &&
        a.destinationRail === body.destinationRail &&
        a.destinationCurrency === body.destinationCurrency,
    );

  const existing = findExisting(await listPayoutAddresses());
  if (existing) return existing;

  try {
    return await createPayoutAddress(body);
  } catch (error) {
    if (error instanceof KuraApiError && error.status === 409) {
      const retry = findExisting(await listPayoutAddresses());
      if (retry) return retry;
    }
    throw error;
  }
}

export type PayoutDrainState =
  | 'in_review'
  | 'funds_received'
  | 'payment_submitted'
  | 'payment_processed'
  | 'undeliverable'
  | 'returned'
  | 'error'
  | 'refunded'
  | string;

export interface PayoutDrainDestination {
  payment_rail?: string;
  currency?: string;
  last4?: string;
}

/** One off-ramp payout triggered by a USDC deposit to the payout LA. */
export interface PayoutDrainResult {
  bridgeDrainId?: string;
  drainId?: string;
  bridgeLiquidationAddressId?: string;
  state: PayoutDrainState;
  amount: string | null;
  currency: string | null;
  depositTxHash?: string | null;
  destination?: PayoutDrainDestination | null;
  createdAt: string;
  updatedAt?: string;
}

function normalizePayoutDrainsList(res: unknown): PayoutDrainResult[] {
  if (Array.isArray(res)) return res;
  if (res !== null && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    for (const key of ['drains', 'items', 'data'] as const) {
      const val = obj[key];
      if (Array.isArray(val)) return val as PayoutDrainResult[];
    }
  }
  return [];
}

/** GET /api/bridge/payout-address/:liquidationAddressId/drains */
export async function listPayoutDrains(
  liquidationAddressId: string,
): Promise<PayoutDrainResult[]> {
  const res = await requestJson<unknown>(
    `/api/bridge/payout-address/${liquidationAddressId}/drains`,
    { method: 'GET', apiName },
  );
  return normalizePayoutDrainsList(res);
}

export function isPayoutDrainComplete(drain: PayoutDrainResult): boolean {
  return drain.state === 'payment_processed';
}

export function isPayoutDrainPending(drain: PayoutDrainResult): boolean {
  return ['in_review', 'funds_received', 'payment_submitted'].includes(drain.state);
}

export function isPayoutDrainTerminal(drain: PayoutDrainResult): boolean {
  return (
    isPayoutDrainComplete(drain) ||
    ['undeliverable', 'returned', 'refunded', 'error', 'canceled'].includes(drain.state)
  );
}

export function payoutDrainReferenceId(drain: PayoutDrainResult): string {
  return drain.bridgeDrainId ?? drain.drainId ?? drain.createdAt;
}

/** Format backend `payoutFee` for display, e.g. "0.5% USDC". */
export function formatPayoutFeeLabel(payoutFee?: DepositFee | null): string | null {
  return formatDepositFeeLabel(payoutFee);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Track transfers
// ─────────────────────────────────────────────────────────────────────────────

export async function listTransfers(): Promise<TransferResult[]> {
  return requestJson<TransferResult[]>('/api/bridge/transfers', {
    method: 'GET',
    apiName,
  });
}

/** Bridge liquidation-address deposits (Tron USDT → Base USDC). */
export function listCryptoTransfers(transfers: TransferResult[]): TransferResult[] {
  return transfers.filter((t) => t.direction === 'crypto');
}

/** Fiat virtual-account on-ramps tracked via /transfers when deposit webhooks lag. */
export function listOnrampTransfers(transfers: TransferResult[]): TransferResult[] {
  return transfers.filter((t) => t.direction === 'onramp');
}

export function isOnrampTransferComplete(transfer: TransferResult): boolean {
  return transfer.state === 'payment_processed';
}

export function isOnrampTransferTerminal(transfer: TransferResult): boolean {
  return (
    isOnrampTransferComplete(transfer) ||
    ['returned', 'refunded', 'error', 'canceled'].includes(transfer.state)
  );
}

export function isCryptoTransferComplete(transfer: TransferResult): boolean {
  return transfer.state === 'payment_processed';
}

export function isCryptoTransferTerminal(transfer: TransferResult): boolean {
  return (
    isCryptoTransferComplete(transfer) ||
    ['returned', 'refunded', 'error', 'canceled'].includes(transfer.state)
  );
}

export async function getTransfer(transferId: string): Promise<TransferResult> {
  return requestJson<TransferResult>(`/api/bridge/transfers/${transferId}`, {
    method: 'GET',
    apiName,
  });
}
