const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class BridgeProcess {
  constructor({ onStatusChange, onLog, onTaskUpdate }) {
    this.proc = null;
    this.running = false;
    this.startTime = null;
    this.logs = [];
    this.taskCount = 0;
    this.onStatusChange = onStatusChange;
    this.onLog = onLog;
    this.onTaskUpdate = onTaskUpdate;
  }

  _loadEnv(projectDir) {
    const env = { ...process.env };
    // 優先從 ~/.claude/.env 載入
    const globalEnv = path.join(os.homedir(), '.claude', '.env');
    this._parseEnvFile(globalEnv, env);
    // 再從專案 .env 覆蓋
    if (projectDir) {
      const projectEnv = path.join(projectDir, '.env');
      this._parseEnvFile(projectEnv, env);
    }
    return env;
  }

  _parseEnvFile(filePath, env) {
    try {
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
      for (const line of lines) {
        const match = line.match(/^([^#=\s]+)\s*=\s*(.+)$/);
        if (match) env[match[1]] = match[2].trim();
      }
    } catch { /* file not found, ignore */ }
  }

  _addLog(line) {
    const entry = `[${new Date().toLocaleTimeString('zh-TW')}] ${line}`;
    this.logs.push(entry);
    if (this.logs.length > 200) this.logs.shift();
    this.onLog?.(entry);

    // 寫入 log 檔
    const logPath = path.join(os.homedir(), '.claude', 'bridge.log');
    fs.appendFileSync(logPath, entry + '\n');
  }

  start(projectDir) {
    if (this.running) return;

    const env = this._loadEnv(projectDir);

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      this._addLog('❌ 缺少 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID');
      return;
    }

    const bridgeScript = path.join(os.homedir(), '.claude', 'templates', 'telegram-bridge.js');

    if (!fs.existsSync(bridgeScript)) {
      this._addLog(`❌ 找不到 bridge 腳本：${bridgeScript}`);
      return;
    }

    // 在 .app 環境中，PATH 可能不包含 node/claude
    // 自動偵測 node 和 claude 的絕對路徑
    const nodePaths = [
      '/usr/local/bin/node',
      '/opt/homebrew/bin/node',
      path.join(os.homedir(), '.nvm/versions/node/v20.20.0/bin/node'),
      'node', // fallback
    ];
    const nodeExe = nodePaths.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || 'node';

    // 確保 PATH 包含常用路徑
    const extraPaths = [
      path.join(os.homedir(), '.nvm/versions/node/v20.20.0/bin'),
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
    ].join(':');
    env.PATH = env.PATH ? `${extraPaths}:${env.PATH}` : extraPaths;

    this._addLog(`▶ 啟動 Bridge，專案：${path.basename(projectDir)}`);

    this.proc = spawn(nodeExe, [bridgeScript, '--project', projectDir], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.running = true;
    this.startTime = Date.now();
    this.onStatusChange?.();

    this.proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        this._addLog(line);
        // 追蹤任務數量
        if (line.includes('▶ 任務')) this.taskCount++;
        if (line.includes('■ 任務')) { this.taskCount = Math.max(0, this.taskCount - 1); this.onTaskUpdate?.(); }
      }
    });

    this.proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) this._addLog(`⚠ ${line}`);
    });

    this.proc.on('close', (code) => {
      this._addLog(`■ Bridge 已停止 (exit ${code})`);
      this.running = false;
      this.proc = null;
      this.taskCount = 0;
      this.onStatusChange?.();
    });

    this.proc.on('error', (err) => {
      this._addLog(`❌ Bridge 錯誤：${err.message}`);
      this.running = false;
      this.proc = null;
      this.onStatusChange?.();
    });
  }

  stop() {
    if (!this.proc) return;
    this._addLog('⏹ 停止 Bridge...');
    this.proc.kill('SIGTERM');
    // 5 秒後強制終止
    setTimeout(() => {
      if (this.proc) {
        this.proc.kill('SIGKILL');
        this.running = false;
        this.proc = null;
      }
    }, 5000);
  }

  restart(projectDir) {
    this._addLog('🔄 重啟 Bridge...');
    this.stop();
    setTimeout(() => this.start(projectDir), 1000);
  }

  isRunning() { return this.running; }
  getTaskCount() { return this.taskCount; }
  getRecentLogs(n = 20) { return this.logs.slice(-n); }
  getUptime() { return this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0; }
}

module.exports = { BridgeProcess };
