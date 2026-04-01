# /qa - 啟動 QA 測試流程

> Sprint 代理全部完成 merge 到 develop 後呼叫。

## 輸入

$ARGUMENTS（Sprint 編號，例如：`1`）

---

## 執行流程

### Step 1：準備測試環境

確認 develop branch 已包含本 Sprint 所有 merge。

讀取：
- `.ai-team/plans/requirements.md`（驗收標準）
- `.ai-team/plans/sprint-{N}.md`（Sprint 目標）
- `.ai-team/plans/sprint-{N}-interface.md`（介面定義）

### Step 2：啟動 QA Agent

```
使用 Agent 工具，參數：
  subagent_type: "general-purpose"
  isolation: "worktree"
  prompt: |
    你是 QA Agent。用繁體中文輸出。
    針對 Sprint {N} 進行完整測試。
    
    先讀取：
    - .ai-team/plans/requirements.md
    - .ai-team/plans/sprint-{N}.md
    - .ai-team/plans/sprint-{N}-interface.md
    
    測試範圍（以 develop branch 為基準）：
    
    請執行以下測試，並將結果記錄到 .ai-team/qa/reports/sprint-{N}-report.md：

1. 功能測試
   - 依據 .ai-team/plans/requirements.md 的驗收標準，逐一驗證
   - 每個 User Story 至少覆蓋一個測試案例
   - 記錄：PASS / FAIL / BLOCKED（含原因）

2. 整合測試
   - BACKEND + FRONTEND + DBA 的介面整合是否正常
   - API Response 格式是否符合 sprint-{N}-interface.md 的定義

3. 邊界條件測試
   - 空值、最大值、非法輸入
   - 並發情境（若適用）

4. Regression 測試
   - 確認前幾個 Sprint 的功能沒有被破壞

5. 寫測試程式碼
   - 對每個 FAIL 的案例，若是可自動化的，直接補寫測試
   - 測試放到對應目錄（例如 tests/sprint-{N}/）

報告格式：
---
# QA 報告 - Sprint {N}
**日期**：YYYY-MM-DD
**測試人員**：QA Agent

## 總覽
- 測試案例數：{N}
- PASS：{N}
- FAIL：{N}
- BLOCKED：{N}

## 失敗案例
| 編號 | 測試描述 | 預期結果 | 實際結果 | 嚴重程度 | 指派給 |
|------|---------|---------|---------|---------|--------|

## 阻塞案例（無法測試）
{列出原因}

## 建議
{QA 的建議}
---
    回報完成後，說明「QA Sprint {N} 完成，報告在 .ai-team/qa/reports/sprint-{N}-report.md」
```

### Step 3：處理 QA 結果

QA 完成後，大腦讀取報告並分類：

**若無 FAIL（全部 PASS）：**
```
→ 建立 release branch：git checkout -b release/{版本號}
→ 通知老闆（Claude Code + Telegram）
```

**若有 FAIL：**

對每個 Bug 分類：

1. **需求問題**（PM 需要釐清）
   → 呼叫 PM Agent：「這個功能的驗收標準有歧義：{描述}，請確認正確行為」
   → PM 確認後，更新 requirements.md

2. **開發問題**（代理要修復）
   → 開 hotfix branch：`hotfix/sprint{N}-{問題簡述}`
   → 指派對應代理修復
   → 修復完成後 → merge 到 develop → QA 重跑

3. **架構問題**（SA 需要介入）
   → 呼叫 SA Agent 分析問題根因
   → 若影響當前 Sprint：修復後重測
   → 若影響下個 Sprint：記錄到 Sprint N+1 的風險

**Bug 修復時，其他代理繼續推進下一 Sprint：**
```
修復 Bug → hotfix branch
    同時
下一 Sprint → 正常繼續規劃
（不要因為 Bug 卡住整個流程）
```

### Step 4：QA 通知老闆

**全部 PASS 時（Telegram）：**
```
[BRAIN] ✅ Sprint {N} QA 通過！

測試案例：{N} 個，全部通過
新增功能：
  ✅ {功能1}
  ✅ {功能2}

📎 完整報告：.ai-team/qa/reports/sprint-{N}-report.md
已建立 release/{版本號}，等待你決定是否 merge 到 main
```

**有 Bug 時（Telegram）：**
```
[BRAIN] ⚠️ Sprint {N} QA 發現問題

FAIL：{N} 個
嚴重：{N 個} | 一般：{N 個}

主要問題：
  🔴 {嚴重 Bug 描述}
  🟡 {一般 Bug 描述}

📎 詳見：.ai-team/qa/reports/sprint-{N}-report.md
已指派修復，開發繼續推進
```

---

## QA 與開發並行原則

QA 在測試 Sprint N 時：
- PM 已在規劃 Sprint N+1 的 Backlog
- 大腦確保兩條線不互相 blocking
- Bug 修復插入開發週期，不打亂整體節奏
