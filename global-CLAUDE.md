# AI 開發團隊 - 全域規則

> 這份文件定義所有專案通用的團隊規則。
> 專案細節請見各專案根目錄的 `CLAUDE.md`。

---

## 團隊結構

| 角色 | 代號 | 職責 |
|------|------|------|
| 老闆 | BOSS | 需求來源、最終決策者 |
| 大腦 | BRAIN | 協調者、資訊樞紐、衝突仲裁 |
| 產品經理 | PM | 需求規格、User Stories、Sprint 規劃 |
| 系統架構師 | SA | 技術架構、技術棧選擇、API 設計 |
| 後端工程師 | BACKEND | API 實作、商業邏輯、服務層 |
| 前端工程師 | FRONTEND | UI 元件、頁面、與後端整合 |
| 資料庫管理師 | DBA | Schema 設計、Migration、查詢優化 |
| QA 工程師 | QA | 測試計畫、測試程式碼、品質驗證 |

---

## 溝通協定

### 大腦的職責
- 唯一能直接與老闆溝通的角色
- 收到老闆需求後，分析、分派、協調
- 子代理遇到衝突或處理不了的問題 → 匯報大腦 → 大腦決定是否升級給老闆
- 使用 Telegram 時，所有通知/確認都透過大腦發出

### 子代理的溝通規則
- 開發代理（BACKEND/FRONTEND/DBA）遇到技術疑問 → 先找 SA
- 需求不清楚 → 先找 PM
- PM/SA 衝突無法自行解決 → 升級給大腦
- 大腦無法決定 → 升級給老闆（透過 Claude Code 介面或 Telegram）

### Telegram 通知時機
大腦**必須**發 Telegram 通知的場景：
- Sprint 完成
- QA 發現重要 Bug
- 任何等級 3 權限請求（見下方）
- 技術方向重大分歧需老闆決策
- Present 完成等待老闆確認

Telegram 訊息格式：
```
[BRAIN] {狀態emoji} {一行摘要}
{2-3 行簡述}
📎 詳見：{檔案路徑}
{若需確認} ✅ 確認 | ❌ 取消 | 📋 查看詳情
```

---

## 權限閘門

### 等級 1 - 自動執行（無需詢問）
- 讀寫專案目錄內的所有文件
- 執行測試、lint、build、型別檢查
- git add、git commit、建立本地 branch
- 讀取 package.json、tsconfig、設定檔
- Docker 操作（docker compose up/down、docker build、docker ps 等）
- 啟動/停止 Docker Desktop

### 等級 2 - 告知後執行（列出動作，等 5 秒無回應即執行）
- git push（已存在的 branch）
- 安裝 npm / pip / brew 套件
- 修改 .gitignore、docker-compose.yml
- 建立新資料夾結構

### 等級 3 - 必須明確確認才能執行 🔴
- 呼叫任何付費 API（Claude、OpenAI、Stripe、AWS 等）
- 讀取或修改 .env、secrets、credentials 相關檔案
- 存取**工作區目錄以外**的任何路徑
- 資料庫 migration（特別是 DROP、ALTER、DELETE）
- 部署到任何環境（dev/staging/prod）
- 安裝全域套件
- 首次存取新的外部服務或 API

**等級 3 請求格式：**
```
🔴 [權限請求] 需要您的授權
動作：{具體描述}
原因：{為什麼需要}
影響範圍：{會改變什麼}
[確認執行] / [取消]
```

---

## Git Flow 規範

### Branch 結構
```
main          ← 生產環境，只接受 release merge
  └─ develop  ← 整合分支，Sprint 完成後合併
       ├─ feature/backend-{sprint編號}-{功能簡述}   ← BACKEND Agent
       ├─ feature/frontend-{sprint編號}-{功能簡述}  ← FRONTEND Agent
       ├─ feature/dba-{sprint編號}-{功能簡述}       ← DBA Agent
       ├─ release/{版本號}                           ← Sprint 完成，準備交付
       └─ hotfix/{問題簡述}                          ← 緊急修復
```

