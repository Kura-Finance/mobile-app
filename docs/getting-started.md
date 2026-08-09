# Getting Started / 快速開始

**English** | [中文](#中文)

Build the Kura mobile client from source. Read [transparency.md](transparency.md) first if you want to understand what you are verifying vs. trusting.

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
| `EXPO_PUBLIC_PIMLICO_API_KEY` | Optional — [Pimlico](https://dashboard.pimlico.io); without it, public bundler + ETH gas |

#### Public by default (no API key)

| Integration | Default endpoint |
|-------------|------------------|
| Base RPC | `https://mainnet.base.org` (`EXPO_PUBLIC_BASE_RPC_URL`) |
| Li.Fi swap / bridge | `https://li.quest/v1` |
| Morpho Earn | `https://api.morpho.org/graphql` |
| CoinGecko prices | `https://api.coingecko.com` |
| Tx history | Base Blockscout |

#### Optional

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | TrackFi, Plaid, DeBank, Dinari (leave empty for wallet-only) |
| `EXPO_PUBLIC_LIFI_INTEGRATOR` + `EXPO_PUBLIC_LIFI_FEE` | Optional Li.Fi integrator fee |
| `EXPO_PUBLIC_MORPHO_EARN_FEE` + fee-wrapper env | Optional Morpho yield fee (default: direct Morpho) |
| `EXPO_PUBLIC_LOGODEV_TOKEN` | Richer logos; unset → glyphs / Clearbit |
| `EXPO_PUBLIC_COINGECKO_API_KEY` / `EXPO_PUBLIC_LIFI_API_KEY` | Higher rate limits only |

See [`.env.example`](../.env.example) and [official-services.md](official-services.md).

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

Confirm the local tree matches expected security behaviour:

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
| Wallet RPC errors / zero balances | Confirm `EXPO_PUBLIC_BASE_RPC_URL=https://mainnet.base.org` (or another public RPC); restart with `npx expo start -c` |
| Rich logos missing | Optional: set `EXPO_PUBLIC_LOGODEV_TOKEN`; without it the app uses glyphs / Clearbit |
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

**核心钱包最低配置：** Privy App ID / Client ID、WalletConnect Project ID。Pimlico key 可选（无 key 时公用 bundler + ETH gas）。

**公用默认：** Base RPC（`mainnet.base.org`）、Li.Fi、Morpho、CoinGecko、Blockscout — 无需额外 key。

**可选：** `EXPO_PUBLIC_API_BASE_URL`（TrackFi / Dinari）；`EXPO_PUBLIC_LOGODEV_TOKEN`（更好图标）。

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
| logo 不显示 | 可选配置 logo.dev；未配置则用字形 / Clearbit |
| Android SDK | `local.properties` |
| Xcode Sandbox | 重新 prebuild |

**下一步：** [architecture.md](architecture.md) · [local-release.md](local-release.md)
