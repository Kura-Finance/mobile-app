# Rebrand guide / 換牌指南

**English** | [中文](#中文)

Rebrand or fork the mobile client for an alternate brand build. The **hosted backend is not included**. Kura trademarks are not granted by the MIT license — see [NOTICE](../NOTICE), [official-services.md](official-services.md), and [transparency.md](transparency.md).

**Hub:** [docs/README.md](README.md) · **Before publishing:** update [SECURITY.md](../SECURITY.md) contact, follow [secrets-rotation.md](secrets-rotation.md), and comply with [LICENSE](../LICENSE).

---

## English

### 1. Brand identity

Edit **both** files so native (Expo) and TypeScript stay in sync:

| File | Purpose |
|------|---------|
| [`app.config.branding.js`](../app.config.branding.js) | App name, slug, bundle ID, URL scheme, associated domains |
| [`src/config/branding.ts`](../src/config/branding.ts) | WalletConnect metadata, AppKit, universal links, homepage |

Typical changes:

| Field | Example |
|-------|---------|
| `appName` / `walletName` | `"MyWallet"` |
| `bundleId` | `com.example.mywallet` (unique on stores) |
| `scheme` | Deep link scheme, e.g. `mywallet://` |
| `homepage` | `https://example.com` |
| `webCredentialsHost` | Passkey RP ID / web credentials host |
| `passkeyRpName` | WebAuthn relying party display name |
| `walletKitDescription` | WalletConnect WalletKit metadata |
| `universalLinkHost` | App Links / Universal Links host |
| `walletId` | Stable ID for Reown WalletGuide |

Replace assets: `assets/icon.png`, `splash-icon.png`, `adaptive-icon.png`, `card.webp` (web favicon reuses `icon.png`). Full color / logo / icon inventory: [brand-identity.md](brand-identity.md).

Update [`app.config.js`](../app.config.js) `version` when shipping releases.

### 2. Environment variables

```bash
cp .env.example .env
```

All runtime config → [`src/config/env.ts`](../src/config/env.ts). Never scatter `process.env` in feature code.

Critical vars also mirrored in `app.config.js` → `extra` for release builds:

| `extra` key | Env var |
|-------------|---------|
| `privyAppId` | `EXPO_PUBLIC_PRIVY_APP_ID` |
| `privyClientId` | `EXPO_PUBLIC_PRIVY_CLIENT_ID` |
| `backendUrl` | `EXPO_PUBLIC_API_BASE_URL` |
| `walletConnectProjectId` | `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID` |
| `logodevToken` | `EXPO_PUBLIC_LOGODEV_TOKEN` |

#### Variable reference

| Variable | Required for | Notes |
|----------|--------------|-------|
| `EXPO_PUBLIC_PRIVY_APP_ID` | Login | [Privy](https://dashboard.privy.io) — register bundle ID |
| `EXPO_PUBLIC_PRIVY_CLIENT_ID` | Login (mobile) | Same dashboard |
| `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect | [Reown Cloud](https://cloud.reown.com) |
| `EXPO_PUBLIC_PIMLICO_API_KEY` | USDC gas paymaster | Optional — without key: public bundler + ETH gas |
| `EXPO_PUBLIC_BASE_RPC_URL` | On-chain reads | Defaults to free `https://mainnet.base.org` |
| `EXPO_PUBLIC_API_BASE_URL` | TrackFi, Dinari, auth JWT | Optional; empty = wallet-only |
| `EXPO_PUBLIC_LOGODEV_TOKEN` | Logos | Optional — glyphs / Clearbit if unset |
| `EXPO_PUBLIC_LIFI_API_KEY` | Li.Fi rate limits | Optional — public API works without key |
| `EXPO_PUBLIC_LIFI_INTEGRATOR` + `EXPO_PUBLIC_LIFI_FEE` | Li.Fi integrator fee | Optional — both required to collect |
| `EXPO_PUBLIC_COINGECKO_API_KEY` | Price rate limits | Optional — public API works without key |
| `EXPO_PUBLIC_MORPHO_EARN_ENABLED` | Invest → Earn tab | Default on |
| `EXPO_PUBLIC_MORPHO_EARN_VAULT_ALLOWLIST` | Vault addresses (JSON array) | Default Steakhouse USDC + Gauntlet EURC Balanced + USDC |
| `EXPO_PUBLIC_MORPHO_EARN_FEE` | Yield performance fee (0–1) | Optional — unset / 0 = direct Morpho |
| `EXPO_PUBLIC_EARN_FEE_RECIPIENT` | Fee treasury | Optional; legacy `EXPO_PUBLIC_KURA_EARN_FEE_RECIPIENT` |
| `EXPO_PUBLIC_MORPHO_FEE_WRAPPER_OVERRIDES` | Inner → fee-wrapper JSON map | Optional — see `earnFeeWrapper.ts` |
| `EXPO_PUBLIC_MORPHO_FEE_WRAPPER_AUTO_DISCOVER` | Morpho API wrapper discovery | Optional — default off |
| `EXPO_PUBLIC_WALLET_ICON_URL` | AppKit / WalletKit icon | Legacy alias: `EXPO_PUBLIC_KURA_WALLET_ICON_URL` |

**Public by default:** Base RPC, Li.Fi, Morpho GraphQL, CoinGecko, Blockscout — see [official-services.md](official-services.md).

Feature gates: [`src/config/features.ts`](../src/config/features.ts). Empty backend URL hides TrackFi and Dinari (`hasAppBackend()`). Earn deposits go directly to Morpho unless fee-wrapper env is set. Sample wrapper addresses in `EXAMPLE_MORPHO_FEE_WRAPPER_OVERRIDES` are for history / copy-paste into env only — not active by default.

Store builds: production values in `.env` **before** `prebuild` — [local-release.md](local-release.md).

### 3. Native projects

After editing branding or plugins:

```bash
npx expo prebuild --clean
cd ios && pod install && cd ..
```

**iOS associated domains** (from branding, injected in `app.config.js`):

- `webcredentials:YOUR_API_HOST`
- `applinks:YOUR_UNIVERSAL_LINK_HOST`

Host Apple App Site Association (AASA) on your domain before shipping universal links.

**Android App Links:** intent filter uses `*.YOUR_UNIVERSAL_LINK_HOST` — configure Digital Asset Links.

**Expo config plugins** (in `app.config.js`):

| Plugin | Purpose |
|--------|---------|
| `withIosDeploymentTarget` | Force Pods to iOS 15.1 |
| `withIosSceneLifecycle` | UIScene for iOS 27+ SDK |
| `withIosDisableScriptSandbox` | Xcode 15+ RN bundle scripts |

### 4. WalletConnect & AppKit

Auto-read branding + env:

- [`src/lib/walletconnect/walletListing.ts`](../src/lib/walletconnect/walletListing.ts)
- [`src/shared/config/AppKitConfig.ts`](../src/shared/config/AppKitConfig.ts)

Register your wallet in [Reown WalletGuide](https://walletguide.walletconnect.network/) for dApp discovery.

Set `EXPO_PUBLIC_WALLET_ICON_URL` (or legacy `EXPO_PUBLIC_KURA_WALLET_ICON_URL`) or rely on `branding.defaultIconUrl`.

Day-to-day module map: [maintainers.md](maintainers.md). Transfer checklist: [handover.md](handover.md).

### 5. Verify locally

```bash
npm install
npm run lint
npm test
npx tsc --noEmit
npx expo run:ios    # or run:android
```

### 6. Security before publishing

- [ ] Rotate any keys ever committed — [secrets-rotation.md](secrets-rotation.md)
- [ ] Never commit `.env`, keystores, `android/gradle.properties`, `android/local.properties`
- [ ] Update [SECURITY.md](../SECURITY.md) contact email
- [ ] Confirm distribution rights under [LICENSE](../LICENSE)

---

## 中文

### 1. 品牌

同步修改：

- [`app.config.branding.js`](../app.config.branding.js) — 原生 bundle ID、scheme、关联域名
- [`src/config/branding.ts`](../src/config/branding.ts) — WC / AppKit 元数据

替换 `assets/` 图标，更新 `app.config.js` 版本号。

### 2. 环境变量

```bash
cp .env.example .env
```

统一从 [`src/config/env.ts`](../src/config/env.ts) 读取。Release 时 `app.config.js` 的 `extra` 会嵌入 Privy、后端 URL、logo.dev 等关键字段。

必填（核心钱包）：Privy、WalletConnect Project ID。  
Pimlico API key：可选（无 key 时公用 bundler + ETH gas；有 key 且开启 flag 时 USDC gas）。  
TrackFi / Dinari：需 `EXPO_PUBLIC_API_BASE_URL`。  
logo.dev：可选，见 [official-services.md](official-services.md) 移动端说明。

### 3. 原生工程

```bash
npx expo prebuild --clean
```

配置 iOS Associated Domains、Android App Links。三个 iOS 插件见上文英文表格。

### 4. WalletConnect

`walletListing.ts` 与 `AppKitConfig.ts` 自动使用 branding。可在 Reown WalletGuide 注册钱包。

Earn 默认直连 Morpho；可选 fee-wrapper / Li.Fi integrator 见 `.env.example`。维护地图：[maintainers.md](maintainers.md)。

### 5. 验证

```bash
npm run lint && npm test && npx tsc --noEmit
```

### 6. 发布前

轮换泄露密钥、勿提交敏感文件、更新 SECURITY 联系邮箱、确认符合 [LICENSE](../LICENSE)。
