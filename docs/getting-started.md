# Getting Started / 快速開始

**English** | [中文](#中文)

Build the Kura Wallet mobile client from source. Read [transparency.md](transparency.md) first if you want to understand what you are verifying vs. trusting.

**Hub:** [docs/README.md](README.md)

---

## English

### Prerequisites

| Tool | Version / notes |
|------|-----------------|
| **Node.js** | 20+ (LTS recommended) |
| **npm** | Comes with Node |
| **iOS** | macOS, Xcode 15+, CocoaPods (`pod install` in `ios/` after prebuild) |
| **Android** | JDK 17, Android SDK, `ANDROID_HOME` or `android/local.properties` |
| **Expo** | Dev client workflow (`expo run:*`) — not Expo Go for full native modules |

Point Xcode at full Xcode.app (not Command Line Tools only):

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### 1. Clone and configure

```bash
git clone https://github.com/Kura-Finance/mobile-app.git
cd mobile-app
cp .env.example .env
```

Edit `.env` — all runtime config is read through [`src/config/env.ts`](../src/config/env.ts). **`EXPO_PUBLIC_*` values are inlined at bundle time**; restart Metro with `npx expo start -c` after changes.

#### Minimum — core wallet (no TrackFi)

| Variable | Where to get it |
|----------|-----------------|
| `EXPO_PUBLIC_PRIVY_APP_ID` | [Privy dashboard](https://dashboard.privy.io) — add your bundle ID |
| `EXPO_PUBLIC_PRIVY_CLIENT_ID` | Same dashboard (mobile client ID) |
| `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID` | [Reown Cloud](https://cloud.reown.com) |
| `EXPO_PUBLIC_PIMLICO_API_KEY` | [Pimlico](https://dashboard.pimlico.io) |

#### Recommended

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_ALCHEMY_API_KEY` or `EXPO_PUBLIC_BASE_RPC_URL` | Base RPC — see [`cardWalletConfig.ts`](../src/features/card/config/cardWalletConfig.ts) |
| `EXPO_PUBLIC_LOGODEV_TOKEN` | Stock/crypto/merchant logos ([logo.dev](https://logo.dev) publishable key `pk_…`) |

#### Official Kura features (optional for forks)

| Variable | Enables |
|----------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | Privy→Kura JWT exchange, TrackFi, Plaid, DeBank, Dinari, Gnosis Pay proxy |

Leave `EXPO_PUBLIC_API_BASE_URL` **empty** to hide TrackFi and Dinari — see [`features.ts`](../src/config/features.ts).

Other optional keys: MoonPay, Li.Fi integrator fee, Gnosis Pay direct SIWE — see [`.env.example`](../.env.example) and [official-services.md](official-services.md).

### 2. Install and prebuild

```bash
npm install
npx expo prebuild
```

Use `npx expo prebuild --clean` after changing `app.config.js`, `app.config.branding.js`, or `plugins/`.

**Android local SDK path** (create once, gitignored):

```properties
# android/local.properties
sdk.dir=/Users/YOU/Library/Android/sdk
```

### 3. Run

```bash
npx expo run:ios
# or
npx expo run:android
```

Dev server only:

```bash
npx expo start
```

### 4. Verify your build

Confirm the open-source tree matches expected security behaviour:

```bash
npm run lint
npm test
npx tsc --noEmit
```

| Check | Expected |
|-------|----------|
| Tests pass | Crypto, API parsing, WC deep links covered |
| No backend URL | TrackFi / Dinari tabs hidden after login |
| WC pairing | Confirm screen before sign/send |
| Logout | Local wallet cache cleared |

Compare with [threat-model.md](threat-model.md) review paths if auditing.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Wallet RPC errors / zero balances | Set Base RPC env; restart with `npx expo start -c` |
| All logo.dev icons missing | Set `EXPO_PUBLIC_LOGODEV_TOKEN`; for release builds ensure token is in `.env` **before** compile |
| `SDK location not found` (Android) | Create `android/local.properties` with `sdk.dir=…` |
| Invalid `org.gradle.java.home` | Remove stale path from `android/gradle.properties`; use system JDK 17 |
| Xcode `Sandbox: find deny` / script errors | Plugin `withIosDisableScriptSandbox`; re-run prebuild |
| Xcode `build.db readonly` | Quit Xcode, delete `~/Library/Developer/Xcode/DerivedData/Kura-*`, Clean Build Folder |
| Env changes not applied in Release | Rebuild native app; `EXPO_PUBLIC_*` are not hot-reloaded |

**Next steps:** [architecture.md](architecture.md) · [local-release.md](local-release.md) · [fork-guide.md](fork-guide.md)

---

## 中文

### 前置条件

- Node.js 20+、iOS（Xcode + CocoaPods）或 Android（JDK 17 + SDK）
- 使用 dev client（`expo run:*`），非 Expo Go

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### 1. 克隆与配置

```bash
git clone https://github.com/Kura-Finance/mobile-app.git
cd mobile-app
cp .env.example .env
```

**核心钱包最低配置：** Privy App ID / Client ID、WalletConnect Project ID、Pimlico API Key。

**建议：** Base RPC、`EXPO_PUBLIC_LOGODEV_TOKEN`。

**官方功能：** `EXPO_PUBLIC_API_BASE_URL`；留空则隐藏 TrackFi、Dinari。

修改 `.env` 后请 `npx expo start -c`。

### 2. 安装与 prebuild

```bash
npm install && npx expo prebuild
```

Android：`android/local.properties` 中设置 `sdk.dir`。

### 3. 运行

```bash
npx expo run:ios   # 或 run:android
```

### 4. 验证构建

```bash
npm run lint && npm test && npx tsc --noEmit
```

| 检查 | 预期 |
|------|------|
| 测试通过 | 加密、API、WC 等 |
| 无后端 URL | TrackFi / Dinari 不可见 |
| WC | 签名前确认屏 |
| 登出 | 清除本地钱包缓存 |

### 常见问题

| 现象 | 处理 |
|------|------|
| 链上余额失败 | 配置 RPC，清缓存重启 |
| logo 不显示 | 配置 logo.dev token |
| Android SDK | `local.properties` |
| Xcode Sandbox | 重新 prebuild |

**下一步：** [architecture.md](architecture.md) · [local-release.md](local-release.md)
