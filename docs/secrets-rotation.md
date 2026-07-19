# Secrets rotation checklist / 密钥轮换清单

**English** | [中文](#中文)

If credentials were ever committed to git, shared in chat, or built into a leaked artifact, **rotate before** continuing development or publishing. Open-source transparency does not replace key hygiene — `EXPO_PUBLIC_*` values are embedded in every store build.

**Related:** [SECURITY.md](../SECURITY.md) · [local-release.md](local-release.md) · [transparency.md](transparency.md)

---

## English

### Rotate immediately

| Secret | Where to rotate | Used for |
|--------|-----------------|----------|
| WalletConnect / Reown project | [cloud.reown.com](https://cloud.reown.com) | dApp pairing |
| Privy App ID + Client ID | [dashboard.privy.io](https://dashboard.privy.io) | Login, embedded wallet |
| Pimlico API key | [dashboard.pimlico.io](https://dashboard.pimlico.io) | ERC-4337 bundler |
| logo.dev publishable key | [logo.dev](https://logo.dev) | Stock/crypto logos |
| Li.Fi integrator / API key | [li.fi](https://li.fi) | Swap / bridge fees |
| Morpho fee recipient / wrappers | Your deployment | Earn yield fees |
| Base RPC provider key | Alchemy / Infura dashboard | On-chain reads |
| Android keystore passwords | Generate new keystore if compromised | Play Store signing |
| Kura backend JWT secret | Kura ops (not in this repo) | If backend leaked |

After rotation, update local `.env` and rebuild all store artifacts — `EXPO_PUBLIC_*` are baked into the bundle.

### Repository hygiene

- [ ] `.env` is gitignored — never commit
- [ ] `android/gradle.properties` is gitignored — contains keystore passwords
- [ ] `android/local.properties` is gitignored — local SDK path only
- [ ] Keystores (`*.keystore`, `*.jks`) never in git
- [ ] Remove secrets from git history if needed: [git filter-repo](https://github.com/newren/git-filter-repo) or `.tools/purge-build-artifacts-from-history.sh` (local, gitignored)
- [ ] Scan history: `git log -p -- .env android/gradle.properties` (should be empty)
- [ ] Rotate keys embedded in old IPA/store builds (WalletConnect, Privy, etc.) — see project git history notes

### Files that must stay local

| File | Contains |
|------|----------|
| `.env` | All API keys and `EXPO_PUBLIC_*` |
| `android/gradle.properties` | `KURA_STORE_PASSWORD`, optional `org.gradle.java.home` |
| `android/local.properties` | `sdk.dir` |
| `android/app/*.keystore` | Release signing key |
| `ios/.xcode.env.local` | Optional `NODE_BINARY` override |

Safe to commit: `.env.example`, `gradle.properties.example` (placeholders only).

### After rotation

1. Update `.env` with new values.
2. Update third-party dashboards (Privy allowed bundle IDs, logo.dev domain allowlist, etc.).
3. `npx expo prebuild --clean` if native config references changed.
4. Full Release rebuild for iOS and Android.
5. Invalidate old CI caches / TestFlight builds if they embedded old keys.

Production release process: [local-release.md](local-release.md).

---

## 中文

### 立即轮换

若以下密钥曾进入 git、聊天或泄露的安装包，请在 [对应控制台] 轮换：

- Reown / WalletConnect 项目
- Privy App ID 与 Client ID
- Pimlico、logo.dev、Li.Fi、Base RPC
- Android 签名 keystore（若私钥泄露）
- Kura 后端 JWT（后端泄露时，不在本 repo）

轮换后更新本地 `.env` 并**重新打 Release 包**。

### 仓库卫生

- [ ] 勿提交 `.env`、`android/gradle.properties`、`android/local.properties`
- [ ] 勿提交 keystore
- [ ] 必要时用 git filter-repo 清理历史

### 必须保留在本机的文件

见上表英文部分。

可提交：`.env.example`、`gradle.properties.example`（仅占位符）。

### 轮换后步骤

更新 `.env` → 更新各服务商控制台配置 → prebuild → 完整 Release 重建。

发布流程：[local-release.md](local-release.md)。
