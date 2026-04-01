#!/bin/bash
set -e

# ============================================
# AI 開發團隊 - 一鍵安裝腳本
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"

echo "🧠 AI 開發團隊 - 安裝程式"
echo "=========================="
echo ""

# --- 檢查前置條件 ---
if ! command -v node &> /dev/null; then
  echo "❌ 需要 Node.js，請先安裝：https://nodejs.org/"
  exit 1
fi

if ! command -v claude &> /dev/null; then
  echo "❌ 需要 Claude Code CLI，請先安裝：https://claude.com/claude-code"
  exit 1
fi

echo "✅ Node.js $(node --version)"
echo "✅ Claude Code CLI 已安裝"
echo ""

# --- 建立目錄（最先做，後面都需要）---
mkdir -p "$CLAUDE_DIR/commands"
mkdir -p "$CLAUDE_DIR/templates"

# --- 檢查 .env ---
if [ "$1" != "--update" ]; then
  if [ ! -f "$SCRIPT_DIR/.env" ] && [ ! -f "$CLAUDE_DIR/.env" ]; then
    echo "⚠️  尚未設定環境變數！"
    echo ""
    echo "   請先完成以下步驟："
    echo "   1. cp .env.example .env"
    echo "   2. 編輯 .env，填入 Telegram Bot Token 和 Chat ID"
    echo ""
    echo "   取得方式："
    echo "   • Bot Token → 在 Telegram 找 @BotFather，發 /newbot"
    echo "   • Chat ID  → 對你的 Bot 發任意訊息，然後瀏覽器打開："
    echo "     https://api.telegram.org/bot<你的TOKEN>/getUpdates"
    echo "     找到 \"chat\":{\"id\": 後面的數字"
    echo ""
    read -p "   已完成 .env 設定了嗎？(y/N) " ENV_READY
    if [ "$ENV_READY" != "y" ] && [ "$ENV_READY" != "Y" ]; then
      echo ""
      echo "   請先完成 .env 設定後再執行 ./install.sh"
      exit 0
    fi
  fi
fi

