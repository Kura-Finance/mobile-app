# Threat model / 威脅模型

**English** | [中文](#中文)

This document describes what the **mobile client** defends against, what it explicitly does **not** defend against, and where trust remains. It complements [transparency.md](transparency.md) and [SECURITY.md](../SECURITY.md).

Scope: **Kura mobile client** on iOS and Android. Out of scope: Kura backend internals, Privy/Pimlico/Reown operations, Base smart contract bugs.

---

## English

### Assets

| Asset | Location | Sensitivity |
|-------|----------|-------------|
| EOA private key / Privy wallet material | Device (SecureStore / Privy SDK) | **Critical** |
| Passkey credentials | OS + backend registration | **High** |
| TrackFi DEK (unlocked) | Device memory after passkey unlock | **High** |
| Encrypted finance snapshots | Backend (ciphertext) | **Medium** (metadata may leak) |
| Kura JWT | Device memory / secure storage | **High** |
| API keys (`EXPO_PUBLIC_*`) | Embedded in app bundle | **Medium** (publishable keys by design) |
| WalletConnect session keys | Device | **High** |

### Adversaries

| Adversary | Capability | Example goal |
|-----------|------------|--------------|
| **Malicious dApp** | Propose harmful calldata via WalletConnect | Drain assets if user approves |
| **Network attacker** | MITM on HTTP/WebSocket | Tamper API responses, relay phishing |
| **Compromised third-party SDK** | Privy, Pimlico, Reown supply chain | Exfiltrate keys or alter signing |
| **Compromised backend** | If Kura API used | Serve malicious encrypted payloads, abuse Plaid tokens |
| **Physical device access** | Unlocked phone | Read app data, approve pending prompts |
| **Malicious fork maintainer** | Ship modified client | Steal keys via patched binary |

### Client mitigations

| Threat | Mitigation | Code / behaviour |
|--------|------------|------------------|
| Unauthorized signing | User must confirm each WC request and send | WC confirm UI, send modals |
| Key persistence after logout | Clear local wallet cache | `clearLocalWalletCache()` |
| Background snooping | Optional biometric app lock | `src/lib/security/appLock.ts` |
| Screenshot leakage (sensitive screens) | Screenshot guard on key flows | `src/lib/security/screenshotGuard.ts` |
| TrackFi plaintext at rest on server | Client-side E2EE; decrypt after passkey | `src/lib/crypto/envelope.ts` |
| Fork forcing TrackFi without consent | Feature flags hide backend modules | `src/config/features.ts` |
| Secrets in VCS | `.gitignore`, docs, CI lint-only | [secrets-rotation.md](secrets-rotation.md) |

### Residual trust (cannot eliminate in client alone)

| Dependency | Residual risk |
|------------|---------------|
| **Privy** | MPC / embedded wallet implementation and availability |
| **Pimlico** | Bundler could censor or reorder UserOps (user sees effect on-chain) |
| **Reown relay** | Pairing phishing if user scans malicious QR |
| **Kura backend** | Stores ciphertext + orchestrates Plaid; must not serve malicious decrypt instructions |
| **User** | Social engineering, approving malicious transactions |
| **Build pipeline** | Maintainer machine compromise before signing |

### Security goals vs. non-goals

| Goal | Non-goal |
|------|----------|
| Non-custodial signing UX with explicit approval | Hiding that Privy provisions the owner EOA |
| E2EE for TrackFi snapshots **after** passkey unlock | Zero-knowledge backend for Plaid aggregation |
| Wallet-only mode without Kura API | Replacing Base chain trust |
| Clear client crypto and WC routing responsibilities | Exposing Kura server internals in this repo |

### Data flow summary

```
Login (Privy)
    → optional JWT (Kura backend)
    → SCA provision (Pimlico + Base RPC)

Send / Swap / Bridge
    → user confirms in UI
    → Pimlico bundler → Base chain

WalletConnect
    → dApp proposes JSON-RPC
    → in-app confirm
    → sign via SCA client

TrackFi (backend required)
    → passkey unlock → DEK in memory
    → fetch ciphertext from API
    → decrypt client-side → Zustand stores
```

### Recommended review paths for auditors

1. `src/lib/wallet/` + `src/features/card/hooks/useKuraCardWallet.ts` — provisioning and sends  
2. `src/lib/walletconnect/sessionRouter.ts` — WC method handling  
3. `src/lib/crypto/` — envelope format and unlock gating  
4. `src/lib/api/client.ts` — authenticated HTTP and token attachment  
5. `src/config/env.ts` + `features.ts` — configuration surface  

Report findings privately: **security@kura-finance.com** ([SECURITY.md](../SECURITY.md)).

---

## 中文

### 资产

| 资产 | 位置 | 敏感度 |
|------|------|--------|
| EOA 私钥 / Privy 钱包材料 | 设备 | **关键** |
| Passkey | 系统 + 后端注册 | **高** |
| TrackFi DEK（解锁后） | 设备内存 | **高** |
| 加密财务快照 | 后端（密文） | **中** |
| Kura JWT | 设备 | **高** |
| API Key（`EXPO_PUBLIC_*`） | 安装包内 | **中** |

### 对手

| 对手 | 能力 |
|------|------|
| 恶意 dApp | 通过 WC 诱导签署有害 calldata |
| 网络攻击者 | MITM、钓鱼 API |
|  compromised 第三方 SDK | 供应链攻击 |
|  compromised 后端 | 恶意密文或滥用 Plaid |
| 物理接触设备 | 未锁屏时操作 App |
| 恶意 Fork 维护者 | 篡改客户端窃钥 |

### 客户端缓解

| 威胁 | 缓解 |
|------|------|
| 未授权签名 | WC / 转账均需用户确认 |
| 登出后密钥残留 | 清除本地钱包缓存 |
| 后台窥屏 | 可选生物识别 App Lock |
| 敏感界面截屏 | screenshotGuard |
| 服务端明文财务数据 | 客户端 E2EE，Passkey 后解密 |
| 强制启用 TrackFi | 无后端 URL 时隐藏模块 |

### 残余信任

Privy、Pimlico、Reown、（若启用）Kura 后端、**用户自身对 calldata 的判断**、维护者构建环境。

### 非目标

不隐藏 Privy 提供 EOA；不要求 Plaid 聚合后端零知识；不替代对 Base 链的信任；Kura 服务端不在此仓库。

### 审计建议路径

`src/lib/wallet/`、`sessionRouter.ts`、`src/lib/crypto/`、`src/lib/api/client.ts`、`env.ts` / `features.ts`。

私下报告：**security@kura-finance.com**。
