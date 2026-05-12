# Architecture / 架構

**English** | [中文](#中文)

Technical map of the open-source mobile client. The **Kura backend is proprietary** — see [transparency.md](transparency.md) and [official-services.md](official-services.md).

**Related:** [Threat model](threat-model.md) · [Getting started](getting-started.md)

---

## English

### Layer diagram

```
┌─────────────────────────────────────────────────────────┐
│  App.tsx          Boot, Privy provider, navigation      │
├─────────────────────────────────────────────────────────┤
│  src/features/    Screens & product UX by domain        │
│    card/          Gnosis Pay, MoonPay, smart wallet UI  │
│    crypto/        Token list, swap, send                │
│    trackfi/       Plaid, investments, DeBank DeFi       │
│    stocks/        Dinari dShares (feature-flagged)      │
│    walletconnect/ WC wallet mode shell                  │
│    settings/      Profile, connected accounts           │
├─────────────────────────────────────────────────────────┤
│  src/shared/      Tab nav, Zustand stores, theme, i18n  │
├─────────────────────────────────────────────────────────┤
│  src/lib/                                               │
│    api/           HTTP clients + Zod schemas            │
│    wallet/        Safe SCA client (viem + permissionless)│
│    walletconnect/ WalletKit, session router             │
│    crypto/        E2EE envelopes, passkey helpers       │
│    security/      App lock, screenshot guard            │
├─────────────────────────────────────────────────────────┤
│  src/config/      env.ts, features.ts, branding, logodev │
└─────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   Kura backend (optional)      Third-party APIs
   api.kura-finance.com          Privy, Pimlico, Li.Fi, …
```

### Security boundaries

| Boundary | Client responsibility | Outside client |
|----------|----------------------|----------------|
| **Signing** | Show calldata; route to SCA client | Pimlico submits UserOp; Base executes |
| **Auth** | Privy SDK session | Privy servers; optional Kura JWT |
| **TrackFi data** | Decrypt after passkey | Backend stores ciphertext + Plaid tokens |
| **WC sessions** | Approve/reject in UI | Reown relay transports messages |
| **Config** | `env.ts`, `features.ts` | Maintainer `.env` at build time |

Trust assumptions: [threat-model.md](threat-model.md).

### Authentication

1. User signs in with **Privy** (`@privy-io/expo`) — email, Google, Apple, etc.
2. With backend configured: app exchanges Privy token → **Kura JWT** via `POST /api/auth/login` (`src/lib/api/auth/`).
3. JWT attached by `src/lib/api/client.ts` on authenticated routes.

Without `EXPO_PUBLIC_API_BASE_URL`, Privy login still works but profile / TrackFi APIs fail. **Core wallet** (SCA on Base) operates once Pimlico + Privy are configured.

### Smart wallet (Base SCA)

| Piece | Technology |
|-------|------------|
| Owner | Privy embedded EOA (lowest-index wallet) or imported key in SecureStore |
| Account | Safe 1.4.1 smart account, EntryPoint 0.7 |
| Bundler / paymaster | Pimlico on Base |
| RPC | Configured Base RPC with fallback to `mainnet.base.org` |

Key files:

- `src/lib/wallet/smartAccountClient.ts` — client builders, balance reads
- `src/features/card/hooks/useKuraCardWallet.ts` — provisioning, send, swap
- `src/features/card/config/cardWalletConfig.ts` — RPC, Pimlico, USDC gas mode

Flow: Privy EOA → resolve Safe address (SecureStore → backend → compute) → balances → `ready`.

### WalletConnect (wallet mode)

- **WalletKit** (`src/lib/walletconnect/kuraWalletKit.ts`) — inbound pairings
- `sessionRouter.ts` — JSON-RPC → SCA sign/send
- **Chain:** Base only (`eip155:8453`)
- Deep links: `deepLink.ts` + universal links from `branding.ts`

Every signing path should pass through user-visible confirmation — see threat model.

### TrackFi & E2EE (backend required)

```
Passkey register (backend)
    → encrypted snapshots stored server-side
    → user unlocks passkey on device
    → DEK in memory
    → envelope.ts decrypts rows
    → Zustand finance stores → UI
```

- Plaid: `src/lib/api/plaid/client.ts`
- DeBank proxy: `src/lib/api/debank/`

Plaintext finance data should not persist unencrypted on device beyond active session memory.

### Feature flags

[`src/config/features.ts`](../src/config/features.ts) gates modules for forks:

| Flag | Default when no backend |
|------|-------------------------|
| `wallet`, `walletConnect`, `lifiSwap` | On (with keys) |
| `trackFi`, `plaid`, `debank` | Off |
| `dinariStocks` | Off |
| `gnosisPay` | On if GP direct or backend |
| `moonPay` | On if API key set |

### Crypto primitives (client)

| Use | Library / module |
|-----|------------------|
| E2EE envelopes | `src/lib/crypto/envelope.ts`, `@noble/ciphers` |
| Passkey / unlock | `src/lib/auth/passkeyService.ts` |
| Sodium compat | `react-native-libsodium` (native), `libsodium-wrappers` (tests) |
| SRP (if used) | `tssrp6a` |

### Logos (logo.dev)

[`src/config/logodev.ts`](../src/config/logodev.ts) — CDN URLs when `EXPO_PUBLIC_LOGODEV_TOKEN` is set. `logoDevImageSource()` attaches token and Referer for mobile.

### Native config plugins

| Plugin | Purpose |
|--------|---------|
| `withIosDeploymentTarget` | Normalize Pods to iOS 15.1 |
| `withIosSceneLifecycle` | UIScene manifest for iOS 27+ SDK |
| `withIosDisableScriptSandbox` | RN bundle script sandbox fix (Xcode 15+) |

Applied on every `expo prebuild`.

### State management

- **Zustand** — `useAppStore`, finance slices, exchange store
- **React Navigation** — tab + stack under `src/shared/navigation/`

---

## 中文

### 分层

`features/` 界面 · `shared/` 导航与状态 · `lib/` API/钱包/WC/加密 · `config/` 环境与开关。

### 安全边界

| 边界 | 客户端 | 外部 |
|------|--------|------|
| 签名 | 展示 calldata | Pimlico + 链上执行 |
| 登录 | Privy SDK | Privy / 可选 Kura JWT |
| TrackFi | Passkey 后解密 | 后端存密文 |
| WC | 用户确认 | Reown 中继 |

### 登录与钱包

Privy →（可选）Kura JWT → Safe + Pimlico on Base。无后端时核心钱包仍可用。

### WalletConnect

WalletKit + `sessionRouter`，仅 Base；签名须经确认屏。

### TrackFi E2EE

Passkey 解锁 DEK → 拉取密文 → `envelope.ts` 解密 → Zustand → UI。

### 功能开关

见 `features.ts`；无后端 URL 时 TrackFi / Dinari 关闭。

### 原生插件

`plugins/` 三个 iOS 插件在 prebuild 时注入。

### 状态

Zustand + React Navigation。

详细威胁与信任：[threat-model.md](threat-model.md)
