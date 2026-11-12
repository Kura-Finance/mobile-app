# Kura — Mobile Client / 行動客戶端

**English** | [中文](#中文)

**Kura** is a non-custodial smart wallet on **Base**. This repository is the **React Native / Expo mobile client** — login, signing, WalletConnect, swap/bridge and Morpho. It is a community edition: by default it talks to the chain and public APIs directly, with no app backend.

> **MIT open source** — copyright [Rick Weng](LICENSE); operated by **Kura Finance LLC**.  
> Third-party marks and partner assets: [NOTICE](NOTICE).  
> **No backend needed.** The hosted Kura backend has been retired; its source is archived at [Kura-Finance/BackendServer](https://github.com/Kura-Finance/BackendServer). Self-host it and set `EXPO_PUBLIC_API_BASE_URL` to turn the backend features back on.

**[Documentation hub →](docs/README.md)** · [Trust model](docs/transparency.md) · [Threat model](docs/threat-model.md) · [Report a vulnerability](SECURITY.md)

---

## English

### What this app does

| Module | Description |
|--------|-------------|
| **Smart wallet** | Safe smart account on Base — owner key on the device (or a Privy EOA with a backend); public bundler + ETH gas, or Pimlico + USDC gas |
| **Crypto** | USDC / blue-chip balances, send, swap, bridge (Li.Fi) |
| **WalletConnect** | Wallet mode for Base dApps (Reown WalletKit) |
| **Morpho** | Earn vaults and borrow markets on Base (public Morpho API + on-chain) |
| **Optional** | logo.dev icons, Li.Fi integrator fee, Morpho fee-wrapper |

**Backend features (off by default).** These need a self-hosted app backend and appear only when `EXPO_PUBLIC_API_BASE_URL` is set:

| Module | Description |
|--------|-------------|
| **TrackFi** | Plaid, exchange APIs, DeBank DeFi — with passkey E2EE |
| **Fiat ramp** | Bank transfer in/out and USDT (Tron) deposits via Bridge.xyz |
| **Card** | Kura Card UI + waitlist (Gnosis Pay; full card onboarding is separate) |
| **Stocks** | Dinari tokenized stocks |
| **Account** | Referrals, connected accounts, in-app account deletion |

Flags live in [`src/config/features.ts`](src/config/features.ts).

**Two modes, one switch (`EXPO_PUBLIC_API_BASE_URL`):**

| | Empty (default) | Set (self-hosted backend) |
|---|---|---|
| Sign-in | None — no account. Create a wallet (12-word recovery phrase) or import one | Privy (email, Google, Apple) |
| Safe owner key | Generated and stored on the device (Keychain / Keystore) | Privy embedded wallet |
| Backup | The recovery phrase, held by the user. Nobody can restore it | Privy key export |
| Third parties needed | Reown (WalletConnect); public RPC / bundler / Li.Fi / Morpho | + Privy and the backend's partners |

### Local development

```bash
cd mobile-app
cp .env.example .env   # Privy + WalletConnect at minimum — never commit .env
npm install
npx expo prebuild
npx expo run:ios       # or: npx expo run:android
```

Verify: `npm test && npm run lint && npx tsc --noEmit`

Full guide: [docs/getting-started.md](docs/getting-started.md) · Trust boundaries: [docs/transparency.md](docs/transparency.md)

### Documentation

| | |
|---|---|
| **Understand** | [Trust model](docs/transparency.md) · [Threat model](docs/threat-model.md) · [Architecture](docs/architecture.md) |
| **Build** | [Getting started](docs/getting-started.md) · [Local release](docs/local-release.md) |
| **Maintain** | [Maintainers map](docs/maintainers.md) · [Maintainer checklist](docs/handover.md) · [Brand identity](docs/brand-identity.md) |
| **Fork / rebrand** | [Fork guide](docs/fork-guide.md) · [Services & API keys](docs/official-services.md) |
| **Security** | [SECURITY.md](SECURITY.md) · [Secrets rotation](docs/secrets-rotation.md) |
| **Contribute** | [CONTRIBUTING.md](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) |
| **Legal** | [LICENSE](LICENSE) (© Rick Weng) · [NOTICE](NOTICE) (operator + trademarks) |

### Repository layout

```
App.tsx                 Entry — Privy, navigation, boot
src/features/           Product screens (card, crypto, trackfi, …)
src/lib/                API clients, wallet, WalletConnect, crypto
src/shared/             Navigation, Zustand, theme, i18n
src/config/             env.ts, features.ts, branding.ts
plugins/                Expo config plugins (iOS lifecycle, deployment target)
docs/                   Architecture, trust model, release guides
```

### Trust at a glance

| Client responsibility | You still trust |
|-----------------------|-----------------|
| WC / send confirmation UI | Privy (auth & EOA) |
| E2EE decrypt after passkey | Bundler (public or Pimlico) |
| Feature flags without backend | Reown relay, optional app API |
| SecureStore + logout cache clear | Your approval of on-chain calldata |

Details: [docs/threat-model.md](docs/threat-model.md)

### Store releases

Local Xcode / Gradle builds and manual upload — **no EAS Build**. See [docs/local-release.md](docs/local-release.md).

**Never commit:** `.env`, keystores, `android/gradle.properties`, `android/local.properties`.

`package.json` sets `"private": true` so this app is not published to npm; the license is still MIT.

### License

[MIT](LICENSE) — © 2026 Rick Weng. Operated by Kura Finance LLC.  
Third-party trademarks and partner assets: [NOTICE](NOTICE).

---

## 中文

### 功能概览

| 模块 | 说明 |
|------|------|
| **智能钱包** | Base 链 Safe 智能账户（默认：密钥在设备本地生成与保存，无账户；接后端时为 Privy EOA；公开 bundler + ETH，或 Pimlico + USDC） |
| **Crypto** | USDC / 主流代币、转账、Swap、跨链桥 |
| **WalletConnect** | Base dApp 钱包模式 |
| **Morpho** | Base 上的 Earn 金库与借贷市场（公开 Morpho API + 链上） |
| **可选** | logo.dev、Li.Fi integrator、Morpho fee-wrapper |

**后端功能（默认关闭）：** 需自建应用后端，设置 `EXPO_PUBLIC_API_BASE_URL` 后才出现 —— TrackFi（Plaid、交易所、DeBank）、法币出入金（Bridge.xyz）、卡片候补、Dinari 股票、推荐、已连接账户、App 内删除账户。开关见 [`src/config/features.ts`](src/config/features.ts)。

> **MIT 开源** — 著作权 [Rick Weng](LICENSE)；由 **Kura Finance LLC** 运营。  
> 第三方商标与合作方素材：[NOTICE](NOTICE)。  
> **无需后端。** Kura 托管后端已停止运营，源码封存于 [Kura-Finance/BackendServer](https://github.com/Kura-Finance/BackendServer)；自建并设置 `EXPO_PUBLIC_API_BASE_URL` 即可重新启用后端功能。

**[文档索引 →](docs/README.md)**

### 本地开发

```bash
cd mobile-app
cp .env.example .env   # 至少 Privy、WalletConnect
npm install && npx expo prebuild
npx expo run:ios
```

详见 [docs/getting-started.md](docs/getting-started.md)、[docs/transparency.md](docs/transparency.md)。

### 文档

| | |
|---|---|
| **理解** | [信任模型](docs/transparency.md) · [威胁模型](docs/threat-model.md) · [架构](docs/architecture.md) |
| **构建** | [快速开始](docs/getting-started.md) · [本地发布](docs/local-release.md) |
| **维护** | [维护地图](docs/maintainers.md) · [维护者清单](docs/handover.md) · [品牌识别](docs/brand-identity.md) |
| **Fork / 换牌** | [换牌指南](docs/fork-guide.md) · [服务与 API](docs/official-services.md) |
| **安全** | [SECURITY.md](SECURITY.md) · [密钥轮换](docs/secrets-rotation.md) |
| **贡献** | [CONTRIBUTING.md](CONTRIBUTING.md) · [行为准则](CODE_OF_CONDUCT.md) |
| **法律** | [LICENSE](LICENSE)（© Rick Weng）· [NOTICE](NOTICE)（运营主体与商标） |

### 信任一览

| 客户端职责 | 仍需信任 |
|------------|----------|
| WC / 转账确认界面 | Privy、bundler |
| Passkey 后 E2EE 解密 | Reown、（可选）应用后端 |
| 无后端时功能隐藏 | 用户对 calldata 的确认 |

### 发布

本地编译 + 手动上传，见 [docs/local-release.md](docs/local-release.md)。**勿提交** `.env`、keystore、本地 Gradle 配置。

### 授权

[MIT](LICENSE) — © 2026 Rick Weng。由 Kura Finance LLC 运营。  
第三方商标与合作方素材：[NOTICE](NOTICE)。
