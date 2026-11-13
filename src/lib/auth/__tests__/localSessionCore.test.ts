import { describe, expect, it } from 'vitest';
import { userProfileV1Schema } from '../../api/auth/schemas';
import { buildLocalProfile, localUserId, parseLocalProfileOverlay } from '../localSessionCore';

const EOA = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';

describe('localUserId', () => {
  it('is stable regardless of address casing', () => {
    expect(localUserId(EOA)).toBe('local:0x9858effd232b4033e47d90003d41ec34ecaeda94');
    expect(localUserId(EOA.toLowerCase())).toBe(localUserId(EOA));
  });
});

describe('buildLocalProfile', () => {
  it('produces a profile the app schema accepts, with no account data', () => {
    const profile = buildLocalProfile(localUserId(EOA));
    expect(() => userProfileV1Schema.parse(profile)).not.toThrow();
    expect(profile).toMatchObject({
      id: localUserId(EOA),
      emailIsPlaceholder: true,
      displayName: '',
      hasName: false,
      avatarUrl: '',
      membershipLabel: '',
    });
  });

  it('applies the name and avatar kept on the device', () => {
    const profile = buildLocalProfile(localUserId(EOA), {
      displayName: ' Ada ',
      avatarUrl: 'data:image/jpeg;base64,AA',
    });
    expect(profile).toMatchObject({
      displayName: 'Ada',
      hasName: true,
      avatarUrl: 'data:image/jpeg;base64,AA',
    });
  });

  it('caps the display name at 50 characters', () => {
    const profile = buildLocalProfile(localUserId(EOA), { displayName: 'x'.repeat(80) });
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
