# i18n / Internationalization / 国际化

**English** | [中文](#中文)

The app uses **i18next** + **react-i18next**. Supported languages: **English (`en`)** and **Traditional Chinese (`zh-TW`)**.

---

## English

### Layout

```
src/shared/locales/
├── i18n.ts              # i18next init
├── index.ts             # Resource bundle exports
├── en/common.json       # English strings
└── zh-TW/common.json   # Traditional Chinese strings
src/shared/hooks/
└── useAppTranslation.ts # Hook: t(), language, changeLanguage
```

Language preference is stored in Zustand (`useAppStore` → `userPreferences.language`).

### Usage in components

```typescript
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';

export default function MyScreen() {
  const { t, language, changeLanguage } = useAppTranslation();

  return (
    <>
      <Text>{t('common.appName')}</Text>
      <Button title="中文" onPress={() => changeLanguage('zh')} />
    </>
  );
}
```

Keys use dot notation matching JSON groups: `t('settings.language')`.

### Adding strings

1. Add the key to **`en/common.json`** and **`zh-TW/common.json`** in the same group.
2. Use `t('group.key')` in the component — no hardcoded user-facing text in PRs.

Example:

```json
// en/common.json
{ "card": { "sendUsdc": "Send USDC" } }

// zh-TW/common.json
{ "card": { "sendUsdc": "发送 USDC" } }
```

### Adding a new language

1. Create `src/shared/locales/<lang>/common.json`.
2. Register in `src/shared/locales/index.ts`:
   ```typescript
   import jaCommon from './ja/common.json';
   export const resources = {
     en: { common: enCommon },
     zh: { common: zhCommon },
     ja: { common: jaCommon },
   };
   ```
3. Extend `Language` type in `src/shared/store/useAppStore.ts`.
4. Add a picker entry in settings UI.

### Common JSON groups

| Group | Purpose |
|-------|---------|
| `common` | Shared buttons, labels |
| `auth` | Login, signup |
| `card` | Wallet, Gnosis Pay, send |
| `crypto` | Tokens, swap, bridge |
| `investments` | Portfolio, holdings |
| `trackfi` | TrackFi hub |
| `settings` | Preferences, language |
| `errors` | Error messages |

### Boot integration

`App.tsx` imports `./src/shared/locales/i18n` and wraps the tree with `I18nextProvider`.

### Debugging

- Missing key → i18next returns the key string; check both JSON files.
- Wrong language → log `language` from `useAppTranslation()`.
- Non-UI strings (API errors parsed server-side) may stay in English unless explicitly translated.

---

## 中文

本应用使用 i18next 进行国际化，当前支持 **英文 (en)** 与 **繁体中文 (zh-TW)**。

### 架构

```
src/shared/locales/
├── i18n.ts                 # i18next 配置
├── index.ts                # 资源导出
├── en/common.json          # 英文
└── zh-TW/common.json          # 繁体中文
src/shared/hooks/
└── useAppTranslation.ts    # 结合 Zustand 的语言 hook
```

### 在组件中使用

```typescript
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';

export default function MyComponent() {
  const { t, language, changeLanguage } = useAppTranslation();

  return (
    <View>
      <Text>{t('common.appName')}</Text>
      <Text>当前语言：{language}</Text>
      <Button title="切换中文" onPress={() => changeLanguage('zh')} />
    </View>
  );
}
```

### 添加新翻译

1. 在 `en/common.json` 与 `zh-TW/common.json` **同时**添加相同 key。
2. 组件中使用 `t('分组.key')`，PR 中避免硬编码面向用户的文案。

### 添加新语言（例如日文）

1. 创建 `src/shared/locales/ja/common.json`
2. 在 `index.ts` 注册资源
3. 更新 `useAppStore.ts` 中的 `Language` 类型
4. 在设置界面增加语言选项

### 语言同步原理

`useAppTranslation` 在 Zustand 的 `language` 变化时调用 `i18n.changeLanguage()`，触发界面重渲染。

### 翻译文件分组

| 分组 | 用途 |
|------|------|
| `common` | 通用按钮与文字 |
| `auth` | 认证 |
| `dashboard` | 仪表板 |
| `card` / `crypto` | 钱包与 Crypto |
| `investments` / `trackfi` | 投资与 TrackFi |
| `settings` | 设置 |
| `errors` | 错误消息 |

### 最佳实践

1. 保持 en / zh-TW key 结构一致
2. 所有用户可见文本走翻译系统
3. 新增 key 时两个语言文件一起改

### 调试

- key 不存在 → 界面显示 key 本身
- 检查 `useAppTranslation()` 的 `language`
- 确认 `App.tsx` 已加载 `i18n` 并使用 `I18nextProvider`

### 参考

- [i18next 文档](https://www.i18next.com/)
- [react-i18next 文档](https://react.i18next.com/)
