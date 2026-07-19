/** Placeholder values that must never ship in production builds. */
export const INVALID_WALLET_CONNECT_PROJECT_IDS = ['development_project_id'] as const;

export function normalizeWalletConnectProjectId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if ((INVALID_WALLET_CONNECT_PROJECT_IDS as readonly string[]).includes(trimmed)) {
    return '';
  }
  return trimmed;
}

export function assertValidWalletConnectProjectId(projectId: string): string {
  const normalized = normalizeWalletConnectProjectId(projectId);
  if (!normalized) {
    throw new Error(
      'EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID is not configured. ' +
        'Obtain a project ID from https://dashboard.reown.com/ and set it in your environment (.env), then rebuild.',
    );
  }
  return normalized;
}
