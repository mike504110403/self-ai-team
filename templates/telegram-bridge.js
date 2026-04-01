#!/usr/bin/env node
/**
 * Telegram Bridge - 雙向溝通 + 多進程並行管理
 *
 * 功能：
 * 1. 持續監聽 Telegram 訊息（long polling）
 * 2. 收到訊息後，在指定專案目錄執行 `claude -p "..."` CLI
 * 3. 支援多專案切換（/use 指令）
 * 4. 支援同時管理多個並行任務（QA + 下一 Sprint 等）
 * 5. 任務完成後將結果發回 Telegram
 *
 * 使用方式（不需要綁定專案）：
 *   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=xxx \
 *   node ~/.claude/templates/telegram-bridge.js
 *
 * 或指定初始專案：
 *   node ~/.claude/templates/telegram-bridge.js --project /path/to/project
 *
 * 背景啟動：
 *   nohup node ~/.claude/templates/telegram-bridge.js > ~/.claude/bridge.log 2>&1 &
 */

const https = require('https');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// --- 讀取 .env（若有）---
function loadEnv(dir) {
  const envPath = path.join(dir, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([^#=\s]+)\s*=\s*(.+)$/);
    if (match) {
      const [, key, val] = match;
      if (!process.env[key]) process.env[key] = val.trim();
    }
  }
}

// --- 多專案管理 ---
const PROJECTS_FILE = path.join(os.homedir(), '.claude', 'bridge-projects.json');

function loadProjects() {
  try { return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8')); }
  catch { return { current: null, registered: {} }; }
}

function saveProjects(data) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
}

// 初始化：從 --project 參數或已儲存的狀態
let projectState = loadProjects();

const initProject = (() => {
  const idx = process.argv.indexOf('--project');
  if (idx !== -1 && process.argv[idx + 1]) return path.resolve(process.argv[idx + 1]);
  return projectState.current || null;
})();

// 載入初始專案的 .env（取得 bot token）
if (initProject) loadEnv(initProject);
// 也嘗試從 ~/.claude/ 目錄載入
loadEnv(path.join(os.homedir(), '.claude'));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || '');

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('[Bridge] 缺少 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID');
  console.error('[Bridge] 設定方式：');
  console.error('  1. 環境變數：TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=xxx');
  console.error('  2. 專案 .env 檔案');
  console.error('  3. ~/.claude/.env 檔案');
  process.exit(1);
}

// 設定初始專案
let currentProjectDir = initProject;
if (currentProjectDir) {
  projectState.current = currentProjectDir;
  const name = path.basename(currentProjectDir);
  projectState.registered[name] = currentProjectDir;
  saveProjects(projectState);
}

console.log(`[Bridge] 啟動中...`);
console.log(`[Bridge] 目前專案：${currentProjectDir || '未設定（請用 /use 指定）'}`);


// --- 任務管理 ---
const runningTasks = new Map(); // taskId -> { proc, startTime, description }
let taskIdCounter = 1;

