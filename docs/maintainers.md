# Maintainers map / 維護地圖

**English** | [中文](#中文)

Where to change what when maintaining this client. Prefer config modules over scattering `process.env` or hard-coded brand strings.

**Hub:** [docs/README.md](README.md) · **Handover:** [handover.md](handover.md) · **Rebrand:** [fork-guide.md](fork-guide.md)

---

## English

### Change brand only

Full visual tokens (colors, logos, icons): [brand-identity.md](brand-identity.md).

Edit **both** (must stay in sync):

| File | Native / Expo | Runtime TS |
|------|---------------|------------|
| [`app.config.branding.js`](../app.config.branding.js) | name, slug, bundle ID, scheme, associated domains | — |
| [`src/config/branding.ts`](../src/config/branding.ts) | — | WC metadata, homepage, legal host, passkey RP |

Also replace `assets/` icons. Then `npx expo prebuild --clean`.

### Change env / secrets

| Concern | Module |
|---------|--------|
| All `EXPO_PUBLIC_*` reads | [`src/config/env.ts`](../src/config/env.ts) |
| Feature gates | [`src/config/features.ts`](../src/config/features.ts) — uses `hasAppBackend()` |
| Morpho Earn allowlist / optional fee-wrapper | [`src/config/earn.ts`](../src/config/earn.ts), [`earnFeeWrapper.ts`](../src/config/earnFeeWrapper.ts) |
| Template | [`.env.example`](../.env.example) |
| Release `extra` embedding | [`app.config.js`](../app.config.js) |

Primary helpers (legacy aliases still exported):

| Prefer | Legacy alias |
|--------|--------------|
| `hasAppBackend` / `assertAppBackend` | `hasKuraBackend` / `assertKuraBackend` |
| `env.walletIconUrl` / `EXPO_PUBLIC_WALLET_ICON_URL` | `EXPO_PUBLIC_KURA_WALLET_ICON_URL` |

### Module map

```
App.tsx                 Privy, navigation, boot
src/config/             Brand, env, features, earn
src/features/           Screens (card, crypto, trackfi, earn, walletconnect, …)
src/lib/api/            HTTP + Zod (needs backend URL for most routes)
src/lib/wallet/         Safe SCA (viem + permissionless)
src/lib/walletconnect/  walletKit.ts, walletListing.ts, session router
src/lib/crypto/         E2EE / passkey helpers
src/shared/             Navigation, Zustand, theme, i18n, AppKitConfig
```

WalletConnect:

| Prefer | Legacy shim |
|--------|-------------|
| [`walletKit.ts`](../src/lib/walletconnect/walletKit.ts) (`getWalletKit`) | `kuraWalletKit.ts` |
| [`walletListing.ts`](../src/lib/walletconnect/walletListing.ts) (`WALLET_ID`, `CUSTOM_WALLET`) | `kuraWalletListing.ts` |

UI providers such as `KuraWalletConnectProvider` keep product-oriented names; kit logic lives in the neutral modules above.

### Wallet-only vs full backend

| Mode | Config | Visible product |
|------|--------|-----------------|
| Wallet-only | Empty `EXPO_PUBLIC_API_BASE_URL` | Login, SCA, swap/bridge, WC, Morpho Earn (default on) |
| Full | Backend URL set | + TrackFi, Plaid, DeBank, Dinari (`features.*` all gate on `hasAppBackend()`) |

Dinari is **on whenever the backend URL is set** (`features.dinariStocks`), not hard-off.

### Verify before shipping

```bash
npm install
npm run lint
npm test
npx tsc --noEmit
npx expo prebuild   # after branding / plugin changes
npx expo run:ios    # or run:android
```

Store release: [local-release.md](local-release.md). Secrets leak: [secrets-rotation.md](secrets-rotation.md).

---

## 中文

### 只改品牌

同步改 `app.config.branding.js` 与 `src/config/branding.ts`，替换 `assets/`，再 `prebuild --clean`。

### 配置入口

所有环境变量经 `env.ts`；功能开关在 `features.ts`（`hasAppBackend()`）；Earn 见 `earn.ts`（直接存入官方 Morpho vault）。优先使用新 API 名，旧 `Kura*` / `EXPO_PUBLIC_KURA_*` 仍兼容。

### 模块

`src/config` 配置 · `src/features` 界面 · `src/lib` 钱包 / API / WC · `src/shared` 导航与主题。WC 请用 `walletKit.ts` / `walletListing.ts`。

### 模式

无后端 URL = 仅钱包；有 URL = 打开 TrackFi / Dinari 等。验证：`lint` + `test` + `tsc` + 真机。
