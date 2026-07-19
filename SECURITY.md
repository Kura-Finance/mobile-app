# Security Policy / 安全政策

**English** | [中文](#中文)

This policy defines vulnerability scope, reporting, and response expectations for the Kura mobile client.

Related: [Threat model](docs/threat-model.md) · [Transparency](docs/transparency.md) · [Secrets rotation](docs/secrets-rotation.md)

---

## English

### Scope

#### In scope (this repository)

| Area | Examples |
|------|----------|
| Mobile client source | React Native app, native plugins, build docs |
| On-device security | SecureStore key handling, app lock, screenshot guard |
| WalletConnect UX | Session approval, method routing, deep links |
| Client-side E2EE | Passkey unlock, envelope decrypt (`src/lib/crypto/`) |
| Supply chain in repo | Malicious or negligent changes in committed code |

#### Out of scope

| Area | Where to report |
|------|-----------------|
| Kura hosted backend (`api.kura-finance.com`) | **security@kura-finance.com** (we coordinate internally) |
| Privy, Pimlico, Reown, Gnosis Pay SaaS | Respective vendor programs |
| Base smart contract vulnerabilities | Chain / protocol security contacts |
| Social engineering of individual users | Not a client code issue |
| Issues in third-party forks or modified builds | Operator of that build first |

### What the client protects

- **Private keys** — Privy embedded wallet (MPC) or imported key in `expo-secure-store`; cleared on logout via `clearLocalWalletCache()`.
- **WalletConnect** — User must approve each session and signing request in-app.
- **TrackFi E2EE** — Finance snapshots stored encrypted on the backend; plaintext only after passkey unlock on device.
- **App lock** — Optional biometric re-lock after background (`src/lib/security/appLock.ts`).
- **Sensitive screens** — Screenshot mitigation on key flows (`src/lib/security/screenshotGuard.ts`).

### What you still trust

- **Privy** — Authentication and embedded EOA provisioning.
- **Pimlico** — ERC-4337 bundler and paymaster on Base.
- **Reown / WalletConnect** — Relay and dApp pairing.
- **Third-party ramps** — Li.Fi, Bridge, Gnosis Pay when enabled.
- **Kura backend** (if configured) — JWT issuance, Plaid/DeBank proxies, ciphertext storage.
- **User approval** — Malicious dApps can propose harmful calldata; protection depends on the user reading confirm screens.

### Reporting vulnerabilities

**Do not open public GitHub issues for exploitable security bugs.**

| Channel | Address |
|---------|---------|
| Email (preferred) | **security@kura-finance.com** |
| Encrypted email | PGP optional — request key in your first message |

Include:

1. Affected version or commit (tag / SHA)
2. Platform (iOS / Android) and build type (debug / release)
3. Clear reproduction steps or proof-of-concept
4. Impact assessment (confidentiality, integrity, funds at risk)
5. Your disclosure timeline preference

We support **coordinated disclosure**. Please allow reasonable time to patch before public release.

### Response expectations

| Stage | Target |
|-------|--------|
| Acknowledgement | Within **3 business days** |
| Initial triage & severity | Within **10 business days** |
| Fix or mitigation plan | Depends on severity; critical issues prioritized |
| Credit | With permission, in release notes or security advisory |

### Severity guide (client)

| Level | Example |
|-------|---------|
| **Critical** | Remote unauthenticated key extraction; bypass of WC confirm screen |
| **High** | E2EE bypass without passkey; persistent secret leak to logs |
| **Medium** | Information disclosure without keys; DoS of wallet functions |
| **Low** | Non-security bugs, hardening suggestions |

### Safe harbor

We will not pursue legal action against researchers who:

- Act in good faith
- Avoid privacy violations and service disruption
- Report through **security@kura-finance.com**
- Do not access other users' data without authorization

### Secure development

- **Never commit:** `.env`, keystores, `android/gradle.properties`, `android/local.properties`.
- **Rotate immediately** if production keys appeared in git or shipped artifacts — [docs/secrets-rotation.md](docs/secrets-rotation.md).
- **White-label / rebrand builds:** Use your own Privy, WalletConnect, and Pimlico projects; update this file's contact if you operate a separate deployment.

### Supported versions

Security fixes target the **latest release on `main`**. Older store builds may not receive backports unless coordinated with maintainers.

---

## 中文

### 范围

**本仓库（客户端）：** 移动应用源码、设备端密钥、WC 确认 UI、客户端 E2EE、已提交代码的供应链问题。

**不在范围：** Kura 托管后端（仍发 **security@kura-finance.com**）、Privy/Pimlico/Reown 等 SaaS、Base 合约漏洞、针对个人的社工、未经协调的第三方改版。

### 客户端提供的保护

私钥 SecureStore + 登出清除；WC 逐步确认；TrackFi Passkey 后解密；可选 App Lock 与截屏防护。

### 仍需信任

Privy、Pimlico、Reown、第三方 ramps、（若配置）Kura 后端、**用户对 calldata 的确认**。

### 漏洞报告

**请勿公开 Issue。** 邮件：**security@kura-finance.com**

请附：版本/commit、平台、复现步骤、影响评估、披露时间偏好。我们支持**协调披露**。

### 响应预期

| 阶段 | 目标 |
|------|------|
| 确认收到 | **3 个工作日内** |
| 初步分级 | **10 个工作日内** |
| 修复 / 缓解 | 按严重程度优先 |

### 安全开发

勿提交 `.env`、keystore、`gradle.properties`；密钥泄露见 [docs/secrets-rotation.md](docs/secrets-rotation.md)。换牌 / 独立部署请使用自有第三方项目并更新联系邮箱。

### 支持版本

安全修复针对 **`main` 最新版本**。
