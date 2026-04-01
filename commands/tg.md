# /tg - Telegram 操作

> 用於手動發送 Telegram 訊息，或查詢 inbox。

## 輸入

$ARGUMENTS（例如：`send 規劃完成，等你確認`、`inbox`、`setup`）

---

## 操作說明

### `tg send {訊息}`
透過 Telegram MCP 工具發送訊息給老闆。

呼叫 MCP tool：`telegram_send_message`
- chat_id：從 `.env` 讀取 `TELEGRAM_CHAT_ID`（等級 3 權限，首次需確認）
- text：{訊息內容}

### `tg inbox`
讀取 `.ai-team/telegram-inbox.json`，顯示尚未處理的老闆回覆。

格式：
```
[Telegram 收件匣]
━━━━━━━━━━━━━━━
{時間} {老闆名稱}：{訊息內容}
━━━━━━━━━━━━━━━
共 {N} 則未讀
```

處理後，清除已讀訊息。

### `tg setup`
顯示 Telegram 設定指引（見下方）。

---

## Telegram 雙向整合設定指引

### 需要準備

1. **Telegram Bot Token**（透過 @BotFather 取得）
2. **Chat ID**（你的個人 Chat ID）
3. **MCP Server**：`mcp-telegram`

### 安裝步驟

```bash
# 1. 安裝 Telegram MCP Server
npm install -g mcp-telegram

# 2. 在 Claude Code 設定中加入 MCP Server
# 編輯 ~/.claude/settings.json，在 mcpServers 加入：
{
  "mcpServers": {
    "telegram": {
      "command": "mcp-telegram",
      "env": {
        "TELEGRAM_BOT_TOKEN": "你的 Bot Token"
      }
    }
  }
}

# 3. 在專案 .env 設定 Chat ID（不要 commit）
echo "TELEGRAM_CHAT_ID=你的Chat_ID" >> .env
echo "TELEGRAM_BOT_TOKEN=你的Bot_Token" >> .env
```

### 雙向溝通設定（Webhook Bridge）

為了讓老闆在 Telegram 發的訊息能進入大腦，需要啟動一個輕量的 bridge 服務：

```bash
# 在專案目錄執行
node .ai-team/telegram-bridge.js
```

這個 bridge 會：
1. 監聽 Telegram Bot 的訊息（polling 模式，不需要公開 URL）
2. 把老闆的訊息寫入 `.ai-team/telegram-inbox.json`
3. 大腦在適當時機（Sprint 完成、等待確認時）讀取 inbox

Bridge 腳本由 `/new-project` 自動建立。

### 測試

```bash
# 測試發送
/tg send 這是測試訊息

# 你在 Telegram 回覆後，查看收件匣
/tg inbox
```
