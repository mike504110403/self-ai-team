const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  toggle: () => ipcRenderer.send('toggle-bridge'),
  switchProject: (name) => ipcRenderer.send('switch-project', name),
  addProject: (name, dir) => ipcRenderer.send('add-project', { name, dir }),
  openLog: () => ipcRenderer.send('open-log'),
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (_, data) => callback(data));
  },
});
