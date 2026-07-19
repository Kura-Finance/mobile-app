import { describe, expect, it } from 'vitest';
import {
  customerNeedsKycAdditionalInfo,
  endorsementsRequireSelfieOrSof,
  getCustomerFacingRejectionReasons,
  getKycUiPhase,
  hasSubmittedKyc,
  isKycApproved,
  isKycInReview,
  isKycPaused,
  normalizeBridgeCustomer,
  normalizeKycStatus,
} from '../bridgeKyc';
import type { BridgeCustomer } from '../client';

function makeCustomer(overrides: Partial<BridgeCustomer> = {}): BridgeCustomer {
  return {
    bridgeCustomerId: 'cus_1',
    customerType: 'individual',
    kycStatus: 'pending',
    tosStatus: 'approved',
    endorsements: [],
    canTransact: false,
    rejectionReasons: [],
    ...overrides,
  };
}

describe('getKycUiPhase', () => {
  it('maps waiting variants to in_review', () => {
    expect(getKycUiPhase('pending')).toBe('in_review');
    expect(getKycUiPhase('in_review')).toBe('in_review');
    expect(getKycUiPhase('under_review')).toBe('in_review');
    expect(getKycUiPhase('processing')).toBe('in_review');
  });

  it('maps incomplete / questionnaire to needs_info', () => {
    expect(getKycUiPhase('incomplete')).toBe('needs_info');
    expect(getKycUiPhase('awaiting_questionnaire')).toBe('needs_info');
    expect(getKycUiPhase('awaiting_ubo')).toBe('needs_info');
  });

  it('maps paused separately from rejected / review', () => {
    expect(getKycUiPhase('paused')).toBe('paused');
    expect(isKycPaused('paused')).toBe(true);
    expect(isKycInReview('paused')).toBe(false);
  });

  it('maps active to approved', () => {
    expect(getKycUiPhase('active')).toBe('approved');
    expect(isKycApproved('active')).toBe(true);
  });

  it('treats unknown status with bridgeCustomerId as unknown (not not_started)', () => {
    expect(getKycUiPhase('some_new_bridge_status', 'cus_1')).toBe('unknown');
    expect(hasSubmittedKyc(makeCustomer({
      kycStatus: 'some_new_bridge_status',
    }))).toBe(true);
  });

  it('treats kyc link pending before bridgeCustomerId exists as in_review', () => {
    expect(getKycUiPhase('pending', null)).toBe('in_review');
    expect(hasSubmittedKyc(makeCustomer({
      bridgeCustomerId: null,
      kycStatus: 'pending',
    }))).toBe(true);
  });
});

describe('normalizeKycStatus', () => {
  it('preserves actionable Bridge statuses', () => {
    expect(normalizeKycStatus('incomplete')).toBe('incomplete');
    expect(normalizeKycStatus('awaiting_questionnaire')).toBe('awaiting_questionnaire');
    expect(normalizeKycStatus('paused')).toBe('paused');
  });

  it('maps waiting variants to under_review', () => {
    expect(normalizeKycStatus('pending')).toBe('under_review');
    expect(normalizeKycStatus('processing')).toBe('under_review');
  });
});

describe('endorsementsRequireSelfieOrSof', () => {
  it('detects selfie / SOF in requirements JSON', () => {
    expect(endorsementsRequireSelfieOrSof([
      { name: 'base', status: 'incomplete', requirements: { missing: ['selfie'] } },
    ])).toBe(true);
    expect(endorsementsRequireSelfieOrSof([
      { name: 'base', status: 'incomplete', requirements: { source_of_funds: 'required' } },
    ])).toBe(true);
    expect(endorsementsRequireSelfieOrSof([
      { name: 'base', status: 'approved', requirements: { selfie: 'done' } },
    ])).toBe(false);
    expect(endorsementsRequireSelfieOrSof([
      { name: 'pix', status: 'incomplete', requirements: { tos: 'pending' } },
    ])).toBe(false);
  });
});

