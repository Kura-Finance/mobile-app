# Trust model / 信任模型

**English** | [中文](#中文)

This document describes trust boundaries for the **Kura Wallet mobile client**: what the app handles on-device, what depends on the Kura backend or third parties, and what you can verify in a local build.

---

## English

### Design principles

| Principle | What it means for Kura |
|-----------|------------------------|
| **Clear boundaries** | Client logic, hosted backend, and third-party SaaS are labeled separately. |
| **Informed consent** | Users see when the app sends a transaction, decrypts finance data, or talks to a backend. |
| **Wallet-only mode** | Core wallet features run without `EXPO_PUBLIC_API_BASE_URL`. |
| **Accountable security** | Researchers have a clear scope and reporting channel ([SECURITY.md](../SECURITY.md)). |

### What is in this repository

| Component | Notes |
|-----------|--------|
| React Native / Expo mobile client | Full app UI, navigation, state, API clients |
| On-device crypto helpers | E2EE envelopes, passkey unlock flow (`src/lib/crypto/`) |
| Smart wallet client | Safe SCA provisioning, send, swap hooks |
| WalletConnect wallet mode | Session UI, method routing, deep links |
| Build & ops documentation | This `docs/` tree |
| Environment template | [`.env.example`](../.env.example) — placeholders only |

Local setup: [Getting started](getting-started.md).

### What is not in this repository

| Component | Status | Implication |
|-----------|--------|-------------|
| Kura hosted backend | Separate service | Auth JWT exchange, Plaid/DeBank proxies, encrypted snapshot storage |
| Privy, Pimlico, Reown infrastructure | Third-party | Auth, bundling, and WC relay |
| Base chain & smart contracts | Public chain | On-chain behaviour is verifiable separately |
| Store signing keys | Never in git | Keystores and `.env` stay on maintainer machines |

TrackFi and Dinari features **require** a backend URL. Core wallet features do not — see [official-services.md](official-services.md).

### What you can verify in a local build

1. **Transaction approval** — WalletConnect and send flows show calldata before signing (`src/features/walletconnect/`, send modals).
2. **Key storage** — Private material uses `expo-secure-store`; logout clears local wallet cache (`clearLocalWalletCache()`).
3. **TrackFi decryption** — Ciphertext is decrypted only after passkey unlock (`src/lib/crypto/envelope.ts`).
4. **Feature gating** — Without `EXPO_PUBLIC_API_BASE_URL`, TrackFi and Dinari UI is hidden. Morpho Earn is gated separately via `features.morphoEarn` (`src/config/earn.ts`).
5. **Env isolation** — Secrets are read only through [`src/config/env.ts`](../src/config/env.ts), not scattered in features.

```bash
cd mobile-app
cp .env.example .env    # your keys only — never commit
npm install && npx expo prebuild
npm test && npm run lint
npx expo run:ios        # or run:android
```

### What you still trust

| Party | Trust assumption |
|-------|------------------|
| **Privy** | Embedded EOA provisioning and authentication |
| **Pimlico** | ERC-4337 bundler and paymaster on Base |
| **Reown / WalletConnect** | Relay and dApp pairing integrity |
| **Kura backend** (if configured) | JWT issuance, Plaid tokens, encrypted blob storage |
| **Yourself** | Approving calldata shown in the UI — malicious dApps can propose harmful operations |

See [threat-model.md](threat-model.md) for adversaries and mitigations.

### Client vs backend access

| Question | Answer |
|----------|--------|
| Does wallet-only mode need the Kura API? | **No.** Leave `EXPO_PUBLIC_API_BASE_URL` empty. |
| Does TrackFi imply zero backend access? | **No.** Snapshots are encrypted for the client, but the backend stores ciphertext and orchestrates Plaid/DeBank. |
| Where are store signing keys? | **Never in git** — local release process only ([local-release.md](local-release.md)). |

### Reporting gaps

If documentation and code disagree, open an internal issue or email **security@kura-finance.com** if security-relevant.

---

## 中文

### 设计原则

| 原则 | 对 Kura 的意义 |
|------|----------------|
| **边界清晰** | 客户端、托管后端、第三方 SaaS 分开标注。 |
| **知情选择** | 可看到何时签名、何时解密财务数据、何时请求后端。 |
| **纯钱包模式** | 不配置后端 URL 时可只跑核心钱包。 |
| **可问责** | 安全研究人员有明确范围与报告渠道。 |

### 本仓库包含

| 组件 | 说明 |
|------|------|
| React Native / Expo 移动客户端 | UI、导航、状态、API 客户端 |
| 设备端加密（E2EE、Passkey） | `src/lib/crypto/` |
| 智能钱包与 WalletConnect | Safe SCA、会话确认 |
| 构建 / 运维文档 | `docs/` |

### 本仓库不包含

| 组件 | 状态 |
|------|------|
| Kura 托管后端 | 独立服务 |
| Privy / Pimlico / Reown 基础设施 | 第三方 |
| 商店签名密钥 | 永不进 git |

未配置 `EXPO_PUBLIC_API_BASE_URL` 时，TrackFi / Dinari 自动隐藏。

### 本地构建可核对

1. 交易与 WC 请求在签名前展示 calldata  
2. 私钥存 SecureStore，登出清除缓存  
3. TrackFi 数据仅在 Passkey 解锁后解密  
4. 无后端 URL 时相关功能不可见  
5. 密钥仅经 `src/config/env.ts` 读取  

```bash
cd mobile-app
cp .env.example .env
npm install && npx expo prebuild
npm test && npx expo run:ios
```

### 你仍需信任

Privy、Pimlico、Reown、（若启用）Kura 后端，以及**你自己对 UI 中 calldata 的确认**。详见 [threat-model.md](threat-model.md)。

### 客户端与后端

纯钱包模式可不依赖 Kura API。TrackFi **不等于**后端零知识访问——仍依赖后端存密文；不启用 TrackFi 时可完全绕过后端。
