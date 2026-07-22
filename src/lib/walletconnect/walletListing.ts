import type { CustomWallet } from '@reown/appkit-common-react-native';
import { brand } from '../../config/branding';
import { env } from '../../config/env';

/** Stable id for AppKit customWallets / featuredWalletIds. Share with partner dApps. */
export const WALLET_ID = brand.walletId;
/** @deprecated Prefer {@link WALLET_ID}. */
export const KURA_WALLET_ID = WALLET_ID;

export const WALLET_HOMEPAGE = brand.homepage;
/** @deprecated Prefer {@link WALLET_HOMEPAGE}. */
export const KURA_WALLET_HOMEPAGE = WALLET_HOMEPAGE;

/** Public wallet icon — AppKit customWallets, WalletKit metadata, WalletGuide. */
export const WALLET_ICON = env.walletIconUrl || brand.defaultIconUrl;
/** @deprecated Prefer {@link WALLET_ICON}. */
export const KURA_WALLET_ICON = WALLET_ICON;

export const WALLET_METADATA_ICONS = [WALLET_ICON];
/** @deprecated Prefer {@link WALLET_METADATA_ICONS}. */
export const KURA_WALLET_METADATA_ICONS = WALLET_METADATA_ICONS;

/** Native scheme registered in app.config.branding.js. */
export const WALLET_NATIVE_LINK = `${brand.scheme}://`;
/** @deprecated Prefer {@link WALLET_NATIVE_LINK}. */
export const KURA_WALLET_NATIVE_LINK = WALLET_NATIVE_LINK;

/** Universal link base for WalletConnect link-mode (app.config associatedDomains). */
export const WALLET_UNIVERSAL_LINK = brand.universalLinkDashboard;
/** @deprecated Prefer {@link WALLET_UNIVERSAL_LINK}. */
export const KURA_WALLET_UNIVERSAL_LINK = WALLET_UNIVERSAL_LINK;

/**
 * AppKit `customWallets` entry so this wallet appears in connect modals before
 * WalletGuide listing. Partner dApps can copy this object into their AppKit config.
 */
export const CUSTOM_WALLET: CustomWallet = {
  id: WALLET_ID,
  name: brand.walletName,
  homepage: WALLET_HOMEPAGE,
  image_url: WALLET_ICON,
  mobile_link: WALLET_NATIVE_LINK,
  link_mode: WALLET_UNIVERSAL_LINK,
  ios_schema: brand.scheme,
  android_app_id: brand.bundleId,
};
/** @deprecated Prefer {@link CUSTOM_WALLET}. */
export const KURA_CUSTOM_WALLET = CUSTOM_WALLET;
