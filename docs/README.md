# Documentation / 文檔

**English** | [中文](#中文)

Welcome to the Kura Wallet mobile client documentation. These guides explain how the app works, what you can verify in source, and how to build, fork, or contribute with confidence.

---

## English

### Start here

| Guide | Who it's for | What you'll learn |
|-------|--------------|-------------------|
| [Transparency & trust model](transparency.md) | Everyone | Why we open-source, what is / isn't in this repo, how to verify a build |
| [Threat model](threat-model.md) | Security researchers, auditors | Assets, adversaries, mitigations, residual trust |
| [Getting started](getting-started.md) | Developers | Clone, configure, run, test |
| [Architecture](architecture.md) | Contributors, auditors | Layers, auth, wallet, E2EE, data flows |

### Build & ship

| Guide | Who it's for |
|-------|--------------|
| [Local release](local-release.md) | Maintainers publishing to App Store / Play Console |
| [Fork guide](fork-guide.md) | Teams white-labeling or forking the client |
| [Official & third-party services](official-services.md) | Anyone mapping API keys and backend dependencies |

### Security & governance

| Document | Purpose |
|----------|---------|
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting, scope, response expectations |
| [Secrets rotation](secrets-rotation.md) | What to rotate if credentials leak |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | PR workflow, conventions, license |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Community standards |

### Reference

| Resource | Purpose |
|----------|---------|
| [`.env.example`](../.env.example) | All environment variables with comments |
| [i18n guide](../src/shared/locales/README.md) | Translation workflow (en / zh-TW) |
| [LICENSE](../LICENSE) | GPL-3.0 obligations |

### Design principles

Our documentation is built around four ideas:

1. **Security through transparency** — publish client source so experts and users can inspect it, not security through obscurity.
2. **Honest scope** — clearly label what is open, what is proprietary, and what still requires trusting a third party.
3. **Verifiable builds** — instructions to compile the app yourself and compare behaviour to store builds.
4. **Actionable security** — private disclosure path, rotation checklists, and threat-model alignment.

---

## 中文

### 从这里开始

| 文档 | 适合对象 | 内容 |
|------|----------|------|
| [透明度与信任模型](transparency.md) | 所有人 | 为何开源、仓库内外边界、如何验证构建 |
| [威胁模型](threat-model.md) | 安全研究人员 | 资产、对手、缓解措施、残余信任 |
| [快速开始](getting-started.md) | 开发者 | 克隆、配置、运行、测试 |
| [架构](architecture.md) | 贡献者 / 审计 | 分层、登录、钱包、E2EE、数据流 |

### 构建与发布

| 文档 | 适合对象 |
|------|----------|
| [本地发布](local-release.md) | 上架 App Store / Play 的维护者 |
| [分叉指南](fork-guide.md) | 换牌 / Fork 团队 |
| [官方与第三方服务](official-services.md) | 梳理 API Key 与后端依赖 |

### 安全与治理

| 文档 | 用途 |
|------|------|
| [SECURITY.md](../SECURITY.md) | 漏洞报告、范围、响应预期 |
| [密钥轮换](secrets-rotation.md) | 凭证泄露后的处理 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | PR 流程与规范 |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | 社区行为准则 |

### 参考

| 资源 | 用途 |
|------|------|
| [`.env.example`](../.env.example) | 环境变量说明 |
| [国际化指南](../src/shared/locales/README.md) | 翻译流程 |
| [LICENSE](../LICENSE) | GPL-3.0 授权 |

### 文档原则

**透明优先**、**边界诚实**、**构建可验证**、**安全可行动**。
