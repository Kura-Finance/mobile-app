# Official Services / 官方與第三方服務

**English** | [中文](#中文)

What the **mobile client** connects to — the trust boundary between on-device code and infrastructure you must trust. This repository is the mobile app only; the Kura backend is a separate service.

**Related:** [transparency.md](transparency.md) · [threat-model.md](threat-model.md) · [fork-guide.md](fork-guide.md)

---

## English

### Connection types

| Type | Examples | Config / code |
|------|----------|---------------|
| **Required SaaS keys** | Privy, Reown | `.env` → `src/config/env.ts` |
| **Public endpoints** | Base RPC, Pimlico public bundler, Li.Fi, Morpho, CoinGecko, Blockscout | Built-in defaults — no key |
| **Optional SaaS keys** | Pimlico (USDC gas), logo.dev, CoinGecko / Li.Fi rate limits | `.env` |
| **App backend** | Auth JWT, Plaid, DeBank, Dinari, passkeys | `EXPO_PUBLIC_API_BASE_URL` → `src/lib/api/` |
| **On-device only** | SCA signing, WC approval UI, SecureStore | `src/lib/wallet/`, `src/features/walletconnect/` |
| **Optional CDN keys** | logo.dev | Unset → glyphs / Clearbit |

### Feature matrix

| Feature | Needs backend URL | Other requirements | Notes |
|---------|-------------------|--------------------|-------|
| Login (Privy) | No* | Privy App ID + Client ID | *JWT profile sync needs backend |
| Smart wallet (send/receive USDC) | No | Privy, Base RPC; Pimlico key optional | No key → public bundler + ETH gas; key + flag → USDC gas |
| Crypto swap / bridge | No | Li.Fi public API | Optional integrator fee + API key |
| WalletConnect dApps | No | WC project id, Privy | Base only |
| TrackFi (Plaid, brokers) | **Yes** | Passkey registration | E2EE snapshots |
| DeBank DeFi portfolio | **Yes** | Backend proxy | Client normalizes in `debank/normalize.ts` |
| Dinari stocks | **Yes** | Feature flag `dinariStocks` | On when `hasAppBackend()` |
| Morpho Earn | No | `morphoEarn` (SCA) | Direct Morpho by default; optional fee-wrapper via env |
| Kura Card (waitlist UI) | No | — | Card manager + waitlist |
| Logos | No | Optional `EXPO_PUBLIC_LOGODEV_TOKEN` | Glyphs / Clearbit without token |

### Required dashboards (no public substitute)

| Service | Dashboard | Used for |
|---------|-----------|----------|
| Privy | [dashboard.privy.io](https://dashboard.privy.io) | Auth, embedded wallet |
| Reown | [cloud.reown.com](https://cloud.reown.com) | WalletConnect project id |

### Public endpoints (default)

| Service | Endpoint | Notes |
|---------|----------|-------|
| Base RPC | `https://mainnet.base.org` | Override with `EXPO_PUBLIC_BASE_RPC_URL`; auto-fallback in `createBaseTransport()` |
| Pimlico public bundler | `https://public.pimlico.io/v2/8453/rpc` | Used when no API key; SCA pays gas in ETH |
| Li.Fi | `https://li.quest/v1` | Swap + bridge; optional integrator (`LIFI_INTEGRATOR` + `LIFI_FEE`) / API key |
| Morpho | `https://api.morpho.org/graphql` | Vault listings + APY; optional fee-wrapper via env |
| CoinGecko | `https://api.coingecko.com/api/v3` | Prices / charts; optional Demo key |
| Blockscout | `https://base.blockscout.com/api` | Wallet activity |

Optional Pimlico API key ([dashboard.pimlico.io](https://dashboard.pimlico.io)) enables USDC gas via ERC-20 paymaster.

### Optional: logo.dev

Publishable key (`pk_…`) improves ticker/crypto logos. When unset, the UI uses glyphs; domain logos can fall back to Clearbit (`src/config/logodev.ts`).

### Official app defaults

Production store builds set in local `.env` before compile:

```
EXPO_PUBLIC_API_BASE_URL=https://api.kura-finance.com
```

See [local-release.md](local-release.md).

### Forking

- Change bundle ID and domains in [`app.config.branding.js`](../app.config.branding.js) + [`src/config/branding.ts`](../src/config/branding.ts).
- Create your own Privy app and WC project; Pimlico key only if you want USDC gas.
- Leave backend URL / logo.dev empty for a wallet-only fork.
- Do not ship Kura trademarks in a public fork without permission.
- Full guide: [fork-guide.md](fork-guide.md).

---

## 中文

### 连接类型

| 类型 | 例子 | 配置 |
|------|------|------|
| **必需 SaaS key** | Privy、WC | `.env` |
| **公用节点** | Base RPC、Pimlico 公开 bundler、Li.Fi、Morpho、CoinGecko、Blockscout | 内置默认，无需 key |
| **托管后端** | 登录 JWT、Plaid、DeBank、Dinari | `EXPO_PUBLIC_API_BASE_URL` |
| **纯客户端** | 签名、WC UI、SecureStore | 钱包与 WC 模块 |
| **可选** | Pimlico（USDC gas）、logo.dev | 未设置则 ETH gas / 字形 |

### 功能对照

| 功能 | 需要后端 | 其他 |
|------|----------|------|
| Privy 登录 | 否* | Privy 凭证 |
| 智能钱包 | 否 | Privy + 公用 Base RPC；无 Pimlico key 时公开 bundler + ETH gas |
| Swap / Bridge | 否 | Li.Fi 公用 API |
| WalletConnect | 否 | WC Project ID |
| TrackFi / Plaid | **是** | Passkey |
| DeBank | **是** | 后端代理 |
| Dinari 股票 | **是** | 有后端 URL 时开启 |
| Morpho Earn | 否 | 公用 Morpho GraphQL + SCA |
| 图标 | 否 | logo.dev 可选 |

### Base RPC

默认免费公共节点 `https://mainnet.base.org`；可用 `EXPO_PUBLIC_BASE_RPC_URL` 覆盖，失败时自动 fallback。

### 官方 App

生产环境：`EXPO_PUBLIC_API_BASE_URL=https://api.kura-finance.com`，见 [local-release.md](local-release.md)。

### Fork

见 [fork-guide.md](fork-guide.md)；勿未授权使用 Kura 商标。
