# Contributing / 貢獻指南

**English** | [中文](#中文)

Thank you for helping improve the Kura mobile client. This is **proprietary software**. By contributing you assign (or irrevocably license) your contributions to Kura Finance LLC under the terms of [LICENSE](LICENSE) and any applicable contributor agreement.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md). Security issues: [SECURITY.md](SECURITY.md) (private email only).

**Documentation hub:** [docs/README.md](docs/README.md)

---

## English

### Before you start

1. Read [docs/transparency.md](docs/transparency.md) — understand client vs backend trust boundaries.
2. Complete [docs/getting-started.md](docs/getting-started.md) — local build running.
3. For rebranding, follow [docs/fork-guide.md](docs/fork-guide.md) instead of one-off edits.
4. Never commit secrets — [docs/secrets-rotation.md](docs/secrets-rotation.md).

### Development workflow

```bash
git clone https://github.com/Kura-Finance/mobile-app.git
cd mobile-app
cp .env.example .env
npm install
npx expo prebuild          # after native config / plugin changes
npx expo start             # or run:ios / run:android
```

After changing `app.config.js`, branding, or `plugins/`, run `npx expo prebuild` (add `--clean` if native projects look stale).

### Pull requests

1. Create a branch from `main`.
2. Run checks locally:
   ```bash
   npm run lint
   npm test
   npx tsc --noEmit
   ```
3. One logical change per PR when possible.
4. Update docs when you change env vars, feature flags, security behaviour, or release steps.

### Code conventions

| Topic | Rule |
|-------|------|
| **Env vars** | Read only via [`src/config/env.ts`](src/config/env.ts). Update [`.env.example`](.env.example) and relevant `docs/`. |
| **Feature flags** | Backend-dependent UI → [`src/config/features.ts`](src/config/features.ts). |
| **Branding** | Keep [`app.config.branding.js`](app.config.branding.js) and [`src/config/branding.ts`](src/config/branding.ts) in sync. |
| **API clients** | Under `src/lib/api/<service>/` with Zod schemas where applicable. |
| **i18n** | User-facing strings → `src/shared/locales/en/common.json` **and** `zh-TW/common.json`. See [locales README](src/shared/locales/README.md). |
| **Native plugins** | Expo config plugins in `plugins/`; register in `app.config.js`. |
| **Secrets** | Never in source, screenshots, or PR descriptions. |
| **Security UX** | Destructive or signing flows require explicit user confirmation — align with [threat model](docs/threat-model.md). |

### What we welcome

- Bug fixes with reproduction steps
- Documentation improvements
- Tests for `src/lib/` crypto, API parsing, wallet helpers
- Accessibility and i18n fixes
- Performance improvements with measurable impact

### What needs discussion first

- New third-party services or telemetry
- Breaking changes to env var names or branding files
- Features requiring undocumented Kura backend endpoints
- Changes that weaken confirm screens, E2EE gating, or feature flags

Open an internal issue or discussion labeled **question** before large architectural changes.

### Security contributions

- **Do not** open public issues for exploitable vulnerabilities.
- Email **security@kura-finance.com** with details per [SECURITY.md](SECURITY.md).
- Documentation fixes that clarify trust boundaries ([transparency.md](docs/transparency.md)) are welcome via normal PRs.

### Intellectual property

Contributions become proprietary property of Kura Finance LLC (see [LICENSE](LICENSE)). You must have the right to submit the code you contribute.

---

## 中文

### 开始之前

1. 阅读 [docs/transparency.md](docs/transparency.md)  
2. 完成 [docs/getting-started.md](docs/getting-started.md) 本地构建  
3. 换牌见 [docs/fork-guide.md](docs/fork-guide.md)  
4. 勿提交密钥 — [docs/secrets-rotation.md](docs/secrets-rotation.md)  
5. 遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

### 开发流程

```bash
cp .env.example .env
npm install && npx expo prebuild
npx expo start
```

### Pull Request

1. 从 `main` 拉分支  
2. 通过 `npm run lint && npm test && npx tsc --noEmit`  
3. PR 尽量单一主题  
4. 改动环境变量、安全行为或发布流程时同步更新文档  

### 代码规范

| 主题 | 规则 |
|------|------|
| 环境变量 | 仅 `src/config/env.ts`；更新 `.env.example` 与文档 |
| 功能开关 | `src/config/features.ts` |
| 品牌 | `app.config.branding.js` ↔ `src/config/branding.ts` |
| API | `src/lib/api/` + Zod |
| 国际化 | 同时更新 `en` 与 `zh-TW` |
| 安全 UX | 签名/破坏性操作需明确确认 |

### 欢迎与需先讨论

欢迎：修复、文档、测试、无障碍、i18n。  
需先讨论：新第三方服务、破坏性 env 变更、削弱确认屏或 E2EE 的改动。

### 安全贡献

可利用漏洞请邮件 **security@kura-finance.com**，勿公开 Issue。

### 知识产权

贡献归 Kura Finance LLC 专有（见 [LICENSE](LICENSE)）。提交前须确保你有权贡献该代码。
