# /sprint - 啟動 Sprint 開發週期

> 老闆確認 Present 後，由大腦呼叫啟動開發。

## 輸入

Sprint 編號或指示：$ARGUMENTS
（例如：`1`、`2`、`全部`、`繼續`）

---

## 執行流程

### Step 0：讀取 Sprint 計畫

讀取 `.ai-team/plans/sprint-{N}.md`（若不存在，從 `.ai-team/plans/requirements.md` 推導）

確認本次 Sprint 的：
- 目標
- 任務清單（各代理負責的部分）
- 驗收標準

### Step 1：準備 Git 環境

**由大腦執行（等級 1 - 自動）：**
```bash
# 確保 develop 存在
git checkout develop 2>/dev/null || git checkout -b develop
```

不需要手動建 feature branch——每個代理使用 `isolation: "worktree"` 時，會自動在獨立的 worktree 中工作，完成後回傳 branch 名稱。

### Step 2：確認介面定義（SA 先行）

在開始實作前，先呼叫 SA Agent 確認本 Sprint 的介面合約：

```
使用 Agent 工具，參數：
  subagent_type: "general-purpose"
  isolation: "worktree"
  prompt: |
    你是 SA Agent。用繁體中文輸出。
    
    讀取以下文件了解背景：
    - .ai-team/plans/requirements.md
    - .ai-team/plans/architecture.md
    
    請確認並輸出 Sprint {N} 的介面定義到 .ai-team/plans/sprint-{N}-interface.md：
    1. API Endpoint 清單（路徑、方法、Request/Response 格式）
    2. 資料庫異動（新增/修改的 Table/Column）
    3. 前後端共識的資料格式（DTO / Response Schema）
    4. 技術決策（快取策略、認證方式、錯誤處理規範）
    
    這份文件是本 Sprint 所有開發代理的共同合約。
    完成後 commit，訊息格式：docs(sa): Sprint {N} 介面定義
```

**SA 完成後，將 sprint-{N}-interface.md 合併到 develop，再啟動開發代理。**

### Step 3：並行啟動開發代理

**重要：以下三個 Agent 必須在同一輪回應中同時發出，實現真正並行。**

每個 Agent 使用 `isolation: "worktree"` 獲得獨立的 repo 副本。

**BACKEND Agent：**
```
使用 Agent 工具，參數：
  subagent_type: "general-purpose"
  isolation: "worktree"
  prompt: |
    你是 BACKEND Agent。用繁體中文溝通。
    
    先讀取以下文件了解背景：
    - .ai-team/plans/requirements.md
    - .ai-team/plans/architecture.md
    - .ai-team/plans/sprint-{N}-interface.md
    
    你在 feature/backend-sprint{N}-{功能簡述} branch 上工作。
    執行：git checkout -b feature/backend-sprint{N}-{功能簡述}
    
    本次 Sprint 你的任務：
    {PM 分配給 Backend 的任務清單}
    
    要求：
    - 每個功能點完成後立即 commit（格式：feat(scope): 描述）
    - 嚴格遵守 sprint-{N}-interface.md 的 API 規格
    - 每個 API 都要寫對應的單元測試
    - 遇到與架構不一致的地方，在 commit message 中註明
    - 完成後回報：完成了哪些功能、commit 清單、branch 名稱
```

**FRONTEND Agent：**
```
使用 Agent 工具，參數：
  subagent_type: "general-purpose"
  isolation: "worktree"
  prompt: |
    你是 FRONTEND Agent。用繁體中文溝通。
    
    先讀取以下文件了解背景：
    - .ai-team/plans/requirements.md
    - .ai-team/plans/sprint-{N}-interface.md
    
    你在 feature/frontend-sprint{N}-{功能簡述} branch 上工作。
    執行：git checkout -b feature/frontend-sprint{N}-{功能簡述}
    
    本次 Sprint 你的任務：
    {PM 分配給 Frontend 的任務清單}
    
    要求：
    - 每個元件/頁面完成後立即 commit
    - 嚴格遵守 sprint-{N}-interface.md 的 API 規格來串接
    - API 尚未 ready 時，用 Mock 資料先行開發
    - 確保 UI 符合 User Stories 的驗收標準
    - 完成後回報：完成了哪些元件/頁面、commit 清單、branch 名稱
```

**DBA Agent：**
```
使用 Agent 工具，參數：
  subagent_type: "general-purpose"
  isolation: "worktree"
  prompt: |
    你是 DBA Agent。用繁體中文溝通。
    
    先讀取以下文件了解背景：
    - .ai-team/plans/architecture.md
    - .ai-team/plans/sprint-{N}-interface.md
    
    你在 feature/dba-sprint{N}-{功能簡述} branch 上工作。
    執行：git checkout -b feature/dba-sprint{N}-{功能簡述}
    
    本次 Sprint 你的任務：
    {DBA 相關的 Schema / Migration 任務}
    
    要求：
    - Migration 檔案要有 up 和 down
    - 更新 .ai-team/plans/db-schema.md 記錄 Schema 變更
    - Index 設計要考慮查詢效能
    - 完成後回報：Schema 變更摘要、commit 清單、branch 名稱
```

### Step 4：代理完成後的處理

三個代理都完成後（Agent 工具自動等待），大腦執行：

1. **Review 每個代理的輸出**
   - 讀取各 branch 的 commit log
   - 檢查是否符合 sprint-{N}-interface.md 的合約
   - 若有問題 → 再次呼叫對應 Agent（帶上修改意見）修正

2. **Merge 到 develop**
   ```bash
   git checkout develop
   git merge --no-ff feature/dba-sprint{N}-{功能}      # DBA 先 merge（Schema 優先）
   git merge --no-ff feature/backend-sprint{N}-{功能}   # Backend 其次
   git merge --no-ff feature/frontend-sprint{N}-{功能}  # Frontend 最後
   ```
   若有衝突 → 大腦自行解決或呼叫對應代理處理

3. **觸發 QA**
   所有 merge 完成後，立即呼叫 `/qa {N}` 流程。

### Step 5：Telegram 通知

**Sprint 開始時，用 telegram_send 發送：**
```
[BRAIN] 🚀 Sprint {N} 開始

目標：{Sprint 目標}
代理：BACKEND + FRONTEND + DBA 並行開發中
預計完成後通知你
```

**Sprint 完成時，用 telegram_send 發送：**
```
[BRAIN] ⚙️ Sprint {N} 開發完成，QA 測試中...

已完成：
✅ BACKEND：{功能摘要}
✅ FRONTEND：{功能摘要}
✅ DBA：{Schema 變更}

QA 完成後通知你
```

---

## 跨 Sprint 並行（QA + 下一 Sprint 同時進行）

**在 Claude Code 對話中**，大腦受限於單線程，無法同時等 QA 又啟動新 Sprint。

**解決方式**：透過 Telegram bridge 的多進程能力：

當 Sprint N 開發完成後，bridge 可以同時啟動：
```
進程 1：claude -p "/qa {N}"               ← QA 測試 Sprint N
進程 2：claude -p "/sprint {N+1}"          ← 開始 Sprint N+1
```

兩者完全獨立並行，各自完成後透過 Telegram 通知大腦和老闆。

詳見 telegram-bridge.js 的多進程管理邏輯。
