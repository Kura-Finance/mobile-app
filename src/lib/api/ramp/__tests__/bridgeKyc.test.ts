import { describe, expect, it } from 'vitest';
import {
  getKycUiPhase,
  hasSubmittedKyc,
  isKycApproved,
  isKycInReview,
  normalizeBridgeCustomer,
  normalizeKycStatus,
} from '../bridgeKyc';
import type { BridgeCustomer } from '../client';

describe('getKycUiPhase', () => {
  it('maps Bridge review variants to in_review', () => {
    expect(getKycUiPhase('pending')).toBe('in_review');
    expect(getKycUiPhase('in_review')).toBe('in_review');
    expect(getKycUiPhase('incomplete')).toBe('in_review');
    expect(getKycUiPhase('processing')).toBe('in_review');
  });

  it('maps active to approved', () => {
    expect(getKycUiPhase('active')).toBe('approved');
    expect(isKycApproved('active')).toBe(true);
  });

  it('treats unknown status with bridgeCustomerId as unknown (not not_started)', () => {
    expect(getKycUiPhase('some_new_bridge_status', 'cus_1')).toBe('unknown');
    expect(hasSubmittedKyc({
      bridgeCustomerId: 'cus_1',
      customerType: 'individual',
      kycStatus: 'some_new_bridge_status',
      tosStatus: 'approved',
      endorsements: [],
      canTransact: false,
    })).toBe(true);
  });

  it('treats kyc link pending before bridgeCustomerId exists as in_review', () => {
    expect(getKycUiPhase('pending', null)).toBe('in_review');
    expect(hasSubmittedKyc({
      bridgeCustomerId: null,
      customerType: 'individual',
      kycStatus: 'pending',
      tosStatus: 'approved',
      endorsements: [],
      canTransact: false,
    })).toBe(true);
  });
});

describe('normalizeKycStatus', () => {
  it('maps backend review variants to under_review', () => {
    expect(normalizeKycStatus('pending')).toBe('under_review');
    expect(normalizeKycStatus('incomplete')).toBe('under_review');
  });
});

describe('hasSubmittedKyc', () => {
  it('does not treat sandbox reset as submitted', () => {
    const customer: BridgeCustomer = {
      bridgeCustomerId: null,
      customerType: 'individual',
      kycStatus: 'not_started',
      tosStatus: 'pending',
      endorsements: [],
      canTransact: false,
    };
    expect(hasSubmittedKyc(customer)).toBe(false);
  });
});

describe('normalizeBridgeCustomer', () => {
  it('normalizes kycStatus and defaults endorsements', () => {
    const raw: BridgeCustomer = {
      bridgeCustomerId: 'cus_1',
      customerType: 'individual',
      kycStatus: 'pending',
      tosStatus: 'approved',
      endorsements: undefined as unknown as [],
      canTransact: false,
    };
    expect(normalizeBridgeCustomer(raw)).toEqual({
      ...raw,
      kycStatus: 'under_review',
      endorsements: [],
      canTransact: false,
    });
  });
});

describe('isKycInReview', () => {
  it('includes unknown phase when bridge customer exists', () => {
    expect(isKycInReview('weird_status', 'cus_1')).toBe(true);
  });
});
