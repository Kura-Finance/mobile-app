import { describe, expect, test } from 'vitest';
import {
  BRIDGE_VA_ONRAMP,
  buildBridgeFiatDepositBullets,
  formatBridgeLimitLabel,
  resolveBridgeArrivalKey,
  resolveMinDepositLabel,
} from '../bridgeDepositInfo';

const t = ((key: string, opts?: { defaultValue?: string; amount?: string; currency?: string; limit?: string; timing?: string; fee?: string }) => {
  const map: Record<string, string> = {
    'card.depositBulletMin': `Minimum deposit: ${opts?.amount}`,
    'card.depositBulletOwnAccount': `From your own account: ${opts?.limit}`,
    'card.depositBulletAnotherPerson': `From another person: ${opts?.limit}`,
    'card.depositBulletBusiness': `From a business: ${opts?.limit}`,
    'card.depositBulletArrive': opts?.timing ?? '',
    'card.depositBulletFee': `Deposit fee: ${opts?.fee}`,
    'card.bridgeLimitUnlimited': 'No limit',
    'card.bridgeLimitContactAccountManager': 'Contact account manager',
    'card.bridgeLimitUpTo': `Up to ${opts?.amount} ${opts?.currency} per transfer`,
    'card.bridgeLimitP2pUnder': `Less than ${opts?.amount} ${opts?.currency} per person-to-person transfer`,
    'card.bridgeArrival.spei': 'Arrives within minutes (SPEI settles in seconds)',
    'card.bridgeArrival.usdAch': 'Arrives in 1–3 business days (ACH)',
    'card.bridgeArrival.usdWire': 'Arrives same business day (Wire)',
  };
  return map[key] ?? opts?.defaultValue ?? key;
}) as never;

describe('bridgeDepositInfo', () => {
  test('MXN limits match Bridge rail-specific docs', () => {
    expect(BRIDGE_VA_ONRAMP.mxn.ownAccount).toEqual({
      kind: 'up_to',
      amount: '1,000,000',
      currency: 'MXN',
    });
    expect(BRIDGE_VA_ONRAMP.mxn.anotherPerson).toEqual({
      kind: 'up_to',
      amount: '15,000',
      currency: 'MXN',
    });
  });

  test('prefers API minDeposit over Bridge doc fallback', () => {
    expect(
      resolveMinDepositLabel({ amount: '50', currency: 'mxn' }, BRIDGE_VA_ONRAMP.mxn.docMin),
    ).toBe('50 MXN');
  });

  test('falls back to Bridge doc minimum', () => {
    expect(resolveMinDepositLabel(null, BRIDGE_VA_ONRAMP.mxn.docMin)).toBe('50 MXN');
  });

  test('builds MXN bullets with Bridge arrival text', () => {
    const bullets = buildBridgeFiatDepositBullets('mxn', t, {
      minDeposit: { amount: '50', currency: 'mxn' },
      feeLabel: '0.5% USDC',
    });
    expect(bullets[0]).toBe('Minimum deposit: 50 MXN');
    expect(bullets[1]).toBe('From your own account: Up to 1,000,000 MXN per transfer');
    expect(bullets[2]).toBe('From another person: Up to 15,000 MXN per transfer');
    expect(bullets[3]).toBe('From a business: No limit');
    expect(bullets[4]).toBe('Arrives within minutes (SPEI settles in seconds)');
    expect(bullets[5]).toBe('Deposit fee: 0.5% USDC');
  });

  test('USD wire rail uses faster arrival copy', () => {
    expect(resolveBridgeArrivalKey('usd', ['ach_push', 'wire'])).toBe('usdWire');
    expect(formatBridgeLimitLabel(BRIDGE_VA_ONRAMP.usd.anotherPerson, t)).toBe(
      'Less than 4,000 USD per person-to-person transfer',
    );
  });
});