# --- 讀取 .env（從專案或全域）---
BOT_TOKEN=""
CHAT_ID=""
for ENV_FILE in "$SCRIPT_DIR/.env" "$CLAUDE_DIR/.env"; do
  if [ -f "$ENV_FILE" ]; then
    _token=$(grep "^TELEGRAM_BOT_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
    _chatid=$(grep "^TELEGRAM_CHAT_ID=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
    [ -n "$_token" ] && BOT_TOKEN="$_token"
    [ -n "$_chatid" ] && CHAT_ID="$_chatid"
  fi
done

# 同步到 ~/.claude/.env
if [ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ]; then
  cat > "$CLAUDE_DIR/.env" << EOF
TELEGRAM_BOT_TOKEN=$BOT_TOKEN
TELEGRAM_CHAT_ID=$CHAT_ID
EOF
fi

# --- 複製 Skills ---
echo "📦 安裝 Skills..."
cp "$SCRIPT_DIR/commands/"*.md "$CLAUDE_DIR/commands/"
SKILL_COUNT=$(ls "$SCRIPT_DIR/commands/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo "   ✅ ${SKILL_COUNT} 個 Skills 已安裝到 ~/.claude/commands/"

# --- 複製 Templates ---
echo "📦 安裝 Templates..."
cp "$SCRIPT_DIR/templates/telegram-bridge.js" "$CLAUDE_DIR/templates/"
cp "$SCRIPT_DIR/templates/telegram-mcp-server.js" "$CLAUDE_DIR/templates/"
cp "$SCRIPT_DIR/templates/project-CLAUDE.md" "$CLAUDE_DIR/templates/"
echo "   ✅ Templates 已安裝到 ~/.claude/templates/"

# --- 全域 CLAUDE.md ---
if [ ! -f "$CLAUDE_DIR/CLAUDE.md" ]; then
  cp "$SCRIPT_DIR/global-CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md"
  echo "   ✅ 全域 CLAUDE.md 已建立"
else
  echo "   ⏭️  ~/.claude/CLAUDE.md 已存在，跳過（如需更新請手動替換）"
fi

# --- Telegram 設定 ---
echo ""
echo "📱 Telegram 設定..."
if [ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ]; then
  echo "   ✅ Token: ${BOT_TOKEN:0:10}..."
  echo "   ✅ Chat ID: $CHAT_ID"
else
  echo "   ⚠️  .env 中缺少 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID"
  echo "   Telegram 功能將無法使用，請補齊 .env 後重新執行 ./install.sh"
fi

# --- 設定 MCP Server ---
echo ""
echo "🔧 設定 MCP Server..."
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
  node -e "
    const fs = require('fs');
    const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf-8'));
    if (!settings.mcpServers) settings.mcpServers = {};
    settings.mcpServers.telegram = {
      command: 'node',
      args: ['$CLAUDE_DIR/templates/telegram-mcp-server.js'],
      env: {
        TELEGRAM_BOT_TOKEN: '${BOT_TOKEN:-}',
        TELEGRAM_CHAT_ID: '${CHAT_ID:-}'
      }
    };
    fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2));
  " 2>/dev/null && echo "   ✅ MCP Server 已加入 settings.json" || echo "   ⚠️  無法更新 settings.json，請手動設定"
else
  cat > "$SETTINGS_FILE" << EOF
{
  "mcpServers": {
    "telegram": {
      "command": "node",
      "args": ["$CLAUDE_DIR/templates/telegram-mcp-server.js"],
      "env": {
        "TELEGRAM_BOT_TOKEN": "${BOT_TOKEN:-}",
        "TELEGRAM_CHAT_ID": "${CHAT_ID:-}"
      }
    }
  }
}
EOF
  echo "   ✅ settings.json 已建立"
fi

# --- 更新模式：到這裡就完成 ---
if [ "$1" = "--update" ]; then
  echo ""
  echo "✅ 更新完成！Skills、Templates、MCP Server 已是最新版本。"
  echo "   重啟 BrainBridge app 即可生效。"
  exit 0
fi

# --- BrainBridge Electron App（自動安裝）---
echo ""
echo "🖥️  安裝 BrainBridge 選單列 App..."

# 複製 brain-bridge 原始碼到 ~/.claude/
rm -rf "$CLAUDE_DIR/brain-bridge" 2>/dev/null
cp -R "$SCRIPT_DIR/brain-bridge" "$CLAUDE_DIR/brain-bridge"

cd "$CLAUDE_DIR/brain-bridge"
echo "   正在安裝依賴..."
npm install --silent 2>&1 | tail -1

echo "   正在打包..."
ELECTRON_RUN_AS_NODE= npx electron-builder --mac --dir 2>&1 | tail -3

APP_INSTALLED=false
for APP_DIR in "dist/mac-arm64" "dist/mac"; do
  if [ -d "$APP_DIR/BrainBridge.app" ]; then
    rm -rf /Applications/BrainBridge.app 2>/dev/null
    cp -R "$APP_DIR/BrainBridge.app" /Applications/
    xattr -cr /Applications/BrainBridge.app 2>/dev/null
    echo "   ✅ BrainBridge.app 已安裝到 /Applications/"
    APP_INSTALLED=true
    break
  fi
done

if [ "$APP_INSTALLED" = false ]; then
  echo "   ⚠️  打包失敗，可稍後手動執行："
  echo "   cd ~/.claude/brain-bridge && npm install && npm run build"
fi

cd "$SCRIPT_DIR"

# --- 完成 ---
echo ""
echo "============================================"
echo "🎉 安裝完成！"
echo "============================================"
echo ""
echo "📋 已安裝："
echo "   • ${SKILL_COUNT} 個 Skills"
echo "   • Telegram Bridge + MCP Server"
echo "   • 全域團隊規則"
if [ "$APP_INSTALLED" = true ]; then
  echo "   • BrainBridge 選單列 App"
fi
echo ""
echo "🚀 開始使用："
echo ""
echo "   方式 1：Claude Code"
echo "   cd your-project && claude"
echo "   > /new-project my-project"
echo "   > /plan 我要做一個支付系統"
echo ""
echo "   方式 2：Telegram"
if [ "$APP_INSTALLED" = true ]; then
  echo "   打開 BrainBridge.app → 按啟動 → 在 Telegram 操作"
else
  echo "   node ~/.claude/templates/telegram-bridge.js --project /path/to/project"
fi
echo ""
echo "📖 詳細說明請見 README.md"
