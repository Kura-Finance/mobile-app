# Local release builds / 本地发布编译

**English** | [中文](#中文)

This project uses **local native builds** and **manual store upload**. There is **no EAS Build / EAS Submit** workflow.

Store binaries should correspond to tagged commits in this repository — build from source to verify what ships. See [transparency.md](transparency.md).

**Hub:** [docs/README.md](README.md) · **Secrets:** [secrets-rotation.md](secrets-rotation.md)

---

## English

### Overview

| Step | Tool |
|------|------|
| Configure secrets | `.env` (production values for store builds) |
| Generate native projects | `npx expo prebuild` |
| iOS Release | Xcode Archive → App Store Connect |
| Android Release | `./gradlew bundleRelease` → Play Console |

**Critical:** All `EXPO_PUBLIC_*` variables are **embedded at JavaScript bundle time**. Set production values in `.env` **before** `prebuild`, `release:ios`, or `release:android`. Changing `.env` after a Release build requires a **full rebuild**.

Values also copied to `app.config.js` → `extra` for native runtime reads (Privy, backend URL, logo.dev).

### npm scripts

| Script | Purpose |
|--------|---------|
| `npm run prebuild` | Generate `ios/` and `android/` |
| `npm run prebuild:clean` | Regenerate from scratch |
| `npm run release:ios` | `expo run:ios --configuration Release` |
| `npm run release:android` | Gradle `bundleRelease` (AAB for Play Store) |
| `npm run release:android:apk` | Gradle `assembleRelease` (APK for sideload / internal) |

### 1. Production environment

```bash
cp .env.example .env
```

Set at minimum:

```
APP_ENV=production
NODE_ENV=production
EXPO_PUBLIC_API_BASE_URL=https://api.kura-finance.com   # official app
# … all production EXPO_PUBLIC_* keys
```

Official Kura app uses `https://api.kura-finance.com`. Forks use their backend or leave empty for wallet-only.

Bump version in [`app.config.js`](../app.config.js) (`version`), then after prebuild sync native codes:

- **Android:** `versionCode` / `versionName` in `android/app/build.gradle`
- **iOS:** `CFBundleShortVersionString` / `CFBundleVersion` in Xcode or `Info.plist`

### 2. Prebuild

```bash
npm install
npm run prebuild          # or: npm run prebuild:clean
```

Re-run when changing `app.config.js`, `plugins/`, permissions, or branding.

### 3. iOS — Archive & upload

**Requirements:** macOS, full Xcode (not CLI tools only), Apple Developer account, signing cert + provisioning profile.

```bash
# If xed / xcodebuild fails with Command Line Tools error:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

1. Open workspace:
   ```bash
   open ios/*.xcworkspace
   ```
2. Select **Any iOS Device (arm64)**.
3. **Product → Archive** (Release).
4. Organizer → **Distribute App → App Store Connect → Upload**.
5. Complete metadata in [App Store Connect](https://appstoreconnect.apple.com).

**Quick Release on device (not store upload):**

```bash
npm run release:ios
```

#### iOS troubleshooting

| Issue | Fix |
|-------|-----|
| `Sandbox: find deny file-read-data` | Re-run prebuild — `withIosDisableScriptSandbox` plugin |
| `build.db readonly` / incomplete targets | Quit Xcode; `rm -rf ~/Library/Developer/Xcode/DerivedData/Kura-*`; Clean Build Folder; rebuild |
| Node not found in bundle phase | Set `ios/.xcode.env.local`: `export NODE_BINARY=$(command -v node)` |
| Wrong env in Release | Rebuild after updating `.env` |

### 4. Android — Signed AAB & upload

**Requirements:** JDK 17, Android SDK, Play Console app, release keystore.

#### One-time setup

1. **SDK path** — create `android/local.properties` (gitignored):
   ```properties
   sdk.dir=/Users/YOU/Library/Android/sdk
   ```

2. **Keystore:**
   ```bash
   keytool -genkeypair -v -storetype PKCS12 \
     -keystore android/app/kura-release.keystore \
     -alias kura-key -keyalg RSA -keysize 2048 -validity 10000
   ```

3. **Signing config:**
   ```bash
   cp gradle.properties.example android/gradle.properties
   # Edit KURA_STORE_* passwords locally — never commit
   ```

4. **Java:** Do not pin a Homebrew Cellar path in `org.gradle.java.home` — it breaks on upgrades. Omit the line or use a stable JDK 17 path.

#### Build

```bash
npm run release:android
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

Upload in [Google Play Console](https://play.google.com/console) → Production → Create release.

APK for internal testing:

```bash
npm run release:android:apk
```

### 5. Pre-release checklist

- [ ] `.env` has production `EXPO_PUBLIC_*` (Privy, WC, Pimlico, API URL, logo.dev, …)
- [ ] Version bumped in `app.config.js` + native version codes
- [ ] Privy dashboard allows this bundle ID / SHA fingerprints
- [ ] WalletConnect project id is production
- [ ] iOS associated domains + Android App Links live on your host
- [ ] logo.dev token valid; domain restrictions allow your site (if enabled)
- [ ] No secrets committed (`.env`, `gradle.properties`, keystores, `local.properties`)
- [ ] Smoke test Release build on real devices

### 6. CI note

GitHub Actions runs lint, test, and `tsc` only — **not** store builds. Release artifacts are produced on maintainer machines.

### 7. App Store review notes

The app is a **free non-custodial wallet** — no in-app purchases for app features. Third-party financial services (on-chain swaps, fiat ramps) are documented in your review notes as external/regulated flows, not digital goods sold through the app.

---

## 中文

### 概览

| 步骤 | 工具 |
|------|------|
| 配置 | `.env` 生产值 |
| 原生工程 | `npx expo prebuild` |
| iOS | Xcode Archive → App Store Connect |
| Android | Gradle AAB → Play Console |

**无 EAS。** `EXPO_PUBLIC_*` 在编译时写入，修改 `.env` 后必须**完整重新构建**。

### 生产环境

```bash
cp .env.example .env
# APP_ENV=production  NODE_ENV=production
# 填写全部生产 EXPO_PUBLIC_* 
```

官方 App：`EXPO_PUBLIC_API_BASE_URL=https://api.kura-finance.com`

### Prebuild

```bash
npm install && npm run prebuild
```

### iOS

1. `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`（如需）
2. `open ios/*.xcworkspace`
3. **Product → Archive** → 上传 App Store Connect

常见问题：Sandbox find 报错 → 重新 prebuild；DerivedData 损坏 → 删除 `DerivedData/Kura-*`。

### Android

1. 创建 `android/local.properties`（`sdk.dir=…`）
2. 生成 keystore，复制 `gradle.properties.example` → `android/gradle.properties`
3. `npm run release:android`
4. 上传 `app-release.aab`

勿在 `gradle.properties` 写死会过期的 Homebrew JDK 路径。

### 发布前检查

- [ ] `.env` 生产变量完整
- [ ] 版本号已更新
- [ ] Privy / WC / bundle id 匹配
- [ ] 未提交密钥与 local 配置文件
- [ ] Release 包真机冒烟测试

### CI

仅 lint / test / tsc，不打商店包。
