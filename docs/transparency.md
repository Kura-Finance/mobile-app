# Transparency & trust model / 透明度與信任模型

**English** | [中文](#中文)

Kura Wallet publishes its **mobile client** under [GPL-3.0](../LICENSE) so you can inspect how signing, encryption, and WalletConnect approvals work on your device.

We do **not** ask you to trust us blindly. We ask you to read the code, build the app, and decide what you still must trust third parties with.

---

## English

### Why this repository is open source

| Principle | What it means for Kura |
|-----------|------------------------|
| **Security through transparency** | Client logic is public. Vulnerabilities can be found by anyone, not hidden behind a binary. |
| **Informed consent** | You can see exactly when the app sends a transaction, decrypts finance data, or talks to a backend. |
| **Fork-friendly wallet** | Teams can ship a wallet-only build without Kura infrastructure or trademarks. |
| **Accountability** | Security researchers have a clear scope and reporting channel ([SECURITY.md](../SECURITY.md)). |

### What is in this repository

| Component | Status | Notes |
|-----------|--------|-------|
| React Native / Expo mobile client | **Open source** | Full app UI, navigation, state, API clients |
| On-device crypto helpers | **Open source** | E2EE envelopes, passkey unlock flow (`src/lib/crypto/`) |
| Smart wallet client | **Open source** | Safe SCA provisioning, send, swap hooks |
| WalletConnect wallet mode | **Open source** | Session UI, method routing, deep links |
| Build & fork documentation | **Open source** | This `docs/` tree |
| Environment template | **Open source** | [`.env.example`](../.env.example) — placeholders only |

**This project is designed to compile from GitHub** with your own API keys. See [Getting started](getting-started.md).

### What is not in this repository

| Component | Status | Implication |
|-----------|--------|-------------|
| Kura hosted backend | **Proprietary** | Auth JWT exchange, Plaid/DeBank proxies, encrypted snapshot storage |
| Privy, Pimlico, Reown infrastructure | **Third-party** | You trust their SDKs and servers for auth, bundling, and WC relay |
| Base chain & smart contracts | **Public chain** | On-chain behaviour is verifiable separately from this repo |
| Store signing keys | **Never in git** | Keystores and `.env` stay on maintainer machines |

TrackFi and Dinari features **require** a backend URL. Core wallet features do not — see [official-services.md](official-services.md).

### What you can verify yourself

Build from source and confirm:

1. **Transaction approval** — WalletConnect and send flows show calldata before signing (`src/features/walletconnect/`, send modals).
2. **Key storage** — Private material uses `expo-secure-store`; logout clears local wallet cache (`clearLocalWalletCache()`).
3. **TrackFi decryption** — Ciphertext is decrypted only after passkey unlock (`src/lib/crypto/envelope.ts`).
4. **Feature gating** — Without `EXPO_PUBLIC_API_BASE_URL`, TrackFi and Dinari UI is hidden (`src/config/features.ts`).
5. **Env isolation** — Secrets are read only through [`src/config/env.ts`](../src/config/env.ts), not scattered in features.

```bash
git clone https://github.com/Kura-Finance/mobile-app.git
cd mobile-app
cp .env.example .env    # your keys only — never commit
npm install && npx expo prebuild
npm test && npm run lint
npx expo run:ios        # or run:android
```

Compare your build's behaviour to the store app on the same flows (login, balance read, WC reject/approve).

### What you still trust

Even with full client source, you rely on:

| Party | Trust assumption |
|-------|------------------|
| **Privy** | Embedded EOA provisioning and authentication |
| **Pimlico** | ERC-4337 bundler and paymaster on Base |
| **Reown / WalletConnect** | Relay and dApp pairing integrity |
| **Kura backend** (if configured) | JWT issuance, Plaid tokens, encrypted blob storage |
| **Yourself** | Approving calldata shown in the UI — malicious dApps can propose harmful operations |

See [threat-model.md](threat-model.md) for adversaries and mitigations.

### Transparency vs. the official Kura app

| Question | Answer |
|----------|--------|
| Is the App Store / Play app built from this repo? | **Intended yes** — same source tree; maintainers sign with private keys locally ([local-release.md](local-release.md)). |
| Can Kura ship a build with extra closed code? | Store builds should match tagged releases here. Verify by building the same tag yourself. |
| Does open source mean the backend is zero-access? | **No.** TrackFi snapshots are encrypted for the client, but the backend stores ciphertext and orchestrates Plaid/DeBank. Wallet-only mode avoids that backend entirely. |

### Reporting gaps

If documentation and code disagree, please open an issue or email **security@kura-finance.com** if security-relevant.

---

## 中文

### 为何开源

| 原则 | 对 Kura 的意义 |
|------|----------------|
| **透明即安全** | 客户端逻辑公开，漏洞可被任何人发现，而非藏在二进制里。 |
| **知情选择** | 可看到何时签名、何时解密财务数据、何时请求后端。 |
| **可 Fork** | 团队可仅部署核心钱包，无需 Kura 后端或商标。 |
| **可问责** | 安全研究人员有明确范围与报告渠道。 |

### 本仓库包含

| 组件 | 状态 |
|------|------|
| React Native / Expo 移动客户端 | **开源** |
| 设备端加密（E2EE、Passkey） | **开源** |
| 智能钱包与 WalletConnect | **开源** |
| 构建 / Fork 文档 | **开源** |

**本项目可从 GitHub 完整编译**，只需自备 API Key。

### 本仓库不包含

| 组件 | 状态 |
|------|------|
| Kura 托管后端 | **专有** |
| Privy / Pimlico / Reown 基础设施 | **第三方** |
| 商店签名密钥 | **永不进 git** |

未配置 `EXPO_PUBLIC_API_BASE_URL` 时，TrackFi / Dinari 自动隐藏。

### 你可自行验证

1. 交易与 WC 请求在签名前展示 calldata  
2. 私钥存 SecureStore，登出清除缓存  
3. TrackFi 数据仅在 Passkey 解锁后解密  
4. 无后端 URL 时相关功能不可见  
5. 密钥仅经 `src/config/env.ts` 读取  

```bash
git clone https://github.com/Kura-Finance/mobile-app.git
cd mobile-app
cp .env.example .env
npm install && npx expo prebuild
npm test && npx expo run:ios
```

### 你仍需信任

Privy、Pimlico、Reown、（若启用）Kura 后端，以及**你自己对 UI 中 calldata 的确认**。详见 [threat-model.md](threat-model.md)。

### 与官方 App 的关系

官方商店包应对应本仓库的 tag；你可用相同 tag 自行编译比对行为。开源**不等于**后端零知识访问——TrackFi 仍依赖后端存密文；纯钱包模式可完全绕过后端。
