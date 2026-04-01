# /status - 查詢專案目前狀態

> 任何時間都可以呼叫，讓大腦彙整當前狀況。

## 輸入

$ARGUMENTS（可選：`detail`、`sprint 1` 等）

---

## 執行流程

讀取以下來源彙整狀態：

1. `CLAUDE.md`（專案基本資訊）
2. `.ai-team/plans/`（規劃文件）
3. `.ai-team/qa/reports/`（QA 報告）
4. `git log --oneline -20`（最近 commit）
5. `git branch -a`（目前所有 branch）

輸出以下格式：

```
[大腦] 📊 專案狀態報告
━━━━━━━━━━━━━━━━━━━━

專案：{專案名稱}
目前版本：{版本或 Sprint 進度}
整體狀態：{一行描述}

━━━ Sprint 狀態 ━━━

Sprint 1  ✅ 完成（QA 通過）
Sprint 2  ⚙️  開發中
  └─ BACKEND  ✅ 完成 / merge 到 develop
  └─ FRONTEND ⏳ 進行中
  └─ DBA      ✅ 完成 / merge 到 develop
Sprint 3  📋 規劃中（PM 草稿）

━━━ 目前開放的 Branch ━━━
{git branch 列表}

━━━ 最近 QA 狀態 ━━━
Sprint 1 QA：✅ 全部通過（2026-04-01）
Sprint 2 QA：尚未開始

━━━ 待決事項（需要你確認）━━━
{若有等待老闆決策的事項，列在這裡}
{若無：「目前無待決事項，系統自動推進中」}

━━━━━━━━━━━━━━━━━━━━
```

若 $ARGUMENTS 包含 `detail` 或特定 Sprint，輸出更詳細的任務清單。
