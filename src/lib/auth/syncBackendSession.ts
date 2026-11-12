import type Privy from '@privy-io/js-sdk-core';
import { fetchCurrentUserProfile } from '../api/auth/me';
import { exchangePrivyToken } from '../api/auth/privyExchange';
import { fetchIdentityTokenWithRetry } from './privyTokens';
import { useAppStore } from '../../shared/store/useAppStore';
import Logger from '../../shared/utils/Logger';

/**
 * Re-exchange Privy tokens with the Kura backend after a Privy-side profile
 * change (e.g. linking or updating email), then refresh from `/api/auth/me`.
 */
export async function syncBackendSessionAfterPrivyChange(params: {
  getAccessToken: () => Promise<string | null>;
  getIdentityToken: () => Promise<string | null>;
  privyClient: Privy;
}): Promise<void> {
  const { getAccessToken, getIdentityToken, privyClient } = params;

  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Missing access token');
  }

  await privyClient.user.get();
  let identityToken = await fetchIdentityTokenWithRetry(
    getIdentityToken,
    4,
    800,
    'SyncBackendSession',
  );

  if (!identityToken) {
    await privyClient.user.get();
    identityToken = await getIdentityToken();
  }

  const login = await exchangePrivyToken(accessToken, identityToken);
  useAppStore.getState().setPrivySession(login.token, login.user);

  const fresh = await fetchCurrentUserProfile();
  useAppStore.getState().refreshUserProfile(fresh);

  Logger.info('SyncBackendSession', 'Backend session refreshed after Privy profile change', {
    backendUserId: fresh.id,
    emailIsPlaceholder: fresh.emailIsPlaceholder,
    emailConflict: login.emailConflict,
  });
}
