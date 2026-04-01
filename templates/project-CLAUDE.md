# {專案名稱}

> 此文件由 /new-project 自動生成，請依專案需求修改。
> 全域規則見 ~/.claude/CLAUDE.md，本文件僅記錄專案特定設定。

---

## 專案概述

**名稱**：{專案名稱}
**目標**：{一句話描述專案目的}
**建立日期**：{YYYY-MM-DD}
**目前狀態**：規劃中 / Sprint N 開發中 / 維護中

---

## 技術棧

> SA 確認後填寫，未確認前保留空白

| 層級 | 技術 | 版本 | 備註 |
|------|------|------|------|
| 前端 | | | |
| 後端 | | | |
| 資料庫 | | | |
| 部署 | | | |
| 測試 | | | |

---

## 環境設定

```bash
# 開發環境
npm install      # 或對應指令
npm run dev

# 測試
npm test

# 建置
npm run build
```

---

## 重要路徑

```
{專案根目錄}/
├── .ai-team/           ← AI 團隊的所有規劃文件
│   ├── plans/          ← requirements, architecture, sprint plans
│   ├── qa/             ← 測試計畫和報告
│   └── presents/       ← 給老闆的 present 文件
├── src/                ← 原始碼
└── tests/              ← 測試程式碼
```

---

## 代理特別注意事項

> 本專案的特殊規範，所有代理必須遵守

### 通用
- {例如：所有 API 回應格式統一為 `{ success, data, error }`}
- {例如：禁止直接 commit 到 main 或 develop}

### BACKEND
- {例如：使用 PostgreSQL，不接受 SQLite}
- {例如：所有 DB 查詢必須使用 ORM，禁止原生 SQL}

### FRONTEND
- {例如：使用 TypeScript，嚴格模式}
- {例如：元件必須有 Storybook 頁面}

### DBA
- {例如：Migration 檔案命名格式：YYYYMMDD_描述.sql}
- {例如：所有 Table 必須有 created_at、updated_at}

### QA
- {例如：覆蓋率門檻：80%}
- {例如：E2E 測試使用 Playwright}

---

## 目前 Sprint 狀態

| Sprint | 狀態 | 目標 | QA 結果 |
|--------|------|------|---------|
| 1 | 待開始 | | |

---

## Telegram Bridge 啟動方式

```bash
# 在專案根目錄執行（需有 .env 設定）
node ~/.claude/templates/telegram-bridge.js --project .

# 或加入 package.json scripts 後
npm run bridge
```

---

## 已知問題 / 技術債

> 由各代理在開發過程中記錄，大腦在 Sprint 規劃時決定何時處理

- [ ] {問題描述} — 發現於 Sprint N，嚴重程度：低/中/高
