import type {
  BridgeCustomer,
  BridgeEndorsement,
  BridgeRejectionReason,
  KycStatus,
} from './client';

/** Waiting on Bridge — no in-app remediation CTA (unless endorsements need selfie/SOF). */
const KYC_WAITING = new Set([
  'pending',
  'in_review',
  'under_review',
  'processing',
  'submitted',
]);

/**
 * Bridge needs more info from the user. Frontend must POST /kyc-link and open
 * kycLink — GET /customer never includes the remediation URL.
 */
const KYC_NEEDS_INFO = new Set([
  'incomplete',
  'awaiting_questionnaire',
  'awaiting_ubo',
]);

const KYC_APPROVED = new Set(['approved', 'active']);

const KYC_REJECTED = new Set(['rejected', 'failed']);

const KYC_PAUSED = new Set(['paused']);

/** Patterns that mean selfie / source-of-funds outstanding on endorsements.requirements. */
const SELFIE_OR_SOF_PATTERN = /selfie|source[_\s-]?of[_\s-]?funds|\bsof\b/i;

export type KycUiPhase =
  | 'not_started'
  | 'in_review'
  | 'needs_info'
  | 'approved'
  | 'rejected'
  | 'paused'
  | 'unknown';

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
  if (KYC_APPROVED.has(key)) return 'approved';
  if (KYC_REJECTED.has(key)) return 'rejected';
  if (KYC_PAUSED.has(key)) return 'paused';
  if (KYC_NEEDS_INFO.has(key)) return 'needs_info';
  if (KYC_WAITING.has(key)) return 'in_review';
  // Unknown status with an existing Bridge customer — don't send user back to "start KYC".
  if (bridgeCustomerId) return 'unknown';
  return 'not_started';
}

/** True when endorsements.requirements mention selfie or source of funds. */
export function endorsementsRequireSelfieOrSof(
  endorsements: BridgeEndorsement[] | null | undefined,
): boolean {
  if (!endorsements?.length) return false;
  for (const endorsement of endorsements) {
    if (endorsement.status === 'approved') continue;
    const requirements = endorsement.requirements;
    if (!requirements || typeof requirements !== 'object') continue;
    if (SELFIE_OR_SOF_PATTERN.test(JSON.stringify(requirements))) {
      return true;
    }
  }
  return false;
}

/**
 * User-visible Bridge reasons (rejected / paused). Empty array when Bridge
 * omitted rejection_reasons — callers should fall back to generic copy.
 */
export function getCustomerFacingRejectionReasons(
  customer: BridgeCustomer | null | undefined,
): string[] {
  const rows = customer?.rejectionReasons;
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const reasons: string[] = [];
  for (const row of rows) {
    const text = typeof row?.reason === 'string' ? row.reason.trim() : '';
    if (text) reasons.push(text);
  }
  return reasons;
}

export function normalizeRejectionReasons(
  raw: BridgeRejectionReason[] | null | undefined,
): BridgeRejectionReason[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const reason = typeof row?.reason === 'string' ? row.reason.trim() : '';
      if (!reason) return null;
      const createdAt =
        typeof row.createdAt === 'string' && row.createdAt.trim()
          ? row.createdAt.trim()
          : undefined;
      return createdAt ? { reason, createdAt } : { reason };
    })
    .filter((row): row is BridgeRejectionReason => row != null);
}

/**
 * User must reopen hosted KYC (POST /kyc-link) — Bridge will not push a new link.
 * Covers incomplete / questionnaire, and selfie/SOF in requirements.
 */
export function customerNeedsKycAdditionalInfo(
  customer: BridgeCustomer | null | undefined,
): boolean {
  if (!customer || customer.canTransact) return false;
  const phase = getKycUiPhase(customer.kycStatus, customer.bridgeCustomerId);
  if (phase === 'needs_info') return true;
  if (
    phase === 'approved'
    || phase === 'rejected'
    || phase === 'paused'
    || phase === 'not_started'
  ) {
    return false;
  }
  return endorsementsRequireSelfieOrSof(customer.endorsements);
}

/** Map to legacy KycStatus strings used in a few UI branches. */
export function normalizeKycStatus(status: string | undefined | null): KycStatus {
  if (!status) return 'not_started';
  const key = normalizeStatusKey(status);
  if (key === 'incomplete') return 'incomplete';
  if (key === 'awaiting_questionnaire') return 'awaiting_questionnaire';
  if (key === 'awaiting_ubo') return 'awaiting_ubo';
  if (key === 'under_review') return 'under_review';
  if (key === 'paused') return 'paused';

  const phase = getKycUiPhase(status);
  if (phase === 'needs_info') return 'incomplete';
  if (phase === 'in_review' || phase === 'unknown') return 'under_review';
  if (phase === 'approved') return 'approved';
  if (phase === 'rejected') return 'rejected';
  if (phase === 'paused') return 'paused';
  if (phase === 'not_started') return 'not_started';
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
    rejectionReasons: normalizeRejectionReasons(raw.rejectionReasons),
  };
}

export function isKycInReview(
  status: string | undefined | null,
  bridgeCustomerId?: string | null,
): boolean {
  const phase = getKycUiPhase(status, bridgeCustomerId);
  return phase === 'in_review' || phase === 'needs_info' || phase === 'unknown';
}

export function isKycApproved(status: string | undefined | null): boolean {
  return getKycUiPhase(status) === 'approved';
}

export function isKycRejected(status: string | undefined | null): boolean {
  return getKycUiPhase(status) === 'rejected';
}

export function isKycPaused(status: string | undefined | null): boolean {
  return getKycUiPhase(status) === 'paused';
}

/** User already submitted KYC — don't show the "start verification" form again. */
export function hasSubmittedKyc(customer: BridgeCustomer | null | undefined): boolean {
  if (!customer) return false;
  const phase = getKycUiPhase(customer.kycStatus, customer.bridgeCustomerId);
  return (
    phase === 'in_review'
    || phase === 'needs_info'
    || phase === 'approved'
    || phase === 'paused'
    || phase === 'unknown'
  );
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
  // Block deposit setup while selfie/SOF (or other remediation) is outstanding.
  return phase === 'approved' || phase === 'in_review' || phase === 'unknown';
}
