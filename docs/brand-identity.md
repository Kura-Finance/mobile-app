# Brand Identity / 品牌識別

**English** | [中文](#中文)

Source-of-truth inventory of **app name, colors, logos, icons, SVG usage, and packaging assets** for this mobile client. Use this when rebranding, forking, or auditing UI consistency.

**Related:** [fork-guide.md](fork-guide.md) · [maintainers.md](maintainers.md) · [handover.md](handover.md)

**Code sources of truth:**

| Concern | Path |
|---------|------|
| Semantic colors (light / dark) | [`src/shared/theme/theme.ts`](../src/shared/theme/theme.ts) |
| Theme consumption | [`src/shared/theme/ThemeContext.tsx`](../src/shared/theme/ThemeContext.tsx) (`useTheme()`) |
| Product identity strings | [`src/config/branding.ts`](../src/config/branding.ts) |
| Native name / bundle / scheme | [`app.config.branding.js`](../app.config.branding.js) |
| Splash / icon wiring | [`app.config.js`](../app.config.js) |
| Raster assets | [`assets/`](../assets/) |

> Prefer `colors.*` from `useTheme()` over hardcoded hex. Several screens still use literal `#7C3AED` / `#8B5CF6` for gradients and accents — listed below under **Legacy / hardcoded**.

---

## English

### 1. Product identity

| Field | Value | Where |
|-------|-------|--------|
| Display name | `Kura` | `brand.appName`, `brand.walletName` |
| Slug | `kura` | branding |
| Bundle / package ID | `com.kurafinance.app` | branding |
| URL scheme | `kura://` | branding |
| Tagline | One app to manage all your finances, from tradFi to crypto. | `brand.appDescription` |
| Homepage | `https://kura-finance.com` | branding → legal WebViews |
| Support | GitHub Issues (`brand.supportUrl`) | branding |
| WalletConnect wallet id | `kura-wallet` | branding → AppKit |
| Public wallet icon URL | `https://kura-finance.com/icon.png` | `brand.defaultIconUrl` (override: `EXPO_PUBLIC_WALLET_ICON_URL`) |
| Passkey RP name / host | `Kura` / `api.kura-finance.com` | branding |

Change branding in **both** `app.config.branding.js` and `src/config/branding.ts`, then `npx expo prebuild --clean`. See [fork-guide.md](fork-guide.md).

---

### 2. Color system (semantic tokens)

Defined in `theme.ts`. Modes: `system` | `light` | `dark`.

#### Backgrounds

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `background` | `#0B0B0F` | `#F2F2F7` | Screen background |
| `backgroundElevated` | `#111118` | `#FFFFFF` | Sheets, drawers |
| `surface` | `#1A1A24` | `#FFFFFF` | Cards |
| `surfaceAlt` | `#15151D` | `#F5F5F7` | Nested surfaces |
| `surfaceInput` | `#1F2937` | `#EFEFF4` | Inputs, pills |

#### Text

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `text` | `#FFFFFF` | `#0B0B0F` | Primary |
| `textMuted` | `#9CA3AF` | `#6B7280` | Secondary |
| `textFaint` | `#6B7280` | `#9CA3AF` | Hints |
| `textInverse` | `#FFFFFF` | `#FFFFFF` | On primary buttons |

#### Borders

| Token | Dark | Light |
|-------|------|-------|
| `border` | `rgba(255,255,255,0.07)` | `rgba(0,0,0,0.08)` |
| `borderStrong` | `#374151` | `rgba(0,0,0,0.15)` |

#### Brand

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `primary` | `#8B5CF6` | `#7C3AED` | Brand purple |
| `primaryDark` | `#4F46E5` | `#6D28D9` | Pressed / gradient end |
| `primarySoft` | `rgba(139,92,246,0.15)` | `rgba(124,58,237,0.10)` | Soft badge bg |
| `primaryOnSoft` | `#C4B5FD` | `#6D28D9` | Icon/text on soft |

#### Status

| Token | Dark | Light |
|-------|------|-------|
| `success` | `#10B981` | `#059669` |
| `warning` | `#FBBF24` | `#D97706` |
| `danger` | `#EF4444` | `#DC2626` |

#### Misc

| Token | Dark | Light | Notes |
|-------|------|-------|-------|
| `overlay` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.4)` | Modal backdrop |
| `qrBackground` | `#FFFFFF` | `#FFFFFF` | QR must stay light |
| `white` / `black` | `#FFFFFF` / `#000000` | same | Constants |

