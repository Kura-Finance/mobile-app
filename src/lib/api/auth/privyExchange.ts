/**
 * Kura login via Privy access token.
 *
 * Endpoint: POST /api/auth/login
 * Headers:  X-Client-Type: mobile
 * Body:     { accessToken, identityToken?, referralCode? }
 * Response: { token, user, needsKeyPairSetup, emailConflict }
 */

import { requestJson } from '../client';
import { userProfileV1Schema, type UserProfileV1 } from './schemas';

export interface PrivyLoginResult {
  token: string;
  user: UserProfileV1;
  needsKeyPairSetup: boolean;
  emailConflict: boolean;
}

interface KuraLoginResponse {
  token: string;
  user: unknown;
  needsKeyPairSetup: boolean;
  emailConflict?: boolean;
}

/**
 * Exchange Privy tokens for a Kura JWT + full user profile.
 *
 * Pass `identityToken` whenever available so the backend can resolve email /
 * wallet from Privy OIDC claims. Omit when the device could not obtain it.
 */
export async function exchangePrivyToken(
  accessToken: string,
  identityToken?: string | null,
  referralCode?: string | null,
): Promise<PrivyLoginResult> {
  const body: Record<string, string> = { accessToken };
  if (identityToken) body.identityToken = identityToken;
  if (referralCode?.trim()) body.referralCode = referralCode.trim().toUpperCase();

  const res = await requestJson<KuraLoginResponse>('/api/auth/login', {
    method: 'POST',
    skipAuth: true,
    headers: {
      'X-Client-Type': 'mobile',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return {
    token: res.token,
    user: userProfileV1Schema.parse(res.user),
    needsKeyPairSetup: res.needsKeyPairSetup,
    emailConflict: res.emailConflict === true,
  };
}
