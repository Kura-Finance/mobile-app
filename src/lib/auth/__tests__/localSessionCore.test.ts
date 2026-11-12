import { describe, expect, it } from 'vitest';
import { userProfileV1Schema } from '../../api/auth/schemas';
import {
  buildLocalProfile,
  parseLocalProfileOverlay,
  resolvePrivyEmail,
} from '../localSessionCore';

describe('resolvePrivyEmail', () => {
  it('prefers the email login over OAuth emails', () => {
    expect(
      resolvePrivyEmail({
        id: 'did:privy:1',
        linked_accounts: [
          { type: 'google_oauth', email: 'g@example.com' },
          { type: 'email', address: 'Me@Example.com ' },
        ],
      }),
    ).toBe('me@example.com');
  });

  it('falls back to Google, then Apple', () => {
    expect(
      resolvePrivyEmail({
        id: 'did:privy:1',
        linked_accounts: [
          { type: 'apple_oauth', email: 'a@example.com' },
          { type: 'google_oauth', email: 'g@example.com' },
        ],
      }),
    ).toBe('g@example.com');
    expect(
      resolvePrivyEmail({
        id: 'did:privy:1',
        linked_accounts: [{ type: 'apple_oauth', email: 'a@example.com' }],
      }),
    ).toBe('a@example.com');
  });

  it('returns null when no account carries an email', () => {
    expect(
      resolvePrivyEmail({ id: 'did:privy:1', linked_accounts: [{ type: 'wallet' }] }),
    ).toBeNull();
    expect(resolvePrivyEmail({ id: 'did:privy:1' })).toBeNull();
  });
});

describe('buildLocalProfile', () => {
  it('produces a profile the app schema accepts when nothing is linked', () => {
    const profile = buildLocalProfile({ id: 'did:privy:1', linked_accounts: [] });
    expect(() => userProfileV1Schema.parse(profile)).not.toThrow();
    expect(profile).toMatchObject({
      id: 'did:privy:1',
      emailIsPlaceholder: true,
      displayName: '',
      hasName: false,
      avatarUrl: '',
      membershipLabel: '',
    });
  });

  it('uses the Google name until the user sets one on the device', () => {
    const user = {
      id: 'did:privy:1',
      linked_accounts: [{ type: 'google_oauth', email: 'g@example.com', name: 'Ada Lovelace' }],
    };
    expect(buildLocalProfile(user)).toMatchObject({
      email: 'g@example.com',
      emailIsPlaceholder: false,
      displayName: 'Ada Lovelace',
      hasName: true,
    });
    expect(buildLocalProfile(user, { displayName: 'Ada' }).displayName).toBe('Ada');
  });

  it('caps the display name at 50 characters', () => {
    const profile = buildLocalProfile({ id: 'did:privy:1' }, { displayName: 'x'.repeat(80) });
    expect(profile.displayName).toHaveLength(50);
  });
});

describe('parseLocalProfileOverlay', () => {
  it('keeps known string fields and ignores everything else', () => {
    expect(
      parseLocalProfileOverlay(
        JSON.stringify({ displayName: ' Ada ', avatarUrl: 'data:image/jpeg;base64,AA', extra: 1 }),
      ),
    ).toEqual({ displayName: 'Ada', avatarUrl: 'data:image/jpeg;base64,AA' });
  });

  it('returns an empty overlay for missing or corrupt data', () => {
    expect(parseLocalProfileOverlay(null)).toEqual({});
    expect(parseLocalProfileOverlay('{not json')).toEqual({});
    expect(parseLocalProfileOverlay('"a string"')).toEqual({});
    expect(parseLocalProfileOverlay(JSON.stringify({ displayName: 42 }))).toEqual({});
  });
});