#### Primary CTA gradient (common pattern)

Many primary buttons use `expo-linear-gradient`:

```
['#7C3AED', '#4F46E5']   // start → end (left → right)
```

Maps roughly to light `primary` → dark `primaryDark`. Prefer wiring to theme tokens when touching those screens.

#### Splash / boot

| Surface | Value |
|---------|-------|
| Native splash background | `#FFFFFF` (`app.config.js`) |
| Boot loading accents | `#0B0B0F`, `#6B7280`, `#8B5CF6` (see `BootLoadingView`) |

---

### 3. Feature / chart palettes (not in theme.ts)

#### Portfolio allocation

[`src/features/crypto/utils/portfolioAllocation.ts`](../src/features/crypto/utils/portfolioAllocation.ts):

| Slice | Hex |
|-------|-----|
| Cash | `#8B5CF6` |
| Crypto | `#10B981` |
| Earn | `#3B82F6` |
| Stocks | `#F97316` |

#### Dinari stock fallbacks

[`src/features/stocks/config/dinariStocks.ts`](../src/features/stocks/config/dinariStocks.ts):

`#8B5CF6`, `#10B981`, `#F59E0B`, `#3B82F6`, `#EC4899`, `#06B6D4`

#### Physical / virtual card faces

| Component | Gradient / colors |
|-----------|-------------------|
| `VirtualCard` | `#FAFAFC` → `#ECECF2` → `#D8D8E2` → `#F2F2F6` (silver) |
| `StandardCard` | `#07050D` → `#140A24` → `#2E1065` → `#4C1D95` → `#312E81` (deep purple) |
| Overlay accents | warning `#F59E0B` / `#FCD34D`; danger `#EF4444` / `#FCA5A5` |

#### Partner / third-party marks

| Mark | Default color | Component |
|------|---------------|-----------|
| WalletConnect | `#3B99FC` | [`WalletConnectIcon.tsx`](../src/features/walletconnect/components/WalletConnectIcon.tsx) |

---

### 4. Logo & raster assets

There is **no local SVG wordmark**. Brand appearance in-app uses raster assets + remote icon URL.

#### Root `assets/` (replace on rebrand)

| File | Role |
|------|------|
| `icon.png` | App icon + web favicon |
| `splash-icon.png` | Splash image (`resizeMode: contain` on white) |
| `adaptive-icon.png` | Android adaptive foreground |
| `android-background.png` | Android adaptive background |
| `card.webp` | In-app mark on auth screens + card chrome |
| `gnosis-icon.png` | Partner asset (Gnosis owl; packaged, not `require`d) — [NOTICE](../NOTICE) |
| `gnosis-pay-icon.png` | Partner asset (Gnosis Pay owl) — [NOTICE](../NOTICE) |

#### Platform packs

| Path | Role |
|------|------|
| `assets/ios/AppIcon-*` + `Contents.json` | iOS icon set + marketing |
| `assets/android/play_store_512.png` | Play Store listing |
| `assets/android/res/mipmap-*` | Launcher / adaptive / monochrome |

#### In-app “logo” usage

`card.webp` is shown on auth / lock screens, e.g.:

- `PrivyLoginScreen`, `FaceIDScreen`, `EnterAppPinScreen`, `SetAppPinScreen`
- Card faces: `StandardCard`, `VirtualCard`, `MetalCard`

Remote listing icon: `brand.defaultIconUrl` or `EXPO_PUBLIC_WALLET_ICON_URL` (WalletKit / AppKit / WalletGuide).

---

### 5. Iconography

| System | Role |
|--------|------|
| **Ionicons** (`@expo/vector-icons`) | Default UI icons across nearly all screens |
| **Custom SVG components** | Feature-specific (not the app wordmark) |
| **Remote logos** | Tokens, vaults, stocks via logo.dev (`src/config/logodev.ts`) |

#### Custom SVG / drawn icons