// --- Telegram API ---
function telegramRequest(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function sendMessage(text, buttons, replyToMessageId) {
  // 自動分段（Telegram 最大 4096 字元）
  const limit = 3800;
  const chunks = [];
  for (let i = 0; i < text.length; i += limit) chunks.push(text.slice(i, i + limit));

  let lastSentMsgId = null;

  for (let i = 0; i < chunks.length; i++) {
    const replyMarkup = (buttons && i === chunks.length - 1) ? {
      inline_keyboard: buttons.map(row =>
        row.map(btn => ({ text: btn.text, callback_data: (btn.data || btn.text).slice(0, 64) }))
      )
    } : undefined;

    // 只有第一段 reply 原始訊息，後續段不 reply
    const replyId = (i === 0 && replyToMessageId) ? replyToMessageId : undefined;

    const baseBody = {
      chat_id: CHAT_ID, text: chunks[i],
      ...(replyId && { reply_to_message_id: replyId }),
      ...(replyMarkup && { reply_markup: replyMarkup })
    };

    // 嘗試順序：Markdown → 純文字（三次機會確保一定送達）
    let sent = false;

    // 嘗試 1：Markdown
    try {
      const res = await telegramRequest('sendMessage', { ...baseBody, parse_mode: 'Markdown' });
      if (res.ok) { lastSentMsgId = res.result.message_id; sent = true; continue; }
    } catch {}

    // 嘗試 2：不帶 parse_mode（純文字）
    if (!sent) {
      try {
        const res = await telegramRequest('sendMessage', baseBody);
        if (res.ok) { lastSentMsgId = res.result.message_id; sent = true; continue; }
      } catch {}
    }

    // 嘗試 3：清理特殊字元後重試
    if (!sent) {
      try {
        const cleaned = chunks[i]
          .replace(/[*_`\[\]()~>#+\-=|{}.!]/g, '')
          .slice(0, 4000);
        const res = await telegramRequest('sendMessage', {
          ...baseBody, text: cleaned || '(訊息格式有誤，請查看 Bridge Log)'
        });
        if (res.ok) lastSentMsgId = res.result.message_id;
      } catch (e) {
        console.error(`[Bridge] sendMessage 最終失敗（chunk ${i+1}/${chunks.length}）：`, e.message);
      }
    }
  }

  return lastSentMsgId;
}

async function answerCallbackQuery(id) {
  try { await telegramRequest('answerCallbackQuery', { callback_query_id: id, text: '收到' }); }
  catch (e) { /* ignore */ }
}

// --- Claude CLI 執行 ---
// --- 動態超時設定 ---
const TIMEOUT_MAP = {
  '/plan':   10 * 60 * 1000,  // 10 分鐘（PM + SA 並行）
  '/sprint': 15 * 60 * 1000,  // 15 分鐘（三代理並行開發）
  '/qa':     10 * 60 * 1000,  // 10 分鐘
  '/brain':   5 * 60 * 1000,  // 5 分鐘
  default:    5 * 60 * 1000,  // 5 分鐘
};
const IDLE_TIMEOUT_MS = 90 * 1000;
const PROGRESS_INTERVAL_MS = 2 * 60 * 1000; // 每 2 分鐘通知進度
let nextTimeoutOverride = null; // /timeout 指令臨時覆蓋

function getTimeoutForPrompt(prompt) {
  if (nextTimeoutOverride) {
    const t = nextTimeoutOverride;
    nextTimeoutOverride = null;
    return t;
  }
  for (const [prefix, ms] of Object.entries(TIMEOUT_MAP)) {
    if (prefix !== 'default' && prompt.startsWith(prefix)) return ms;
  }
  return TIMEOUT_MAP.default;
}

// --- Session 管理（上下文持久化）---
const SESSIONS_FILE = path.join(os.homedir(), '.claude', 'bridge-sessions.json');

function loadSessions() {
  try { return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')); }
  catch { return {}; }
}

function saveSessions(data) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
}

function getSessionId() {
  const projectName = currentProjectDir ? path.basename(currentProjectDir) : 'default';
  const sessions = loadSessions();
  return sessions[projectName]?.sessionId || null;
}

function saveSessionId(sessionId) {
  const projectName = currentProjectDir ? path.basename(currentProjectDir) : 'default';
  const sessions = loadSessions();
  if (!sessions[projectName]) sessions[projectName] = {};
  sessions[projectName].sessionId = sessionId;
  sessions[projectName].updatedAt = new Date().toISOString();
  saveSessions(sessions);
}

function clearSession() {
  const projectName = currentProjectDir ? path.basename(currentProjectDir) : 'default';
  const sessions = loadSessions();
  delete sessions[projectName];
  saveSessions(sessions);
}

function runClaudeTask(description, prompt, options = {}) {
  const taskId = taskIdCounter++;
  const startTime = new Date();
  const timeoutMs = getTimeoutForPrompt(prompt);

  return new Promise((resolve) => {
    console.log(`\n[Bridge] ▶ 任務 #${taskId}：${description}（超時 ${Math.round(timeoutMs/60000)}m）`);

    const args = ['--print', '--dangerously-skip-permissions'];
    if (options.model) args.push('--model', options.model);

    // Session resume：同專案同 Sprint 內保持上下文
    const sessionId = getSessionId();
    if (sessionId && !options.noResume) {
      args.push('--resume', sessionId);
    }

    args.push(prompt);

    const proc = spawn('claude', args, {
      cwd: options.cwd || currentProjectDir || os.homedir(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    runningTasks.set(taskId, { proc, startTime, description });

    let stdout = '';
    let stderr = '';
    let lastActivity = Date.now();
    let resolved = false;

    function finish(code, reason) {
      if (resolved) return;
      resolved = true;
      clearInterval(watchdog);
      clearInterval(progressTimer);
      clearTimeout(hardTimeout);
      runningTasks.delete(taskId);
      const dur = Math.round((Date.now() - startTime.getTime()) / 1000);
      const suffix = reason ? ` [${reason}]` : '';
      console.log(`[Bridge] ■ 任務 #${taskId} 完成（${dur}s, exit ${code}${suffix}）`);

      // 嘗試從 stderr 擷取 session ID（claude CLI 會輸出）
      const sidMatch = stderr.match(/session[:\s]+([a-f0-9-]{36})/i) || stderr.match(/resuming[:\s]+([a-f0-9-]{36})/i);
      if (sidMatch) saveSessionId(sidMatch[1]);

      resolve({ taskId, description, success: code === 0, output: stdout.trim(), error: stderr.trim(), duration: dur });
    }

    // 硬超時
    const hardTimeout = setTimeout(() => {
      if (!resolved) {
        console.log(`[Bridge] ⏰ 任務 #${taskId} 硬超時（${Math.round(timeoutMs/60000)}m），強制中止`);
        sendMessage(`[BRAIN] ⏰ 任務超時（${Math.round(timeoutMs/60000)}分鐘），已中止\n> ${description.slice(0, 50)}\n\n部分結果：\n${stdout.slice(-500) || '(無)'}`).catch(() => {});
        proc.kill('SIGKILL');
        finish(-1, '超時');
      }
    }, timeoutMs);

    // 心跳偵測：90 秒無新輸出（只寫 log，不發 Telegram）
    const watchdog = setInterval(() => {
      const idle = Date.now() - lastActivity;
      if (idle > IDLE_TIMEOUT_MS && !resolved) {
        const idleSec = Math.round(idle / 1000);
        console.log(`[Bridge] ⚠ 任務 #${taskId} 已 ${idleSec}s 無輸出`);
        lastActivity = Date.now();
      }
    }, 30000);

    // 進度通知：每 2 分鐘告訴老闆還在跑
    const progressTimer = setInterval(() => {
      if (!resolved) {
        const elapsed = Math.round((Date.now() - startTime.getTime()) / 60000);
        sendMessage(`[BRAIN] ⏳ 任務 #${taskId} 執行中（${elapsed}分鐘）...`).catch(() => {});
      }
    }, PROGRESS_INTERVAL_MS);

    proc.stdout.on('data', d => { lastActivity = Date.now(); stdout += d.toString(); process.stdout.write(d); });
    proc.stderr.on('data', d => { lastActivity = Date.now(); stderr += d.toString(); });

    proc.on('close', (code) => finish(code));

    proc.on('error', (err) => {
      console.error(`[Bridge] 任務 #${taskId} 錯誤：`, err.message);
      finish(-1, err.message);
    });
  });
}

// --- 訊息處理 ---
// 防止同一訊息被重複處理
const processingSet = new Set();

async function handleMessage(text, messageId, replyContext) {
  const trimmed = text.trim();
  if (!trimmed) return;

  // 如果老闆是 reply 某則訊息，把被 reply 的內容當作上下文
  const contextPrefix = replyContext
    ? `（老闆回覆了之前的訊息「${replyContext.slice(0, 200)}」）\n`
    : '';

  // 內建指令
  if (trimmed === '/start' || trimmed === '/help') {
    const proj = currentProjectDir ? path.basename(currentProjectDir) : '未設定';
    await sendMessage(
      `[BRAIN] 🤖 *AI 開發團隊*\n` +
      `目前專案：\`${proj}\`\n\n` +
      `*專案管理*\n` +
      `/use {路徑或名稱} - 切換專案\n` +
      `/projects - 已註冊的專案列表\n` +
      `/new {名稱} {路徑} - 初始化新專案\n\n` +
      `*開發流程*\n` +
      `/plan {需求} - 啟動 PM + SA 規劃\n` +
      `/sprint {N} - 啟動第 N 個 Sprint\n` +
      `/qa {N} - QA 測試 Sprint N\n` +
      `/status - 專案進度\n\n` +
      `*任務管理*\n` +
      `/tasks - 執行中的任務\n` +
      `/stop {id} - 中止任務\n` +
      `/parallel {cmd1} | {cmd2} - 並行執行\n` +
      `/timeout {分鐘} - 設定下一個任務的超時\n` +
      `/reset - 清除對話記憶，重新開始\n\n` +
      `直接傳訊息 → 大腦處理`
    );
    return;
  }

  // --- 超時與 Session 指令 ---
  if (trimmed.startsWith('/timeout ')) {
    const mins = parseInt(trimmed.slice(9));
    if (mins > 0 && mins <= 60) {
      nextTimeoutOverride = mins * 60 * 1000;
      await sendMessage(`[BRAIN] ⏱ 下一個任務超時設為 ${mins} 分鐘`);
    } else {
      await sendMessage(`[BRAIN] 請輸入 1-60 之間的分鐘數`);
    }
    return;
  }

  if (trimmed === '/reset') {
    clearSession();
    await sendMessage(`[BRAIN] 🔄 對話記憶已清除，下次指令將開始全新對話`);
    return;
  }

  // --- 專案管理指令 ---
  if (trimmed.startsWith('/use ')) {
    const target = trimmed.slice(5).trim();
    // 嘗試直接路徑
    let resolved = path.resolve(target);
    // 如果不是絕對路徑，從已註冊的專案中找
    if (!fs.existsSync(resolved) && projectState.registered[target]) {
      resolved = projectState.registered[target];
    }
    if (fs.existsSync(resolved)) {
      currentProjectDir = resolved;
      const name = path.basename(resolved);
      projectState.current = resolved;
      projectState.registered[name] = resolved;
      saveProjects(projectState);
      await sendMessage(`[BRAIN] 📁 已切換到專案：\`${name}\`\n路徑：\`${resolved}\``);
    } else {
      await sendMessage(`[BRAIN] ❌ 找不到路徑：\`${target}\`\n請用絕對路徑或已註冊的專案名稱`);
    }
    return;
  }

  if (trimmed === '/projects') {
    const entries = Object.entries(projectState.registered);
    if (entries.length === 0) {
      await sendMessage('[BRAIN] 還沒有註冊任何專案。\n用 `/use /path/to/project` 註冊');
    } else {
      const curr = currentProjectDir;
      const list = entries.map(([name, p]) => `${p === curr ? '→ ' : '  '}\`${name}\` → \`${p}\``).join('\n');
      await sendMessage(`[BRAIN] 📁 *已註冊專案*\n${list}\n\n用 \`/use 名稱\` 切換`);
    }
    return;
  }

  if (trimmed.startsWith('/new ')) {
    const parts = trimmed.slice(5).trim().split(/\s+/);
    const name = parts[0];
    const dir = parts[1] ? path.resolve(parts[1]) : path.join(os.homedir(), 'Documents', 'self', name);
    if (!name) {
      await sendMessage('[BRAIN] 請指定專案名稱：`/new my-project /path/to/dir`');
      return;
    }
    // 建立目錄（若不存在）
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    currentProjectDir = dir;
    projectState.current = dir;
    projectState.registered[name] = dir;
    saveProjects(projectState);
    // 用 claude CLI 執行 /new-project
    await sendMessage(`[BRAIN] 🏗 初始化專案 \`${name}\` 中...\n路徑：\`${dir}\``);
    const result = await runClaudeTask(`new-project ${name}`, `/new-project ${name}`);
    if (result.success) {
      await sendMessage(`[BRAIN] ✅ 專案 \`${name}\` 初始化完成！\n\n下一步：\n\`/plan 你的需求描述\``);
    } else {
      await sendMessage(`[BRAIN] ❌ 初始化失敗：${result.error.slice(0, 300)}`);
    }
    return;
  }

  if (trimmed === '/tasks') {
    if (runningTasks.size === 0) {
      await sendMessage('[BRAIN] 目前沒有執行中的任務。');
    } else {
      const list = [...runningTasks.entries()]
        .map(([id, t]) => {
          const dur = Math.round((Date.now() - t.startTime.getTime()) / 1000);
          return `#${id}（已執行 ${dur}s）：${t.description}`;
        }).join('\n');
      await sendMessage(`[BRAIN] ⚡ 執行中的任務：\n${list}`);
    }
    return;
  }

  if (trimmed.startsWith('/stop ')) {
    const id = parseInt(trimmed.slice(6));
    const task = runningTasks.get(id);
    if (task) {
      task.proc.kill('SIGTERM');
      runningTasks.delete(id);
      await sendMessage(`[BRAIN] ⏹ 任務 #${id}（${task.description}）已中止。`);
    } else {
      await sendMessage(`[BRAIN] 找不到任務 #${id}。`);
    }
    return;
  }

  // 映射到 Claude skill 並加上大腦的角色 context
  let prompt;
  let ack;

  if (trimmed.startsWith('/plan ')) {
    prompt = trimmed;
    ack = `[BRAIN] 📋 收到規劃需求，啟動 PM + SA...\n> ${trimmed.slice(6)}`;
  } else if (trimmed.match(/^\/sprint\b/)) {
    // 新 Sprint → 自動重置 session
    clearSession();
    prompt = trimmed;
    ack = `[BRAIN] 🚀 啟動 Sprint ${trimmed.slice(8).trim()}...（對話記憶已重置）`;
  } else if (trimmed.match(/^\/qa\b/)) {
    prompt = trimmed;
    ack = `[BRAIN] 🔍 啟動 QA 測試 Sprint ${trimmed.slice(4).trim()}...`;
  } else if (trimmed === '/status') {
    prompt = '/status';
    ack = `[BRAIN] 📊 查詢進度中...`;
  } else {
    // 純文字 → 大腦直接處理
    prompt = `/brain ${trimmed}`;
    ack = `[BRAIN] 收到，思考中...`;
  }

  const ackMsgId = await sendMessage(ack, null, messageId);

  // 如果有 reply context，把它加到 prompt 裡讓大腦知道
  const fullPrompt = contextPrefix ? `${contextPrefix}${prompt}` : prompt;

  const result = await runClaudeTask(trimmed.slice(0, 60), fullPrompt);

  if (result.success && result.output) {
    await sendMessage(result.output, null, messageId);
  } else if (!result.success) {
    const errMsg = result.error || '未知錯誤';
    await sendMessage(
      `[BRAIN] ❌ 執行失敗（${result.duration}s）\n\`\`\`\n${errMsg.slice(0, 800)}\n\`\`\``,
      null, messageId
    );
  }
}

// --- 並行任務輔助（供大腦在 sprint 後觸發）---
// 可以從 Telegram 發送：/parallel qa 1 | sprint 2
// 這會同時執行 /qa 1 和 /sprint 2
async function handleParallel(text) {
  const parts = text.replace('/parallel ', '').split('|').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    await sendMessage('[BRAIN] /parallel 需要至少兩個指令，用 | 分隔\n例如：`/parallel /qa 1 | /sprint 2`');
    return;
  }

  await sendMessage(`[BRAIN] ⚡ 並行啟動 ${parts.length} 個任務：\n${parts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`);

  const results = await Promise.all(
    parts.map(p => runClaudeTask(p.slice(0, 40), p))
  );

  for (const r of results) {
    if (r.success && r.output) await sendMessage(r.output);
    else await sendMessage(`[BRAIN] ❌ \`${r.description}\` 失敗：${r.error.slice(0, 200)}`);
  }
}

// --- Long Polling ---
let lastUpdateId = 0;

async function poll() {
  console.log('[Bridge] 開始監聽 Telegram 訊息...');

  while (true) {
    try {
      const res = await telegramRequest('getUpdates', {
        offset: lastUpdateId + 1,
        timeout: 30,
        allowed_updates: ['message', 'callback_query']
      });

      if (!res.ok) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      for (const update of res.result) {
        if (update.update_id > lastUpdateId) lastUpdateId = update.update_id;

        // 一般文字訊息
        if (update.message?.text && String(update.message.chat.id) === CHAT_ID) {
          const dedupeId = `msg_${update.message.message_id}`;
          if (!processingSet.has(dedupeId)) {
            processingSet.add(dedupeId);
            const text = update.message.text;
            const messageId = update.message.message_id;

            // 解析 reply_to_message：老闆 reply 了 brain 的哪則訊息
            const replyContext = update.message.reply_to_message?.text || null;
            if (replyContext) {
              console.log(`[Bridge] 收到（reply）：${text}`);
              console.log(`[Bridge]   ↳ 回覆的訊息：${replyContext.slice(0, 80)}...`);
            } else {
              console.log(`[Bridge] 收到：${text}`);
            }

            if (text.startsWith('/parallel ')) {
              handleParallel(text).catch(e => console.error('[Bridge] parallel 錯誤：', e.message));
            } else {
              handleMessage(text, messageId, replyContext).catch(e => console.error('[Bridge] 處理錯誤：', e.message));
            }
          }
        }

        // 按鈕點擊
        if (update.callback_query && String(update.callback_query.from.id) === CHAT_ID) {
          const cbId = `cb_${update.callback_query.id}`;
          if (!processingSet.has(cbId)) {
            processingSet.add(cbId);
            await answerCallbackQuery(update.callback_query.id);
            const data = update.callback_query.data;
            const origMsgId = update.callback_query.message?.message_id;
            console.log(`[Bridge] 按鈕：${data}`);
            handleMessage(data, origMsgId, null).catch(e => console.error('[Bridge] 按鈕處理錯誤：', e.message));
          }
        }
      }
    } catch (e) {
      console.error('[Bridge] Poll 錯誤：', e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// --- 啟動 ---
async function main() {
  // 確認 claude CLI 可用
  await new Promise((resolve) => {
    const test = spawn('claude', ['--version'], { stdio: 'pipe' });
    test.on('error', () => {
      console.error('[Bridge] 找不到 claude CLI！請確認已安裝 Claude Code CLI');
      process.exit(1);
    });
    test.on('close', resolve);
  });

  const projInfo = currentProjectDir
    ? `📁 目前專案：\`${path.basename(currentProjectDir)}\``
    : '📁 尚未設定專案，請用 /use 或 /new 指定';
  await sendMessage(
    `[BRAIN] ✅ *Bridge 已啟動*\n${projInfo}\n傳 /help 查看指令`
  );

  poll();
}

// 優雅關閉
process.on('SIGINT', async () => {
  console.log('\n[Bridge] 關閉中...');
  for (const [, t] of runningTasks) t.proc.kill('SIGTERM');
  await sendMessage('[BRAIN] 🔴 Bridge 已關閉').catch(() => {});
  process.exit(0);
});

main().catch(e => {
  console.error('[Bridge] 啟動失敗：', e.message);
  process.exit(1);
});
