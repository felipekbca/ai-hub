const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onInitServices: (callback) => ipcRenderer.on('init-services', (event, services) => callback(services)),
    onSetActiveAI: (callback) => ipcRenderer.on('set-active-ai', (event, serviceId) => callback(serviceId)),
    onLoadingStart: (callback) => ipcRenderer.on('loading-start', (event, serviceId) => callback(serviceId)),
    onLoadingEnd: (callback) => ipcRenderer.on('loading-end', (event, serviceId) => callback(serviceId)),
    switchService: (serviceId) => ipcRenderer.send('switch-service', serviceId),
    // --- MELHORIA: Listener para quando as configurações são salvas ---
    onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', () => callback())
});