describe('getCustomerFacingRejectionReasons', () => {
  it('returns trimmed reasons and ignores empty rows', () => {
    expect(getCustomerFacingRejectionReasons(makeCustomer({
      rejectionReasons: [
        { reason: 'Your information could not be verified', createdAt: '2024-02-19T19:01:59.529Z' },
        { reason: '  ' },
        { reason: 'Document expired' },
      ],
    }))).toEqual([
      'Your information could not be verified',
      'Document expired',
    ]);
  });

  it('returns empty array when Bridge omitted reasons', () => {
    expect(getCustomerFacingRejectionReasons(makeCustomer({
      kycStatus: 'paused',
      rejectionReasons: [],
    }))).toEqual([]);
  });
});

describe('customerNeedsKycAdditionalInfo', () => {
  it('is true for incomplete / questionnaire statuses', () => {
    expect(customerNeedsKycAdditionalInfo(makeCustomer({ kycStatus: 'incomplete' }))).toBe(true);
    expect(customerNeedsKycAdditionalInfo(makeCustomer({
      kycStatus: 'awaiting_questionnaire',
    }))).toBe(true);
  });

  it('is true when pending but endorsement requirements ask for selfie', () => {
    expect(customerNeedsKycAdditionalInfo(makeCustomer({
      kycStatus: 'pending',
      endorsements: [
        { name: 'base', status: 'incomplete', requirements: { items: ['SOF'] } },
      ],
    }))).toBe(true);
  });

  it('is false for plain waiting review without remediations', () => {
    expect(customerNeedsKycAdditionalInfo(makeCustomer({ kycStatus: 'pending' }))).toBe(false);
    expect(customerNeedsKycAdditionalInfo(makeCustomer({ kycStatus: 'under_review' }))).toBe(false);
  });

  it('is false for paused / rejected', () => {
    expect(customerNeedsKycAdditionalInfo(makeCustomer({ kycStatus: 'paused' }))).toBe(false);
    expect(customerNeedsKycAdditionalInfo(makeCustomer({ kycStatus: 'rejected' }))).toBe(false);
  });

  it('is false once canTransact', () => {
    expect(customerNeedsKycAdditionalInfo(makeCustomer({
      kycStatus: 'incomplete',
      canTransact: true,
    }))).toBe(false);
  });
});

describe('hasSubmittedKyc', () => {
  it('does not treat sandbox reset as submitted', () => {
    expect(hasSubmittedKyc(makeCustomer({
      bridgeCustomerId: null,
      kycStatus: 'not_started',
      tosStatus: 'pending',
    }))).toBe(false);
  });

  it('treats needs_info and paused as already submitted', () => {
    expect(hasSubmittedKyc(makeCustomer({ kycStatus: 'incomplete' }))).toBe(true);
    expect(hasSubmittedKyc(makeCustomer({ kycStatus: 'paused' }))).toBe(true);
  });
});

describe('normalizeBridgeCustomer', () => {
  it('normalizes kycStatus and defaults endorsements / rejectionReasons', () => {
    const raw = makeCustomer({
      kycStatus: 'pending',
      endorsements: undefined as unknown as [],
      rejectionReasons: undefined,
    });
    expect(normalizeBridgeCustomer(raw)).toEqual({
      ...raw,
      kycStatus: 'under_review',
      endorsements: [],
      rejectionReasons: [],
      canTransact: false,
    });
  });

  it('keeps incomplete so the UI can offer continue verification', () => {
    expect(normalizeBridgeCustomer(makeCustomer({ kycStatus: 'incomplete' }))?.kycStatus)
      .toBe('incomplete');
  });

  it('keeps paused and normalizes rejectionReasons', () => {
    const normalized = normalizeBridgeCustomer(makeCustomer({
      kycStatus: 'paused',
      rejectionReasons: [
        { reason: ' Your information could not be verified ', createdAt: '2024-02-19T19:01:59.529Z' },
      ],
    }));
    expect(normalized?.kycStatus).toBe('paused');
    expect(normalized?.rejectionReasons).toEqual([
      {
        reason: 'Your information could not be verified',
        createdAt: '2024-02-19T19:01:59.529Z',
      },
    ]);
  });
});

describe('isKycInReview', () => {
  it('includes unknown phase when bridge customer exists', () => {
    expect(isKycInReview('weird_status', 'cus_1')).toBe(true);
  });

  it('includes needs_info statuses so deposit UI stays gated', () => {
    expect(isKycInReview('incomplete')).toBe(true);
  });
});
