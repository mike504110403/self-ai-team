# /new-project - 初始化新專案的 AI 團隊設定

> 在新專案根目錄執行，自動建立所需的設定檔和目錄結構。

## 輸入

$ARGUMENTS（專案名稱，例如：`payment-system`）

---

## 執行流程

### Step 1：建立目錄結構

```bash
mkdir -p .ai-team/plans
mkdir -p .ai-team/qa/reports
mkdir -p .ai-team/presents
```

### Step 2：建立專案 CLAUDE.md

在目前目錄建立 `CLAUDE.md`，內容如下（用 $ARGUMENTS 填入專案名稱）：

---

```markdown
# {專案名稱} - 專案設定

## 專案概述
**名稱**：{專案名稱}
**建立日期**：{今天日期}
**目前狀態**：規劃中

## 需求摘要
> （大腦在第一次 /plan 後填入）

## 技術棧
> （SA 確認後填入）
- 後端：
- 前端：
- 資料庫：
- 部署：

## Sprint 進度
| Sprint | 狀態 | 完成日期 |
|--------|------|---------|
| Sprint 1 | 規劃中 | - |

## 重要決策記錄
> 詳見 .ai-team/plans/decisions.md

## 目錄說明
- `.ai-team/plans/` - 需求、架構、Sprint 計畫
- `.ai-team/qa/` - 測試計畫和 QA 報告
- `.ai-team/presents/` - 給老闆的 Present 文件

## Git Branch 現況
- main：生產環境
- develop：整合分支（Sprint 合併目標）

## Telegram 設定
- Bot Token：（見 .env，不要 commit）
- Chat ID：（見 .env，不要 commit）
- 通知等級：重要事項（Sprint 完成、QA 結果、需決策事項）
```

---

### Step 3：建立 .gitignore 補充（若不存在則建立，若存在則追加）

確認以下項目在 .gitignore：
```
.env
.env.local
.env*.local
.ai-team/presents/*.pdf
```

### Step 4：初始化 Git Flow（若 repo 已存在）

```bash
# 確認 main 存在
git checkout main 2>/dev/null || git checkout -b main

# 建立 develop branch（若不存在）
git checkout develop 2>/dev/null || git checkout -b develop
git checkout main
```

### Step 5：完成通知

顯示：
```
[大腦] ✅ 專案 {專案名稱} 初始化完成

建立了：
📁 .ai-team/plans/
📁 .ai-team/qa/reports/
📁 .ai-team/presents/
📄 CLAUDE.md
🌿 develop branch

下一步：
告訴我你的需求，我會讓 PM 和 SA 開始規劃。
或者直接輸入：/plan {你的需求描述}
```
