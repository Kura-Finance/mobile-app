import type { CustomWallet } from '@reown/appkit-common-react-native';
import { brand } from '../../config/branding';
import { env } from '../../config/env';

/** Stable id for AppKit customWallets / featuredWalletIds. Share with partner dApps. */
export const KURA_WALLET_ID = brand.walletId;

export const KURA_WALLET_HOMEPAGE = brand.homepage;

/** Public wallet icon — AppKit customWallets, WalletKit metadata, WalletGuide. */
export const KURA_WALLET_ICON =
  env.kuraWalletIconUrl || brand.defaultIconUrl;

export const KURA_WALLET_METADATA_ICONS = [KURA_WALLET_ICON];

/** Native scheme registered in app.config.branding.js. */
export const KURA_WALLET_NATIVE_LINK = `${brand.scheme}://`;

/** Universal link base for WalletConnect link-mode (app.config associatedDomains). */
export const KURA_WALLET_UNIVERSAL_LINK = brand.universalLinkDashboard;

/**
 * AppKit `customWallets` entry so Kura appears in connect modals before
 * WalletGuide listing. Partner dApps can copy this object into their AppKit config.
 */
export const KURA_CUSTOM_WALLET: CustomWallet = {
  id: KURA_WALLET_ID,
  name: brand.walletName,
  homepage: KURA_WALLET_HOMEPAGE,
  image_url: KURA_WALLET_ICON,
  mobile_link: KURA_WALLET_NATIVE_LINK,
  link_mode: KURA_WALLET_UNIVERSAL_LINK,
  ios_schema: brand.scheme,
  android_app_id: brand.bundleId,
};
