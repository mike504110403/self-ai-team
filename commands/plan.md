# /plan - 啟動 PM + SA 規劃流程

> 由大腦呼叫，或老闆直接輸入需求時使用。

## 你的任務

作為大腦，你要並行呼叫 PM Agent 和 SA Agent，共同完成一份給老闆的 Present。

## 輸入

需求描述：$ARGUMENTS

若 $ARGUMENTS 為空，先讀取 `.ai-team/plans/requirements.md`（若存在）。

---

## 執行流程

### Step 1：確認理解（先回覆老闆）

在啟動代理之前，先簡短確認你的理解：

```
[大腦] 我理解你的需求是：
{1-3 句摘要}

我即將讓 PM 和 SA 開始規劃，包含：
- 需求規格 + User Stories（PM）
- 技術架構 + API 設計（SA）
預計完成後向你 present。
```

### Step 2：並行呼叫 PM 和 SA

使用 Agent 工具，在**同一個 message 裡同時發出兩個 Agent 呼叫**（這樣才是真正並行）。

**重要：兩個 Agent 呼叫必須在同一輪回應中發出，不可序列。**

**PM Agent：**
```
使用 Agent 工具，參數：
  subagent_type: "general-purpose"
  isolation: "worktree"
  prompt: |
    你是 PM Agent。用繁體中文輸出。
    
    專案需求：{需求描述}
    
    請在專案根目錄建立 .ai-team/plans/requirements.md，包含：
    1. 功能清單（條列式，清楚可測試）
    2. User Stories（格式：作為{角色}，我想要{功能}，以便{價值}）
    3. 驗收標準（每個功能點的 Done Definition）
    4. 不在範圍內的功能（明確列出 Out of Scope）
    5. 初步 Sprint 建議（幾個 Sprint，每個 Sprint 的目標）
    
    輸出風格：精簡、可執行、不廢話。
    完成後 commit，訊息格式：docs(pm): 撰寫需求規格
```

**SA Agent：**
```
使用 Agent 工具，參數：
  subagent_type: "general-purpose"
  isolation: "worktree"
  prompt: |
    你是 SA Agent。用繁體中文輸出。
    
    專案需求：{需求描述}
    
    請在專案根目錄建立 .ai-team/plans/architecture.md，包含：
    1. 技術棧選擇（每項都附上選擇理由，以及考慮過哪些替代方案）
    2. 系統架構圖（用 ASCII 或 Mermaid，清楚說明各服務/模組關係）
    3. API 設計概要（主要 endpoint 清單，RESTful 或 GraphQL 說明）
    4. DB Schema 概要（主要資料表和關係）
    5. 技術風險與建議（說明哪些部分需要特別注意）
    
    輸出風格：精準、有根據、不堆砌技術術語。
    完成後 commit，訊息格式：docs(sa): 撰寫架構設計
```

### Step 3：彙整成 Present 文件

PM 和 SA 完成後，將兩份輸出整合成一份 present 文件，儲存至：
`.ai-team/presents/{YYYY-MM-DD}-present.md`

Present 結構：
```markdown
# 專案規劃 Present
**日期**：{今天日期}
**需求摘要**：{一行描述}

---

## 一、需求規格（PM）
{從 requirements.md 萃取重點}

## 二、技術架構（SA）
{從 architecture.md 萃取重點}

## 三、Sprint 計畫
| Sprint | 目標 | 主要任務 | 負責代理 | 預估時程 |
|--------|------|---------|---------|---------|

## 四、風險與建議
{PM + SA 的主要建議}

---

## ✅ 等待老闆確認

請回覆：
- 「確認，開始 Sprint 1」→ 立即啟動開發
- 「修改：{修改意見}」→ 大腦更新規劃後再次 present
- 「有問題：{問題}」→ 大腦回答或調整
```

### Step 4：通知老闆

**在 Claude Code 介面顯示：**
完整 present 內容（或摘要 + 附上檔案路徑）

**同時發送 Telegram（若已設定）：**
```
[BRAIN] 📋 規劃完成，等待確認

專案：{專案名稱}
Sprint 數量：{N} 個
技術棧：{主要技術}

📎 詳見：.ai-team/presents/{日期}-present.md

✅ 確認開始 | ✏️ 修改意見 | ❓ 有問題
```

---

## 注意事項

- PM 和 SA 必須**並行**執行，不要序列
- 若 PM 或 SA 發現需求有模糊地帶，應列出假設而非停下來問老闆
- Present 後如果老闆提出修改，直接更新對應文件，不需要重做整個 present

## 自動推進

Present 發出後，**這是唯一需要等老闆確認的步驟**。
老闆確認後，大腦應該**立即自動啟動 Sprint 1**，不需要老闆再說「/sprint 1」。

同時，在等待老闆確認的期間：
- Frontend 可以先根據 PM 的 User Stories 開始切版（純 UI，不串 API）
- SA 可以先準備 sprint-1-interface.md 的草稿

這樣老闆一確認，Backend/DBA 馬上就能開工。
