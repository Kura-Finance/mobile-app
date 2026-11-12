# TODO — 社區版（無後端）上線前

> 工作筆記，對應 PR「On-chain community edition」。全部完成後請刪除這個檔案。
> 相關 PR：WebClients 與 BackendServer 的同名分支 `claude/awesome-ritchie-i1bwnp`。

這個分支的變更只通過了型別檢查、單元測試與 lint（`npm test && npm run lint && npx tsc --noEmit`），**沒有在實機上跑過**。

## 1. 實機驗證（`EXPO_PUBLIC_API_BASE_URL` 留空）

- [ ] 首次開啟顯示「建立新錢包／我已經有錢包」，不出現 Privy 登入
- [ ] 建立錢包：顯示 12 字助記詞，勾選後才能繼續；之後要求設定 App PIN
- [ ] 匯入助記詞（12 字）與匯入私鑰（64 hex）都能進到主畫面
- [ ] 冷啟動後要求解鎖（生物辨識／PIN），解鎖後回到同一個錢包
- [ ] 送一筆小額 USDC、做一次 Swap、連一個 WalletConnect dApp 並簽名
- [ ] Morpho Earn 存入／提出各一次
- [ ] 設定 → Profile & Security → 助記詞：需通過 App 鎖才顯示，截圖被擋
- [ ] 設定 → 從此裝置移除錢包：有確認對話框；移除後回到建立／匯入畫面
- [ ] 鎖定畫面「忘記 PIN」：只能走移除錢包，取消後 PIN 仍在、錢包仍在
- [ ] 沒有設定生物辨識的 Android 裝置上也能建立錢包（會退回一般金鑰庫）
- [ ] 每次簽名的系統驗證提示是否可接受；太頻繁的話再調整金鑰的儲存選項
- [ ] 加值只顯示 USDC 收款地址；轉帳只顯示加密貨幣收款人；首頁沒有卡片橫幅
- [ ] 全程沒有任何請求送往 `api.kura-finance.com` 或 Privy

## 2. 地址一致性

- [ ] 同一組助記詞在手機與網頁顯示同一個 Safe 地址
- [ ] 對真實鏈跑一次比對腳本，兩邊輸出相同：
      `node scripts/safe-address-parity.cjs . https://mainnet.base.org`
      `node scripts/safe-address-parity.cjs ../WebClients https://mainnet.base.org`
- [ ] **舊用戶搬遷**：拿一個現有帳號，記下目前的 Safe 地址 → 到 home.privy.io 匯出私鑰 → 新版「匯入 → 私鑰」→ 地址不變、資金看得到

## 3. 有後端的模式（自架者會用到）

- [ ] 設定 `EXPO_PUBLIC_API_BASE_URL` 與 Privy 金鑰後，Privy 登入、TrackFi、法幣出入金、卡片、推薦、刪除帳戶都和改動前一樣

## 4. 發佈

- [ ] 打包時 `EXPO_PUBLIC_API_BASE_URL` 留空；Privy 金鑰不需要
- [ ] 更新商店的隱私與資料收集聲明（不再有帳戶、不再收集 email）
- [ ] 上架說明／App 內公告：舊用戶更新前先到 home.privy.io 匯出私鑰；助記詞遺失無法找回
- [ ] Privy app 保留到沒有人需要匯出私鑰為止

## 5. 之後再做

- [ ] Privy SDK 在無後端時仍被打包（不載入）；要瘦身需改成動態載入
- [ ] `ImportWalletScreen`（舊的 App 內匯入畫面）沒有任何入口，且預覽地址用的是 SimpleAccount 而非 Safe；刪除或修正
- [ ] 舊用戶更新後「已連線的 dApp 紀錄」會清空（紀錄以使用者 id 為鍵，id 已改變）
