import { describe, expect, it } from 'vitest';
import {
  allowedHostsFromSeedUrl,
  hostFromUrl,
  isAllowedWebViewHost,
  shouldAllowWebViewNavigation,
} from '../webviewAllowlist';

describe('webviewAllowlist', () => {
  it('extracts host from https URL', () => {
    expect(hostFromUrl('https://buy.example.com/foo')).toBe('buy.example.com');
  });

  it('allows exact and subdomain matches', () => {
    expect(isAllowedWebViewHost('https://buy.example.com/', ['example.com'])).toBe(true);
    expect(isAllowedWebViewHost('https://cdn.example.com/asset', ['example.com'])).toBe(true);
    expect(isAllowedWebViewHost('https://evil-example.com/', ['example.com'])).toBe(false);
  });

  it('rejects non-https navigation', () => {
    expect(isAllowedWebViewHost('http://buy.example.com/', ['example.com'])).toBe(false);
    expect(isAllowedWebViewHost('javascript:alert(1)', ['example.com'])).toBe(false);
  });

  it('allows about:blank', () => {
    expect(shouldAllowWebViewNavigation('about:blank', [])).toBe(true);
  });

  it('derives seed hosts from embed URL', () => {
    expect(allowedHostsFromSeedUrl('https://verify.withpersona.com/verify/abc')).toEqual([
      'verify.withpersona.com',
    ]);
  });
});
