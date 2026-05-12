import { describe, expect, it } from 'vitest';
import { isWalletConnectPairingUri, parseWalletConnectDeepLink } from '../deepLink';

const PAIRING_URI =
  'wc:7f6e504bfad60b485450578e05678ed3e8e8c4751d3c6160be17160d63ec90f9@2?relay-protocol=irn&symKey=587d5484ce2a2a6ee3ba1962fdd7e8588e06200c46823bd18fbd67def96ad303';

describe('parseWalletConnectDeepLink', () => {
  it('parses native deep link with encoded uri param', () => {
    const url = `kura://wc?uri=${encodeURIComponent(PAIRING_URI)}`;
    expect(parseWalletConnectDeepLink(url)).toBe(PAIRING_URI);
  });

  it('parses native deep link with raw uri param', () => {
    const url = `kura://wc?uri=${PAIRING_URI}`;
    expect(parseWalletConnectDeepLink(url)).toBe(PAIRING_URI);
  });

  it('parses native deep link with triple-slash path (AppKit formatNativeUrl)', () => {
    const url = `kura:///wc?uri=${encodeURIComponent(PAIRING_URI)}`;
    expect(parseWalletConnectDeepLink(url)).toBe(PAIRING_URI);
  });

  it('parses universal link on kura-finance.com', () => {
    const url = `https://kura-finance.com/dashboard/wc?uri=${encodeURIComponent(PAIRING_URI)}`;
    expect(parseWalletConnectDeepLink(url)).toBe(PAIRING_URI);
  });

  it('ignores incomplete session-request deep links', () => {
    expect(isWalletConnectPairingUri('wc:00e46b69-d0cc-4b3e-b6a2-cee442f97188@2')).toBe(false);
    expect(parseWalletConnectDeepLink('kura://wc?uri=wc:00e46b69-d0cc-4b3e-b6a2-cee442f97188@2')).toBeNull();
  });
});
