# Kura Wallet — Mobile Client / 行動錢包客戶端

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Security through transparency](https://img.shields.io/badge/Security-Transparency-green.svg)](docs/transparency.md)

**English** | [中文](#中文)

**Kura Wallet** is a non-custodial smart wallet on **Base**. This repository contains the **open-source React Native / Expo mobile client** — the code that runs on your phone for login, signing, WalletConnect, and optional finance tracking.

> **Security through transparency**
>
> We publish client source so you can audit what the app does on your device. **You can compile this project from GitHub** with your own API keys.
>
> The **Kura hosted backend is not in this repository.** Wallet-only forks work without it.

**[Documentation hub →](docs/README.md)** · [Transparency model](docs/transparency.md) · [Threat model](docs/threat-model.md) · [Report a vulnerability](SECURITY.md)

---

## English

### What this app does

| Module | Description |
|--------|-------------|
| **Smart wallet** | Safe smart account on Base — Privy EOA owner + Pimlico bundler/paymaster |
| **Crypto** | USDC / blue-chip balances, send, swap, bridge (Li.Fi) |
| **WalletConnect** | Wallet mode for Base dApps (Reown WalletKit) |
| **TrackFi** | Plaid, exchange APIs, DeBank DeFi — requires Kura backend + passkey E2EE |
| **Gnosis Pay** | Kura Card UI + waitlist (card onboarding not in OSS client) |
| **Optional** | MoonPay on-ramp, Dinari stocks (feature-flagged), logo.dev icons |

Leave `EXPO_PUBLIC_API_BASE_URL` empty to run **wallet-only** — TrackFi and Dinari tabs hide automatically.

### Build from source

```bash
git clone https://github.com/Kura-Finance/mobile-app.git
cd mobile-app
cp .env.example .env   # Privy, WalletConnect, Pimlico at minimum — never commit
npm install
npx expo prebuild
npx expo run:ios       # or: npx expo run:android
```

Verify: `npm test && npm run lint && npx tsc --noEmit`

Full guide: [docs/getting-started.md](docs/getting-started.md) · Verify what you trust: [docs/transparency.md](docs/transparency.md)

### Documentation

| | |
|---|---|
| **Understand** | [Transparency & trust](docs/transparency.md) · [Threat model](docs/threat-model.md) · [Architecture](docs/architecture.md) |
| **Build** | [Getting started](docs/getting-started.md) · [Local release](docs/local-release.md) |
| **Fork** | [Fork guide](docs/fork-guide.md) · [Services & API keys](docs/official-services.md) |
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
docs/                   Transparency, architecture, fork & release guides
```

### Trust at a glance

| You can verify in source | You still trust |
|--------------------------|-----------------|
| WC / send confirmation UI | Privy (auth & EOA) |
| E2EE decrypt after passkey | Pimlico (bundler) |
| Feature flags without backend | Reown relay, optional Kura API |
| SecureStore + logout cache clear | Your approval of on-chain calldata |

Details: [docs/threat-model.md](docs/threat-model.md)

### Store releases

Local Xcode / Gradle builds and manual upload — **no EAS Build**. See [docs/local-release.md](docs/local-release.md).

**Never commit:** `.env`, keystores, `android/gradle.properties`, `android/local.properties`.

### License

[GPL-3.0](LICENSE) — derivatives must remain open source under compatible terms.

---

## 中文

### 功能概览

| 模块 | 说明 |
|------|------|
| **智能钱包** | Base 链 Safe 智能账户（Privy EOA + Pimlico） |
| **Crypto** | USDC / 主流代币、转账、Swap、跨链桥 |
| **WalletConnect** | Base dApp 钱包模式 |
| **TrackFi** | Plaid、交易所、DeBank（需 Kura 后端 + Passkey E2EE） |
| **Gnosis Pay** | 虚拟借记卡 |
| **可选** | MoonPay、Dinari、logo.dev |

> **透明即安全**
>
> 我们公开客户端源码供审计；**本仓库可从 GitHub 完整编译**。Kura 托管后端不在此仓库。

**[文档索引 →](docs/README.md)**

### 从源码构建

```bash
git clone https://github.com/Kura-Finance/mobile-app.git
cd mobile-app
cp .env.example .env   # 至少 Privy、WalletConnect、Pimlico
npm install && npx expo prebuild
npx expo run:ios
```

详见 [docs/getting-started.md](docs/getting-started.md)、[docs/transparency.md](docs/transparency.md)。

### 文档

| | |
|---|---|
| **理解** | [透明度与信任](docs/transparency.md) · [威胁模型](docs/threat-model.md) · [架构](docs/architecture.md) |
| **构建** | [快速开始](docs/getting-started.md) · [本地发布](docs/local-release.md) |
| **Fork** | [分叉指南](docs/fork-guide.md) · [服务与 API](docs/official-services.md) |
| **安全** | [SECURITY.md](SECURITY.md) · [密钥轮换](docs/secrets-rotation.md) |
| **贡献** | [CONTRIBUTING.md](CONTRIBUTING.md) · [行为准则](CODE_OF_CONDUCT.md) |

### 信任一览

| 可在源码中验证 | 仍需信任 |
|----------------|----------|
| WC / 转账确认界面 | Privy、Pimlico |
| Passkey 后 E2EE 解密 | Reown、（可选）Kura 后端 |
| 无后端时功能隐藏 | 用户对 calldata 的确认 |

### 发布

本地编译 + 手动上传，见 [docs/local-release.md](docs/local-release.md)。**勿提交** `.env`、keystore、本地 Gradle 配置。

### 授权

[GPL-3.0](LICENSE)
