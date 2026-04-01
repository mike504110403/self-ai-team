#!/usr/bin/env node
/**
 * Telegram MCP Server - 輕量版
 *
 * 提供 Claude Code 直接操作 Telegram 的 MCP 工具：
 * - telegram_send：發送訊息
 * - telegram_send_buttons：發送帶按鈕的訊息
 * - telegram_inbox：讀取老闆回覆
 * - telegram_poll_reply：等待老闆回覆（阻塞式，適合需要確認的場景）
 *
 * 啟動方式：TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=xxx node telegram-mcp-server.js
 */

const https = require('https');
const { stdin, stdout } = require('process');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  process.stderr.write('[TG-MCP] 缺少 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID\n');
  process.exit(1);
}

let lastUpdateId = 0;

// --- Telegram API helpers ---

function telegramAPI(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function sendMessage(text, buttons) {
  const body = { chat_id: CHAT_ID, text, parse_mode: 'Markdown' };
  if (buttons && buttons.length > 0) {
    body.reply_markup = {
      inline_keyboard: buttons.map(row =>
        row.map(btn => ({ text: btn.text, callback_data: btn.data || btn.text }))
      )
    };
  }
  return telegramAPI('sendMessage', body);
}

async function getUpdates(timeout = 0) {
  const body = { offset: lastUpdateId + 1, timeout, allowed_updates: ['message', 'callback_query'] };
  const result = await telegramAPI('getUpdates', body);
  if (result.ok && result.result.length > 0) {
    for (const u of result.result) {
      if (u.update_id > lastUpdateId) lastUpdateId = u.update_id;
    }
  }
  return result;
}

// --- MCP Protocol over stdio ---

let buffer = '';

function sendMCPResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n';
  stdout.write(msg);
}

function sendMCPError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n';
  stdout.write(msg);
}

function sendMCPNotification(method, params) {
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
  stdout.write(msg);
}

const TOOLS = [
  {
    name: 'telegram_send',
    description: '發送 Telegram 訊息給老闆',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '訊息內容（支援 Markdown）' }
      },
      required: ['text']
    }
  },
  {
    name: 'telegram_send_buttons',
    description: '發送帶按鈕的 Telegram 訊息，用於需要老闆確認的場景',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '訊息內容' },
        buttons: {
          type: 'array',
          description: '按鈕列，每個元素是一行，每行是 [{text, data}] 陣列',
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                data: { type: 'string' }
              },
              required: ['text']
            }
          }
        }
      },
      required: ['text', 'buttons']
    }
  },
  {
    name: 'telegram_inbox',
    description: '讀取老闆最近的 Telegram 回覆（非阻塞）',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'telegram_poll_reply',
    description: '等待老闆的 Telegram 回覆（阻塞式，最多等 120 秒）',
    inputSchema: {
      type: 'object',
      properties: {
        timeout: { type: 'number', description: '等待秒數（預設 120）', default: 120 }
      },
      required: []
    }
  }
];

async function handleToolCall(name, args) {
  switch (name) {
    case 'telegram_send': {
      const res = await sendMessage(args.text);
      return res.ok
        ? { content: [{ type: 'text', text: `已發送訊息給老闆` }] }
        : { content: [{ type: 'text', text: `發送失敗：${JSON.stringify(res)}` }], isError: true };
    }

    case 'telegram_send_buttons': {
      const res = await sendMessage(args.text, args.buttons);
      return res.ok
        ? { content: [{ type: 'text', text: `已發送帶按鈕訊息給老闆` }] }
        : { content: [{ type: 'text', text: `發送失敗：${JSON.stringify(res)}` }], isError: true };
    }

    case 'telegram_inbox': {
      const res = await getUpdates(0);
      if (!res.ok) return { content: [{ type: 'text', text: '取得更新失敗' }], isError: true };
      const messages = res.result
        .map(u => {
          if (u.message && String(u.message.chat.id) === String(CHAT_ID)) {
            return { type: 'message', text: u.message.text, time: new Date(u.message.date * 1000).toISOString() };
          }
          if (u.callback_query && String(u.callback_query.from.id) === String(CHAT_ID)) {
            // 回覆 callback query 讓按鈕停止 loading
            telegramAPI('answerCallbackQuery', { callback_query_id: u.callback_query.id });
            return { type: 'button', text: u.callback_query.data, time: new Date().toISOString() };
          }
          return null;
        })
        .filter(Boolean);
      return {
        content: [{
          type: 'text',
          text: messages.length > 0
            ? `收到 ${messages.length} 則回覆：\n${messages.map(m => `[${m.type}] ${m.time}: ${m.text}`).join('\n')}`
            : '目前沒有新訊息'
        }]
      };
    }

    case 'telegram_poll_reply': {
      const timeout = args.timeout || 120;
      const res = await getUpdates(timeout);
      if (!res.ok) return { content: [{ type: 'text', text: '等待超時或失敗' }], isError: true };
      const replies = res.result
        .map(u => {
          if (u.message && String(u.message.chat.id) === String(CHAT_ID)) {
            return u.message.text;
          }
          if (u.callback_query && String(u.callback_query.from.id) === String(CHAT_ID)) {
            telegramAPI('answerCallbackQuery', { callback_query_id: u.callback_query.id });
            return `[按鈕] ${u.callback_query.data}`;
          }
          return null;
        })
        .filter(Boolean);
      return {
        content: [{
          type: 'text',
          text: replies.length > 0
            ? `老闆回覆：${replies.join('; ')}`
            : '等待超時，老闆未回覆'
        }]
      };
    }

    default:
      return { content: [{ type: 'text', text: `未知工具：${name}` }], isError: true };
  }
}

async function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      sendMCPResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'telegram-mcp', version: '1.0.0' }
      });
      break;

    case 'notifications/initialized':
      // no response needed
      break;

    case 'tools/list':
      sendMCPResponse(id, { tools: TOOLS });
      break;

    case 'tools/call': {
      try {
        const result = await handleToolCall(params.name, params.arguments || {});
        sendMCPResponse(id, result);
      } catch (e) {
        sendMCPError(id, -32000, e.message);
      }
      break;
    }

    default:
      if (id) sendMCPError(id, -32601, `Method not found: ${method}`);
      break;
  }
}

// Read JSON-RPC from stdin
stdin.setEncoding('utf-8');
stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop(); // keep incomplete line
  for (const line of lines) {
    if (line.trim()) {
      try {
        handleMessage(JSON.parse(line));
      } catch (e) {
        process.stderr.write(`[TG-MCP] Parse error: ${e.message}\n`);
      }
    }
  }
});

process.stderr.write('[TG-MCP] Telegram MCP Server 啟動\n');
