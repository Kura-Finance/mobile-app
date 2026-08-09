# Kura — Mobile Client / 行動客戶端

**English** | [中文](#中文)

**Kura** is a non-custodial smart wallet on **Base**. This repository is the **React Native / Expo mobile client** — login, signing, WalletConnect, and optional finance tracking.

> **MIT open source** — see [LICENSE](LICENSE).  
> The **hosted backend is not in this repository.** Leave `EXPO_PUBLIC_API_BASE_URL` empty for wallet-only builds.

**[Documentation hub →](docs/README.md)** · [Trust model](docs/transparency.md) · [Threat model](docs/threat-model.md) · [Report a vulnerability](SECURITY.md)

---

## English

### What this app does

| Module | Description |
|--------|-------------|
| **Smart wallet** | Safe smart account on Base — Privy EOA owner; public bundler + ETH gas, or Pimlico + USDC gas |
| **Crypto** | USDC / blue-chip balances, send, swap, bridge (Li.Fi) |
| **WalletConnect** | Wallet mode for Base dApps (Reown WalletKit) |
| **TrackFi** | Plaid, exchange APIs, DeBank DeFi — requires app backend + passkey E2EE |
| **Gnosis Pay** | Kura Card UI + waitlist (full card onboarding is separate) |
| **Optional** | Dinari stocks (feature-flagged), logo.dev icons, Li.Fi integrator fee, Morpho fee-wrapper |

Leave `EXPO_PUBLIC_API_BASE_URL` empty to run **wallet-only** — TrackFi and Dinari tabs hide automatically.

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

[MIT](LICENSE) — © 2026 Rick Weng.

---

## 中文

### 功能概览

| 模块 | 说明 |
|------|------|
| **智能钱包** | Base 链 Safe 智能账户（Privy EOA；公开 bundler + ETH，或 Pimlico + USDC） |
| **Crypto** | USDC / 主流代币、转账、Swap、跨链桥 |
| **WalletConnect** | Base dApp 钱包模式 |
| **TrackFi** | Plaid、交易所、DeBank（需应用后端 + Passkey E2EE） |
| **Gnosis Pay** | 虚拟借记卡（完整开卡流程另计） |
| **可选** | Dinari、logo.dev、Li.Fi integrator、Morpho fee-wrapper |

> **MIT 开源** — 见 [LICENSE](LICENSE)。  
> 托管后端不在此仓库；留空 `EXPO_PUBLIC_API_BASE_URL` 可仅跑钱包。

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

### 信任一览

| 客户端职责 | 仍需信任 |
|------------|----------|
| WC / 转账确认界面 | Privy、bundler |
| Passkey 后 E2EE 解密 | Reown、（可选）应用后端 |
| 无后端时功能隐藏 | 用户对 calldata 的确认 |

### 发布

本地编译 + 手动上传，见 [docs/local-release.md](docs/local-release.md)。**勿提交** `.env`、keystore、本地 Gradle 配置。

### 授权

[MIT](LICENSE) — © 2026 Rick Weng。
