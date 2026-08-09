# Maintainer checklist / 維護者清單

**English** | [中文](#中文)

Checklist for onboarding or transferring maintainers of **this mobile client repository**. The hosted backend is **not** in this repo.

**Hub:** [docs/README.md](README.md) · **Day-to-day map:** [maintainers.md](maintainers.md) · **Fork / rebrand:** [fork-guide.md](fork-guide.md)

---

## English

### What this repo is

| In scope | Out of scope |
|----------|--------------|
| React Native / Expo mobile client | Hosted API (`api.*`) |
| Branding, env, feature flags | App Store / Play Console accounts (transfer separately) |
| WalletConnect wallet mode, SCA on Base | Plaid / DeBank / Dinari server keys |
| Client docs under `docs/` | Website ToS / Privacy HTML (loaded from `brand.homepage`) |

Leave `EXPO_PUBLIC_API_BASE_URL` empty for **wallet-only**. TrackFi, Dinari, Plaid, and JWT profile sync need a backend URL.

### Assets to transfer (off-repo)

- [ ] Apple Developer + Google Play apps / signing
- [ ] Android release keystore + passwords (never in git)
- [ ] Privy, Reown dashboards (required); optional Pimlico (USDC gas) / logo.dev / Li.Fi / CoinGecko
- [ ] Domains + AASA / App Links / passkey RP ID (`brand.webCredentialsHost`)
- [ ] Hosted backend repo / ops (if you operate a full product stack)
- [ ] Legal pages on `brand.homepage` (`/tos`, `/privacy`, …)
- [ ] Production `.env` values — then **rotate** per [secrets-rotation.md](secrets-rotation.md)

### Minimum path for a new maintainer

1. Read [transparency.md](transparency.md) and [maintainers.md](maintainers.md).
2. Edit brand in **both** [`app.config.branding.js`](../app.config.branding.js) and [`src/config/branding.ts`](../src/config/branding.ts) (or keep official values). See [NOTICE](../NOTICE) for trademarks.
3. `cp .env.example .env` — fill Privy + WalletConnect at minimum (Pimlico optional for USDC gas).
4. Prefer `EXPO_PUBLIC_WALLET_ICON_URL` (legacy `EXPO_PUBLIC_KURA_WALLET_ICON_URL` still works).
5. `npx expo prebuild --clean` → run iOS/Android → `npm test && npm run lint && npx tsc --noEmit`.
6. Store builds: [local-release.md](local-release.md).

Legal URLs in-app are derived from `brand.homepage` (see `OurAgreementsScreen`, login screen). Update the website when you change the brand host.

### Monetization note

No App Store IAP in this client. Optional revenue (integrator fee, Morpho fee-wrapper, backend referral) is env-gated — see [`.env.example`](../.env.example).

---

## 中文

### 本仓库范围

本仓库是 **Expo 手机客户端**。托管后端、商店账号、域名与第三方控制台需单独交接。

留空 `EXPO_PUBLIC_API_BASE_URL` = 仅钱包；TrackFi / Dinari / Plaid 需要后端。

### 必交资产（不在 git）

商店账号与签章、keystore、Privy / Reown、（可选）Pimlico / RPC / Li.Fi、域名与关联文件、后端（若运营完整产品）、网站法律页、生产 `.env`（交接后请轮换）。

### 接手最小步骤

1. 读 [transparency.md](transparency.md)、[maintainers.md](maintainers.md)。
2. 同步改 branding 两个文件（或沿用官方品牌）；商标见 [NOTICE](../NOTICE)。
3. 从 `.env.example` 配置；至少 Privy + WalletConnect。
4. prebuild → 真机跑通 → lint / test / tsc。
5. 上架见 [local-release.md](local-release.md)。

详细换牌：[fork-guide.md](fork-guide.md)。