| File | What |
|------|------|
| [`WalletConnectIcon.tsx`](../src/features/walletconnect/components/WalletConnectIcon.tsx) | Official WC path mark |
| [`WalletTxIcon.tsx`](../src/features/card/components/wallet/WalletTxIcon.tsx) | Buy / sell / deposit / borrow glyph SVGs; else Ionicons |

#### Other `react-native-svg` usage (charts / graphics, not brand marks)

Examples: `PriceChart`, `NetWorthChart`, `DefiAllocationCard`, `InvestMarketWidgetGraphics`, `VaultLogo` (`SvgUri` for remote vault art).

**No `.svg` files** are checked into the repo.

---

### 6. Typography

- **No branded font family** is loaded (`useFonts` not used for product type).
- Default: **system UI font** (San Francisco / Roboto via React Native).
- Addresses / codes: occasional `monospace` / iOS `Menlo`.
- Sizes and weights are **per-screen** (commonly `12–16` body, `600`/`700` for emphasis) — not centralized in theme.

---

### 7. Layout & motion (current practice)

Not tokenized in theme. Observed conventions:

| Concern | Typical values |
|---------|----------------|
| Corner radius | `8`, `12`, `14`, `16`, `20`, `24`, `28`, `32` |
| Screen horizontal padding | often `24` |
| Modal transitions | `"slide"` / `"fade"` |
| Loading motif | [`LoadingDots`](../src/shared/components/LoadingDots.tsx) — pulse ~280ms, stagger ~140ms; color usually `primary` / `#8B5CF6` |

---

### 8. Rebrand checklist (visual)

- [ ] Update `branding.ts` + `app.config.branding.js`
- [ ] Replace `assets/icon.png`, `splash-icon.png`, `adaptive-icon.png`, `android-background.png`, `card.webp`
- [ ] Remove or replace partner rasters (`gnosis-icon.png`, `gnosis-pay-icon.png`) — [NOTICE](../NOTICE)
- [ ] Regenerate `assets/ios/` and `assets/android/` launcher sets if needed
- [ ] Adjust `theme.ts` primary / surfaces if changing palette
- [ ] Set `EXPO_PUBLIC_WALLET_ICON_URL` / fee & WC dashboards
- [ ] Host legal pages on new `brand.homepage`
- [ ] `npx expo prebuild --clean` and store rebuild

Full steps: [fork-guide.md](fork-guide.md).

---

## 中文

### 概要

本文件盘点本 App 的**产品名、语义色、Logo / 光栅资源、图标体系、SVG 用法**。换牌或交接时以此为准；代码真源见文首表格。

### 产品识别

应用名 **Kura**，Bundle `com.kurafinance.app`，Scheme `kura`，文案与域名见 `src/config/branding.ts`。换牌须同步改 `app.config.branding.js`，见 [fork-guide.md](fork-guide.md)。

### 颜色

语义色在 [`theme.ts`](../src/shared/theme/theme.ts)，分 dark / light。品牌主色约 **紫**（dark `#8B5CF6` / light `#7C3AED`）。主按钮渐变常见 `['#7C3AED','#4F46E5']`。状态色：成功绿、警告黄、危险红。投资组合切片色见 `portfolioAllocation.ts`。

### Logo 与资源

无本地 SVG 字标。商店图标 / Splash：`assets/icon.png`、`splash-icon.png`、adaptive 系列。应用内 Logo 多用 `assets/card.webp`。远端 WC 图标：`brand.defaultIconUrl` 或 `EXPO_PUBLIC_WALLET_ICON_URL`。

合作方图示 `gnosis-icon.png`、`gnosis-pay-icon.png` 不适用 MIT，见 [NOTICE](../NOTICE)；fork 时请删除或替换。

### 图标

默认 **Ionicons**。自绘 SVG：`WalletConnectIcon`、`WalletTxIcon`。代币 / 股票 Logo 走 logo.dev，非品牌标。

### 字体与布局

系统字体；字号字重分散在各屏。圆角与间距尚未进 theme。加载动效见 `LoadingDots`。

### 换牌视觉清单

替换 branding 两文件 + `assets/` 图标与 `card.webp` + 按需改 `theme.ts` 主色 → `prebuild --clean` → 重新上架。
