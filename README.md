# AI Dev Team

> 基於 Claude Code 的多代理 AI 開發團隊系統。你當老闆，大腦協調，PM/SA/Backend/Frontend/DBA/QA 並行工作。

## 特色

- **一人指揮，多代理並行** — PM + SA 同時規劃，Backend + Frontend + DBA 同時開發
- **Telegram 雙向溝通** — 手機上就能下指令、收報告、做決策
- **Git Flow 規範** — 各代理在獨立 branch 工作，大腦 review 後 merge
- **敏捷開發** — Sprint 自動迭代，QA 和下一 Sprint 可同時進行
- **macOS 選單列 App** — BrainBridge 一鍵啟停 Bridge

## 快速開始

```bash
git clone https://github.com/mike504110403/self-ai-team.git
cd self-ai-team
./install.sh
```

安裝腳本會引導你完成：
1. 複製 Skills 和 Templates 到 `~/.claude/`
2. 設定 Telegram Bot Token 和 Chat ID
3. （可選）安裝 BrainBridge 選單列 App

### 前置需求

- [Node.js](https://nodejs.org/) v20+
- [Claude Code CLI](https://claude.com/claude-code)
- Telegram Bot（跟 [@BotFather](https://t.me/BotFather) 建立）

## 使用方式

### 方式 1：Claude Code 介面

```bash
cd your-project
claude
> /new-project my-project       # 初始化 AI 團隊設定
> /plan 我要做一個支付系統        # PM + SA 並行規劃
# 等待 present → 確認後
> /sprint 1                     # 啟動開發
> /qa 1                         # QA 測試
> /status                       # 查看進度
```

### 方式 2：Telegram

啟動 Bridge 後，在 Telegram 直接操作：

```
/help                           → 指令列表
/plan 做一個直播系統              → 啟動規劃
/sprint 1                       → 開始 Sprint
/qa 1                           → QA 測試
/parallel /qa 1 | /sprint 2    → QA 和下一 Sprint 同時跑
/status                         → 進度
/tasks                          → 執行中的任務
/timeout 20                     → 設定下一個任務超時（分鐘）
/reset                          → 清除對話記憶
```

### 方式 3：BrainBridge App

打開 `/Applications/BrainBridge.app`，在 macOS 選單列操作：
- 左鍵：狀態面板（專案切換、日誌、啟停）
- 右鍵：快速選單

## 團隊結構

| 角色 | 代號 | 職責 |
|------|------|------|
| 老闆 | BOSS | 你。提需求、做決策 |
| 大腦 | BRAIN | 協調者，分派任務、仲裁衝突 |
| PM | PM | 需求規格、User Stories、Sprint 規劃 |
| SA | SA | 技術架構、API 設計、技術棧 |
| Backend | BACKEND | API 實作、商業邏輯 |
| Frontend | FRONTEND | UI 元件、頁面 |
| DBA | DBA | Schema 設計、Migration |
| QA | QA | 測試計畫、測試程式碼 |

## 工作流程

```
你提需求 → 大腦分析
  → PM + SA 並行規劃（worktree 隔離）
  → Present 給你確認
  → 你確認後 → SA 定義介面合約
  → Backend + Frontend + DBA 並行開發（worktree 隔離）
  → 大腦 review + merge 到 develop
  → QA 測試（同時 PM 規劃下一 Sprint）
  → QA 通過 → release → 通知你
```

## 檔案結構

安裝後的位置：

```
~/.claude/
├── CLAUDE.md                    ← 全域團隊規則
├── .env                         ← Telegram Token + Chat ID
├── settings.json                ← MCP server 設定
├── commands/                    ← 8 個 Skills
│   ├── brain.md                 ← 大腦（主協調者）
│   ├── plan.md                  ← PM + SA 規劃流程
│   ├── sprint.md                ← Sprint 開發週期
│   ├── qa.md                    ← QA 測試流程
│   ├── status.md                ← 進度查詢
│   ├── ask-boss.md              ← 代理向老闆請示
│   ├── new-project.md           ← 初始化新專案
│   └── tg.md                    ← Telegram 操作
├── templates/
│   ├── telegram-bridge.js       ← Telegram 雙向 Bridge
│   ├── telegram-mcp-server.js   ← MCP Server
│   └── project-CLAUDE.md        ← 新專案模板
└── brain-bridge/                ← Electron menubar app
```

每個專案會有：

```
your-project/
├── CLAUDE.md                    ← 專案設定
└── .ai-team/
    ├── plans/                   ← 需求、架構、Sprint 計畫
    ├── qa/reports/              ← 測試報告
    └── presents/                ← 給老闆的 present
```

## 客製化

### 修改團隊規則
編輯 `~/.claude/CLAUDE.md`：角色定義、權限閘門、Git Flow 規範

### 修改 Skill 行為
編輯 `~/.claude/commands/*.md`：各代理的行為邏輯

### 修改專案設定
編輯各專案的 `CLAUDE.md`：技術棧、編碼規範、代理注意事項

## 更新

```bash
cd self-ai-team
git pull
./install.sh --update
```

## 權限閘門

| 等級 | 行為 | 範例 |
|------|------|------|
| 1 - 自動 | 讀寫專案檔案、git commit、跑測試 | 不打擾你 |
| 2 - 告知 | git push、安裝套件 | 告訴你後執行 |
| 3 - 必須確認 | 付費 API、.env、部署、DB migration | 必須等你說 OK |

## License

MIT
