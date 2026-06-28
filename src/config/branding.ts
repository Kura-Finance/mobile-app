/**
 * Fork-friendly brand constants for TypeScript modules.
 *
 * Keep in sync with app.config.branding.js (native bundle id, schemes,
 * associated domains). See docs/fork-guide.md.
 */
export const brand = {
  appName: 'Kura',
  slug: 'kura',
  bundleId: 'com.kurafinance.app',
  scheme: 'kura',
  homepage: 'https://kura-finance.com',
  signupUrl: 'https://app.kura-finance.com/signup',
  defaultIconUrl: 'https://kura-finance.com/icon.png',
  webCredentialsHost: 'api.kura-finance.com',
  universalLinkHost: 'kura-finance.com',
  universalLinkDashboard: 'https://app.kura-finance.com/dashboard',
  walletId: 'kura-wallet',
  walletName: 'Kura',
  /** WebAuthn relying party display name (passkey registration). */
  passkeyRpName: 'Kura Finance',
  /** WalletConnect / WalletKit metadata description. */
  walletKitDescription: 'Kura Safe Smart Account on Base',
  appDescription:
    'One app to manage all your finances, from tradFi to crypto.',
} as const;
