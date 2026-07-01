import { describe, expect, it } from 'vitest';

import {
  formatDepositPayer,
  getDepositStatusBucket,
  hasPendingBridgeDeposits,
  shouldShowDepositAccountLast4,
} from '../bridgeDepositDisplay';

describe('formatDepositPayer', () => {
  it('shows name and routing for ACH (no last4 placeholder)', () => {
    expect(
      formatDepositPayer({
        paymentRail: 'ach_push',
        senderName: 'Demo Sender LLC',
        accountLast4: null,
        senderBankRoutingNumber: '021000021',
        senderDescription: 'PAYROLL',
      }),
    ).toBe('Demo Sender LLC · Routing 021000021');
  });

  it('shows name and last4 for SEPA', () => {
    expect(
      formatDepositPayer({
        paymentRail: 'sepa',
        senderName: 'Demo Sender GmbH',
        accountLast4: '4321',
        senderBankRoutingNumber: null,
        senderDescription: null,
      }),
    ).toBe('Demo Sender GmbH · ****4321');
  });

  it('shows name only for wire when no tail digits', () => {
    expect(
      formatDepositPayer({
        paymentRail: 'wire',
        senderName: 'John Smith',
        accountLast4: null,
        senderBankRoutingNumber: null,
        senderDescription: null,
      }),
    ).toBe('John Smith');
  });

  it('returns null when all payer fields empty', () => {
    expect(
      formatDepositPayer({
        paymentRail: null,
        senderName: null,
        accountLast4: null,
        senderBankRoutingNumber: null,
        senderDescription: null,
      }),
    ).toBeNull();
  });
});

describe('shouldShowDepositAccountLast4', () => {
  it('hides last4 for ach_push and wire', () => {
    expect(shouldShowDepositAccountLast4('ach_push', '1234')).toBe(false);
    expect(shouldShowDepositAccountLast4('wire', '1234')).toBe(false);
    expect(shouldShowDepositAccountLast4('faster_payments', '5678')).toBe(true);
  });
});

describe('getDepositStatusBucket', () => {
  it('maps funds_received to processing', () => {
    expect(getDepositStatusBucket({ completed: false, status: 'funds_received' })).toBe('processing');
  });

  it('maps completed flag to completed', () => {
    expect(getDepositStatusBucket({ completed: true, status: 'payment_processed' })).toBe('completed');
  });
});

describe('hasPendingBridgeDeposits', () => {
  it('is true only for incomplete funds_received rows', () => {
    expect(
      hasPendingBridgeDeposits([
        { completed: false, status: 'funds_received' },
        { completed: false, status: 'payment_submitted' },
      ]),
    ).toBe(true);
    expect(
      hasPendingBridgeDeposits([{ completed: false, status: 'payment_submitted' }]),
    ).toBe(false);
  });
});
