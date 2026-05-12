import type { BridgeCustomer, KycStatus } from './client';

/** Bridge raw values that mean KYC docs were submitted and are being reviewed. */
const KYC_IN_REVIEW = new Set([
  'pending',
  'in_review',
  'incomplete',
  'under_review',
  'processing',
  'submitted',
  'awaiting_questionnaire',
  'awaiting_ubo',
]);

const KYC_APPROVED = new Set(['approved', 'active']);

const KYC_REJECTED = new Set(['rejected', 'failed']);

export type KycUiPhase = 'not_started' | 'in_review' | 'approved' | 'rejected' | 'unknown';

function normalizeStatusKey(status: string): string {
  return status.toLowerCase().replace(/-/g, '_');
}

/**
 * Map Bridge / backend raw kycStatus to a UI phase.
 * Backend passes Bridge values through unchanged — normalization lives here.
 */
export function getKycUiPhase(
  status: string | null | undefined,
  bridgeCustomerId?: string | null,
): KycUiPhase {
  if (!status || status === 'not_started') return 'not_started';
  const key = normalizeStatusKey(status);
  if (KYC_IN_REVIEW.has(key)) return 'in_review';
  if (KYC_APPROVED.has(key)) return 'approved';
  if (KYC_REJECTED.has(key)) return 'rejected';
  // Unknown status with an existing Bridge customer — don't send user back to "start KYC".
  if (bridgeCustomerId) return 'unknown';
  return 'not_started';
}

/** Map to legacy KycStatus strings used in a few UI branches. */
export function normalizeKycStatus(status: string | undefined | null): KycStatus {
  const phase = getKycUiPhase(status);
  if (phase === 'in_review' || phase === 'unknown') return 'under_review';
  if (phase === 'approved') return 'approved';
  if (phase === 'rejected') return 'rejected';
  if (!status) return 'not_started';
  return status as KycStatus;
}

/** Normalize GET /api/bridge/customer so UI gates don't misfire on variant field values. */
export function normalizeBridgeCustomer(raw: BridgeCustomer | null): BridgeCustomer | null {
  if (!raw) return null;
  return {
    ...raw,
    kycStatus: normalizeKycStatus(raw.kycStatus),
    canTransact: Boolean(raw.canTransact),
    endorsements: raw.endorsements ?? [],
  };
}

export function isKycInReview(
  status: string | undefined | null,
  bridgeCustomerId?: string | null,
): boolean {
  const phase = getKycUiPhase(status, bridgeCustomerId);
  return phase === 'in_review' || phase === 'unknown';
}

export function isKycApproved(status: string | undefined | null): boolean {
  return getKycUiPhase(status) === 'approved';
}

export function isKycRejected(status: string | undefined | null): boolean {
  return getKycUiPhase(status) === 'rejected';
}

/** User already submitted KYC — don't show the "start verification" form again. */
export function hasSubmittedKyc(customer: BridgeCustomer | null | undefined): boolean {
  if (!customer) return false;
  const phase = getKycUiPhase(customer.kycStatus, customer.bridgeCustomerId);
  return phase === 'in_review' || phase === 'approved' || phase === 'unknown';
}

/** Ramp flows that need an approved Bridge customer (virtual account, etc.). */
export function isBridgeTransactReady(customer: BridgeCustomer | null | undefined): boolean {
  return !!customer?.canTransact;
}

/** Can show currency endorsement / deposit setup (KYC done or still reviewing). */
export function canProgressCurrencySetup(customer: BridgeCustomer | null | undefined): boolean {
  if (!customer) return false;
  if (customer.canTransact) return true;
  const phase = getKycUiPhase(customer.kycStatus, customer.bridgeCustomerId);
  return phase === 'approved' || phase === 'in_review' || phase === 'unknown';
}
