import { describe, expect, it } from 'vitest';

import {
  extractPayerFromFundsReceived,
  normalizeDepositEvent,
  normalizeDepositRecord,
  normalizeDepositsList,
} from '../bridgeDepositNormalize';

describe('normalizeDepositRecord', () => {
  it('maps top-level payer fields and null defaults', () => {
    const deposit = normalizeDepositRecord({
      depositId: 'dep_1',
      bridgeVirtualAccountId: 'va_1',
      status: 'funds_received',
      completed: false,
      amount: '100.00',
      currency: 'usd',
      netAmount: null,
      developerFeeAmount: null,
      exchangeFeeAmount: null,
      gasFee: null,
      destinationTxHash: null,
      createdAt: '2026-06-30T12:00:00.000Z',
      updatedAt: '2026-06-30T12:00:00.000Z',
      paymentRail: 'ach_push',
      senderName: 'Jane Doe',
      accountLast4: null,
      senderBankRoutingNumber: '021000021',
      senderDescription: null,
      events: [],
    });

    expect(deposit).toMatchObject({
      paymentRail: 'ach_push',
      senderName: 'Jane Doe',
      accountLast4: null,
      senderBankRoutingNumber: '021000021',
    });
  });

  it('prefers API top-level payer over event fallback', () => {
    const deposit = normalizeDepositRecord({
      depositId: 'dep_3',
      bridgeVirtualAccountId: 'va_3',
      status: 'funds_received',
      completed: false,
      amount: '50',
      currency: 'eur',
      netAmount: null,
      developerFeeAmount: null,
      exchangeFeeAmount: null,
      gasFee: null,
      destinationTxHash: null,
      createdAt: '2026-06-30T14:00:00.000Z',
      updatedAt: '2026-06-30T14:00:00.000Z',
      senderName: 'Top Level Name',
      paymentRail: null,
      accountLast4: null,
      senderBankRoutingNumber: null,
      senderDescription: null,
      events: [
        {
          type: 'funds_received',
          occurredAt: '2026-06-30T14:00:00.000Z',
          paymentRail: 'sepa',
          senderName: 'Event Name',
          accountLast4: '9876',
          senderBankRoutingNumber: null,
          senderDescription: null,
        },
      ],
    });

    expect(deposit?.senderName).toBe('Top Level Name');
    expect(deposit?.paymentRail).toBeNull();
  });

  it('falls back to funds_received event when top-level payer is all null', () => {
    const deposit = normalizeDepositRecord({
      depositId: null,
      bridgeVirtualAccountId: 'va_2',
      status: 'payment_submitted',
      completed: false,
      amount: '250.00',
      currency: 'usd',
      netAmount: null,
      developerFeeAmount: null,
      exchangeFeeAmount: null,
      gasFee: null,
      destinationTxHash: null,
      createdAt: '2026-06-30T13:00:00.000Z',
      updatedAt: '2026-06-30T13:05:00.000Z',
      paymentRail: null,
      senderName: null,
      accountLast4: null,
      senderBankRoutingNumber: null,
      senderDescription: null,
      events: [
        {
          type: 'funds_received',
          occurredAt: '2026-06-30T13:01:00.000Z',
          amount: '250.00',
          paymentRail: 'ach_push',
          senderName: 'ACME Corp',
          senderBankRoutingNumber: '021000089',
          senderDescription: 'PAYROLL',
        },
      ],
    });

    expect(deposit).toMatchObject({
      depositId: 'va_2:2026-06-30T13:00:00.000Z',
      paymentRail: 'ach_push',
      senderName: 'ACME Corp',
      senderBankRoutingNumber: '021000089',
      senderDescription: 'PAYROLL',
    });
  });
});

describe('normalizeDepositEvent', () => {
  it('merges legacy nested source into event payer fields', () => {
    const event = normalizeDepositEvent({
      type: 'funds_received',
      occurredAt: '2026-06-30T10:00:00.000Z',
      source: {
        payment_rail: 'sepa',
        sender_name: 'Legacy Sender',
        iban_last_4: '4321',
      },
    });

    expect(event).toMatchObject({
      paymentRail: 'sepa',
      senderName: 'Legacy Sender',
      accountLast4: '4321',
    });
  });
});

describe('extractPayerFromFundsReceived', () => {
  it('uses the latest funds_received event', () => {
    const payer = extractPayerFromFundsReceived([
      normalizeDepositEvent({
        type: 'funds_received',
        occurredAt: '2026-06-30T10:00:00.000Z',
        senderName: 'Old Sender',
      })!,
      normalizeDepositEvent({
        type: 'funds_received',
        occurredAt: '2026-06-30T11:00:00.000Z',
        senderName: 'New Sender',
        paymentRail: 'wire',
      })!,
    ]);

    expect(payer).toEqual({
      paymentRail: 'wire',
      senderName: 'New Sender',
      accountLast4: null,
      senderBankRoutingNumber: null,
      senderDescription: null,
    });
  });
});

describe('normalizeDepositsList', () => {
  it('sorts by updatedAt descending', () => {
    const list = normalizeDepositsList({
      deposits: [
        {
          depositId: 'old',
          bridgeVirtualAccountId: 'va',
          status: 'payment_processed',
          completed: true,
          amount: '10',
          currency: 'usd',
          netAmount: '9.95',
          developerFeeAmount: null,
          exchangeFeeAmount: null,
          gasFee: null,
          destinationTxHash: '0xabc',
          createdAt: '2026-06-30T10:00:00.000Z',
          updatedAt: '2026-06-30T10:00:00.000Z',
          paymentRail: null,
          senderName: null,
          accountLast4: null,
          senderBankRoutingNumber: null,
          senderDescription: null,
          events: [],
        },
        {
          depositId: 'new',
          bridgeVirtualAccountId: 'va',
          status: 'funds_received',
          completed: false,
          amount: '20',
          currency: 'gbp',
          netAmount: null,
          developerFeeAmount: null,
          exchangeFeeAmount: null,
          gasFee: null,
          destinationTxHash: null,
          createdAt: '2026-06-30T15:00:00.000Z',
          updatedAt: '2026-06-30T15:10:00.000Z',
          paymentRail: 'faster_payments',
          accountLast4: '4321',
          senderName: 'John Smith',
          senderBankRoutingNumber: null,
          senderDescription: null,
          events: [],
        },
      ],
    });

    expect(list.map((d) => d.depositId)).toEqual(['new', 'old']);
  });
});
