const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  getData: () => ipcRenderer.send('get-settings-data'),
  onDataResponse: (callback) => ipcRenderer.on('settings-data-response', (event, data) => callback(data)),
  saveData: (data) => ipcRenderer.invoke('save-settings-data', data),
  relaunchApp: () => ipcRenderer.send('relaunch-app'),
  closeWindow: () => window.close()
});