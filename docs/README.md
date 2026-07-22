# Documentation / 文檔

**English** | [中文](#中文)

Welcome to the mobile client documentation. These guides explain how the app works, trust boundaries, how to build or ship releases, and how to hand the repo to a new maintainer.

---

## English

### Start here

| Guide | Who it's for | What you'll learn |
|-------|--------------|-------------------|
| [Trust model](transparency.md) | Everyone | Client vs backend vs third parties; what a local build can verify |
| [Threat model](threat-model.md) | Security researchers, auditors | Assets, adversaries, mitigations, residual trust |
| [Getting started](getting-started.md) | Developers | Clone, configure, run, test |
| [Architecture](architecture.md) | Contributors, auditors | Layers, auth, wallet, E2EE, data flows |

### Maintain & transfer

| Guide | Who it's for |
|-------|--------------|
| [Brand identity](brand-identity.md) | Design / rebrand — colors, logos, icons, assets |
| [Maintainers map](maintainers.md) | Engineers changing brand, env, or modules |
| [Handover checklist](handover.md) | Buyers / ops transferring the product |
| [Rebrand guide](fork-guide.md) | Teams white-labeling the client |
| [Official & third-party services](official-services.md) | Anyone mapping API keys and backend dependencies |

### Build & ship

| Guide | Who it's for |
|-------|--------------|
| [Local release](local-release.md) | Maintainers publishing to App Store / Play Console |

### Security & governance

| Document | Purpose |
|----------|---------|
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting, scope, response expectations |
| [Secrets rotation](secrets-rotation.md) | What to rotate if credentials leak |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | PR workflow, conventions, IP |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Community standards |

### Reference

| Resource | Purpose |
|----------|---------|
| [`.env.example`](../.env.example) | All environment variables with comments |
| [i18n guide](../src/shared/locales/README.md) | Translation workflow (en / zh-TW) |
| [LICENSE](../LICENSE) | Proprietary — © Kura Finance LLC |

### Design principles

1. **Honest scope** — clearly label client, proprietary backend, and third-party trust.
2. **Local verifiability** — instructions to compile and exercise critical security flows.
3. **Actionable security** — private disclosure path, rotation checklists, and threat-model alignment.
4. **Operational clarity** — env, branding, and release steps stay in sync with code.
5. **Buyer-friendly surface** — brand and secrets live in config; prefer neutral maintainer APIs (`hasAppBackend`, `walletKit`).

---

## 中文

### 从这里开始

| 文档 | 适合对象 | 内容 |
|------|----------|------|
| [信任模型](transparency.md) | 所有人 | 客户端 / 后端 / 第三方边界、本地构建可核对项 |
| [威胁模型](threat-model.md) | 安全研究人员 | 资产、对手、缓解措施、残余信任 |
| [快速开始](getting-started.md) | 开发者 | 配置、运行、测试 |
| [架构](architecture.md) | 贡献者 / 审计 | 分层、登录、钱包、E2EE、数据流 |

### 维护与交接

| 文档 | 适合对象 |
|------|----------|
| [品牌识别](brand-identity.md) | 设计 / 换牌 — 色票、Logo、图标、资源 |
| [维护地图](maintainers.md) | 改品牌 / env / 模块的工程师 |
| [交接清单](handover.md) | 买家 / 运维交接 |
| [换牌指南](fork-guide.md) | 换牌 / 白标团队 |
| [官方与第三方服务](official-services.md) | 梳理 API Key 与后端依赖 |

### 构建与发布

| 文档 | 适合对象 |
|------|----------|
| [本地发布](local-release.md) | 上架 App Store / Play 的维护者 |

### 安全与治理

| 文档 | 用途 |
|------|------|
| [SECURITY.md](../SECURITY.md) | 漏洞报告、范围、响应预期 |
| [密钥轮换](secrets-rotation.md) | 凭证泄露后的处理 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | PR 流程与规范 |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | 行为准则 |

### 参考

| 资源 | 用途 |
|------|------|
| [`.env.example`](../.env.example) | 环境变量说明 |
| [国际化指南](../src/shared/locales/README.md) | 翻译流程 |
| [LICENSE](../LICENSE) | 专有授权 — © Kura Finance LLC |

### 文档原则

**边界诚实**、**本地可核对**、**安全可行动**、**运维清晰**、**维护面中性**（品牌与密钥集中在 config）。
