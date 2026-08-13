# SUM 保修據點消費者版

零框架靜態網站，提供 SUM 全台保修據點搜尋、Google 評價檢視、導航與官方預約入口。

## 資料與原則

- 據點、Google 星等／評論數及官方標章：SUM 保修官網 `repair/api/storelist.php`
- 前台資料：`data/stores.json`
- 更新腳本：`scripts/update-stores.mjs`
- `台北市` 會正規化為 `臺北市`，並依站號與 Google Place ID 去重。
- 缺少評價的店家顯示「尚無資料」，不推估星等。

## 開發與驗證

```bash
npm install
npm run dev
npm test
npm run build
```

Netlify 發布目錄為 `dist`。品牌正式網域確認前保留 `noindex`，避免測試子網域與 SUM 官網內容互相競爭。
