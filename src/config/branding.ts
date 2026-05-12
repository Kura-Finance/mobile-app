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
  defaultIconUrl: 'https://kura-finance.com/icon.png',
  webCredentialsHost: 'api.kura-finance.com',
  universalLinkHost: 'kura-finance.com',
  universalLinkDashboard: 'https://kura-finance.com/dashboard',
  walletId: 'kura-wallet',
  walletName: 'Kura',
  appDescription:
    'One app to manage all your finances, from tradFi to crypto.',
} as const;
