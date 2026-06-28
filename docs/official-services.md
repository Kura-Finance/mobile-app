# Official Services / 官方與第三方服務

**English** | [中文](#中文)

What the **open-source client** connects to — the trust boundary between code you can audit and infrastructure you must trust. Only the mobile app is published here; the Kura backend is proprietary.

**Related:** [transparency.md](transparency.md) · [threat-model.md](threat-model.md) · [fork-guide.md](fork-guide.md)

---

## English

### Connection types

| Type | Examples | Config / code |
|------|----------|---------------|
| **Kura backend** | Auth, Plaid, DeBank, Dinari, passkeys | `EXPO_PUBLIC_API_BASE_URL` → `src/lib/api/` |
| **Third-party (your keys)** | Privy, Pimlico, Reown, Li.Fi, MoonPay, logo.dev | `.env` → `src/config/env.ts` |
| **On-device only** | SCA signing, WC approval UI, SecureStore | `src/lib/wallet/`, `src/features/walletconnect/` |
| **Public RPC / CDN** | Base chain, logo images | RPC URL + logo.dev token |

### Feature matrix

| Feature | Needs backend URL | Other requirements | Notes |
|---------|-------------------|--------------------|-------|
| Login (Privy) | No* | Privy App ID + Client ID | *JWT profile sync needs backend |
| Smart wallet (send/receive USDC) | No | Privy, Pimlico, Base RPC | SCA auto-provisioned |
| Crypto swap / bridge | No | Li.Fi (optional fee keys) | Same-chain + cross-chain via Li.Fi |
| WalletConnect dApps | No | WC project id, Privy | Base only |
| TrackFi (Plaid, brokers) | **Yes** | Passkey registration | E2EE snapshots |
| DeBank DeFi portfolio | **Yes** | Backend proxy | Client normalizes in `debank/normalize.ts` |
| Dinari stocks | **Yes** | Feature flag `dinariStocks` | Currently off in `features.ts` |
| Morpho Earn | No | `morphoEarn` + Pimlico | Public Morpho GraphQL; vault list in `src/config/earn.ts` |
| Kura Card (waitlist UI) | No | — | Card manager + waitlist; no GP API in OSS client |
| MoonPay buy crypto | No | `EXPO_PUBLIC_MOONPAY_*` | WebView to MoonPay |
| Stock/crypto logos | No | `EXPO_PUBLIC_LOGODEV_TOKEN` | Falls back to glyphs |

### Third-party dashboards

| Service | Dashboard | Used for |
|---------|-----------|----------|
| Privy | [dashboard.privy.io](https://dashboard.privy.io) | Auth, embedded wallet |
| Reown | [cloud.reown.com](https://cloud.reown.com) | WalletConnect project id |
| Pimlico | [dashboard.pimlico.io](https://dashboard.pimlico.io) | ERC-4337 bundler / paymaster |
| logo.dev | [logo.dev](https://logo.dev) | Ticker / crypto / domain logos |
| MoonPay | [dashboard.moonpay.com](https://dashboard.moonpay.com) | Fiat on-ramp |
| Li.Fi | [li.fi](https://li.fi) | Bridge / swap aggregator |
| Morpho | [docs.morpho.org](https://docs.morpho.org) | Vault listings + APY (public GraphQL) |

### Base RPC

Set `EXPO_PUBLIC_BASE_RPC_URL` to Alchemy, Infura, or another provider. The client automatically retries **`https://mainnet.base.org`** if the primary endpoint fails (`createBaseTransport()` in `cardWalletConfig.ts`).

### logo.dev on mobile

Publishable key (`pk_…`) is embedded at build time. Also copied to `app.config.js` → `extra.logodevToken` for release reads via `Constants.expoConfig.extra`.

If your logo.dev project enables **Allowed Domains Only**, add your app website (e.g. `kura-finance.com`) or disable restrictions — React Native does not send browser Referer by default; the client adds it in `logoDevImageSource()`.

### Official app defaults

Production store builds set in local `.env` before compile:

```
EXPO_PUBLIC_API_BASE_URL=https://api.kura-finance.com
```

See [local-release.md](local-release.md).

### Forking

- Change bundle ID and domains in [`app.config.branding.js`](../app.config.branding.js) + [`src/config/branding.ts`](../src/config/branding.ts).
- Create your own Privy app, WC project, Pimlico key, logo.dev key.
- Do not ship Kura trademarks in a public fork without permission.
- Full guide: [fork-guide.md](fork-guide.md).

---

## 中文

### 连接类型

| 类型 | 例子 | 配置 |
|------|------|------|
| **Kura 后端** | 登录、Plaid、DeBank、Dinari | `EXPO_PUBLIC_API_BASE_URL` |
| **第三方（自备 key）** | Privy、Pimlico、WC、Li.Fi、MoonPay、logo.dev | `.env` |
| **纯客户端** | 签名、WC UI、SecureStore | 钱包与 WC 模块 |

### 功能对照

| 功能 | 需要后端 | 其他 |
|------|----------|------|
| Privy 登录 | 否* | Privy 凭证 |
| 智能钱包 | 否 | Privy + Pimlico + RPC |
| Swap / Bridge | 否 | Li.Fi（可选） |
| WalletConnect | 否 | WC Project ID |
| TrackFi / Plaid | **是** | Passkey |
| DeBank | **是** | 后端代理 |
| Dinari 股票 | **是** | 功能开关（当前默认关） |
| Kura Card | 否 | 卡片 UI + waitlist |
| MoonPay | 否 | MoonPay Key |
| logo.dev 图标 | 否 | `EXPO_PUBLIC_LOGODEV_TOKEN` |

### Base RPC

主 RPC 失败时自动 fallback 到 `mainnet.base.org`。

### logo.dev

Release 构建需在 `.env` 中配置 token；若开启域名限制，请允许 `kura-finance.com` 或关闭限制。

### 官方 App

生产环境：`EXPO_PUBLIC_API_BASE_URL=https://api.kura-finance.com`，见 [local-release.md](local-release.md)。

### Fork

见 [fork-guide.md](fork-guide.md)；勿未授权使用 Kura 商标。
