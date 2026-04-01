// 確保 Electron 不以 Node.js 模式運行（Cursor/VS Code 會設定此變數）
delete process.env.ELECTRON_RUN_AS_NODE;

const { app, nativeImage, Tray, Menu, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { BridgeProcess } = require('./bridge-process');
const { ProjectManager } = require('./project-manager');

let tray = null;
let popupWindow = null;
let bridge = null;
const projectManager = new ProjectManager();

function createTrayIcon(status = 'stopped') {
  const iconName = status === 'running' ? 'tray-running-Template.png' : 'tray-stopped-Template.png';
  const iconPath = path.join(__dirname, '..', 'assets', iconName);
  try {
    return nativeImage.createFromPath(iconPath);
  } catch {
    return null;
  }
}

function createPopupWindow() {
  const win = new BrowserWindow({
    width: 360,
    height: 480,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('blur', () => win.hide());
  return win;
}

function getStatusData() {
  return {
    running: bridge?.isRunning() || false,
    currentProject: projectManager.getCurrentName(),
    currentPath: projectManager.getCurrent(),
    projects: projectManager.getAll(),
    taskCount: bridge?.getTaskCount() || 0,
    logs: bridge?.getRecentLogs(20) || [],
    uptime: bridge?.getUptime() || 0,
  };
}

function showPopup() {
  if (!popupWindow) popupWindow = createPopupWindow();
  const trayBounds = tray.getBounds();
  const winBounds = popupWindow.getBounds();
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  const y = trayBounds.y + trayBounds.height + 4;
  popupWindow.setPosition(x, y, false);
  popupWindow.show();
  popupWindow.focus();
  sendStatusToUI();
}

function sendStatusToUI() {
  if (!popupWindow || !popupWindow.isVisible()) return;
  popupWindow.webContents.send('status-update', getStatusData());
}

function updateTray() {
  const running = bridge?.isRunning() || false;
  const icon = createTrayIcon(running ? 'running' : 'stopped');
  if (icon) tray.setImage(icon);
  tray.setToolTip(running
    ? `BrainBridge - 運行中 (${projectManager.getCurrentName() || '未設定'})`
    : 'BrainBridge - 已停止'
  );
}

function buildContextMenu() {
  const running = bridge?.isRunning() || false;
  const projectName = projectManager.getCurrentName() || '未設定';
  const projectItems = Object.entries(projectManager.getAll()).map(([name, dir]) => ({
    label: name, type: 'radio', checked: name === projectManager.getCurrentName(),
    click: () => { projectManager.switchTo(name); if (running) bridge.restart(dir); updateTray(); }
  }));

  return Menu.buildFromTemplate([
    { label: running ? '🟢 Bridge 運行中' : '🔴 Bridge 已停止', enabled: false },
    { label: `📁 ${projectName}`, enabled: false },
    { type: 'separator' },
    { label: running ? '⏸ 停止 Bridge' : '▶ 啟動 Bridge', click: () => {
      if (running) bridge.stop(); else { const d = projectManager.getCurrent(); if (d) bridge.start(d); }
      updateTray(); sendStatusToUI();
    }},
    { type: 'separator' },
    { label: '切換專案', submenu: projectItems.length > 0 ? projectItems : [{ label: '(無已註冊專案)', enabled: false }] },
    { label: '開啟面板', click: showPopup },
    { label: '查看 Log', click: () => shell.openPath(path.join(app.getPath('home'), '.claude', `bridge-${new Date().toISOString().slice(0,10)}.log`)) },
    { type: 'separator' },
    { label: '開機自動啟動', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: 'separator' },
    { label: '結束 BrainBridge', click: () => { bridge?.stop(); app.quit(); } },
  ]);
}

// --- 啟動 ---
app.whenReady().then(() => {
  app.dock?.hide();

  // Tray
  const icon = createTrayIcon('stopped');
  tray = new Tray(icon || nativeImage.createEmpty());
  tray.setToolTip('BrainBridge - 已停止');
  tray.on('click', showPopup);
  tray.on('right-click', () => { tray.setContextMenu(buildContextMenu()); tray.popUpContextMenu(); });

  // IPC handlers（必須在 app ready 後註冊）
  ipcMain.handle('get-status', () => getStatusData());

  ipcMain.on('toggle-bridge', () => {
    if (bridge?.isRunning()) bridge.stop();
    else { const d = projectManager.getCurrent(); if (d) bridge.start(d); }
    updateTray(); sendStatusToUI();
  });

  ipcMain.on('switch-project', (_, name) => {
    projectManager.switchTo(name);
    if (bridge?.isRunning()) bridge.restart(projectManager.getCurrent());
    updateTray(); sendStatusToUI();
  });

  ipcMain.on('add-project', (_, { name, dir }) => { projectManager.add(name, dir); sendStatusToUI(); });
  ipcMain.on('open-log', () => shell.openPath(path.join(app.getPath('home'), '.claude', `bridge-${new Date().toISOString().slice(0,10)}.log`)));

  // Bridge
  bridge = new BridgeProcess({
    onStatusChange: () => { updateTray(); sendStatusToUI(); },
    onLog: () => sendStatusToUI(),
    onTaskUpdate: () => sendStatusToUI(),
  });

  const lastProject = projectManager.getCurrent();
  if (lastProject) { bridge.start(lastProject); updateTray(); }

  setInterval(sendStatusToUI, 3000);
});

app.on('window-all-closed', (e) => e.preventDefault());
