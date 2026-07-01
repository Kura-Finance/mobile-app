import { describe, expect, test } from 'vitest';
import {
  BRIDGE_POLL_DEPOSIT_PENDING_MS,
  BRIDGE_POLL_IDLE_MS,
  BRIDGE_POLL_PAYOUT_PENDING_MS,
  resolveBridgePollIntervalMs,
} from '../bridgePollConfig';

describe('resolveBridgePollIntervalMs', () => {
  test('idle when no pending activity', () => {
    expect(resolveBridgePollIntervalMs({})).toBe(BRIDGE_POLL_IDLE_MS);
  });

  test('deposit pending beats idle', () => {
    expect(resolveBridgePollIntervalMs({ hasPendingFundsReceived: true })).toBe(
      BRIDGE_POLL_DEPOSIT_PENDING_MS,
    );
  });

  test('payout pending is slowest', () => {
    expect(
      resolveBridgePollIntervalMs({
        hasPendingFundsReceived: true,
        hasPendingPayoutDrains: true,
      }),
    ).toBe(BRIDGE_POLL_PAYOUT_PENDING_MS);
  });
});