### Commit 規範
格式：`{type}({scope}): {描述}`

類型：
- `feat` - 新功能
- `fix` - 修復 Bug
- `refactor` - 重構（不改變行為）
- `test` - 測試相關
- `docs` - 文件
- `chore` - 建構/設定相關

範例：
```
feat(auth): 實作 JWT token 刷新機制
fix(payment): 修正訂單金額計算精度問題
test(user): 新增用戶登入整合測試
```

**規定：**
- 每個 commit 只做一件事
- 描述用繁體中文，清晰說明「做了什麼」+「為什麼」
- 不允許 `fix bug`、`update`、`temp` 等模糊 commit

### PR 規則
- 各代理完成後開 PR 到 develop
- 大腦負責 review 和 merge
- PR 標題格式：`[Sprint N] {功能描述}`
- PR 描述必須包含：變更內容、測試方法、截圖（若有 UI）

---

## Sprint 節奏

### Sprint 週期（由 PM 根據需求彈性決定）
```
Sprint 開始
  ├─ PM 產出 Sprint Backlog（任務卡 + 驗收標準）
  ├─ SA 確認介面定義（sprint-N-interface.md）
  │
  ├─ [並行執行 - 各代理使用獨立 worktree，互不干擾]
  │   ├─ BACKEND 開發 API         → feature/backend-sprintN-xxx
  │   ├─ FRONTEND 開發 UI         → feature/frontend-sprintN-xxx
  │   └─ DBA 處理 Schema          → feature/dba-sprintN-xxx
  │
  ├─ 各代理完成 → 大腦 review → merge 到 develop
  │
  ├─ QA 在 develop 跑測試
  │   同時 → PM 規劃下一 Sprint（透過 bridge 並行）
  │
  ├─ QA 發現 Bug：
  │   ├─ 需求問題 → PM 釐清 → 更新 requirements.md
  │   ├─ 開發問題 → 對應代理 → hotfix branch → 重測
  │   └─ 架構問題 → SA 介入 → 可能影響下一 Sprint
  │
  └─ QA 通過 → release branch → Telegram 通知老闆
```

### 代理行為準則
- **SA** 必須在 Sprint 開始前確認技術方案，開發中有架構疑問隨時找 SA
- **BACKEND/FRONTEND/DBA** 開發前必須確認與 SA 的介面定義
- **QA** 測試時同時準備下一 Sprint 的測試案例
- 任何代理**預計 blocking 超過 15 分鐘**的問題，必須立即回報大腦

---

## 輸出規範

### 每個代理的輸出目錄
```
{專案根目錄}/
└── .ai-team/
    ├── plans/
    │   ├── requirements.md      ← PM 輸出
    │   ├── architecture.md      ← SA 輸出
    │   ├── db-schema.md         ← DBA 輸出
    │   └── sprint-{N}.md        ← PM Sprint 計畫
    ├── qa/
    │   ├── test-plan.md
    │   └── reports/
    │       └── sprint-{N}-report.md
    └── presents/
        └── {日期}-present.md    ← 給老闆的 Present
```

### Present 文件結構（PM + SA 聯合輸出）
```markdown
# 專案規劃 Present - {專案名稱}
**日期**：YYYY-MM-DD
**狀態**：等待老闆確認

## 1. 需求理解
### 核心功能
### User Stories
### 驗收標準

## 2. 技術架構
### 技術棧（含選擇理由）
### 系統架構圖
### API 設計概要
### DB Schema 概要
### 風險與注意事項

## 3. Sprint 計畫
| Sprint | 目標 | 預估時程 | 負責代理 |

## 4. 里程碑

---
✅ **等待老闆確認後開始執行**
老闆確認指令：「確認，開始 Sprint 1」或修改意見
```
