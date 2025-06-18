const { app, BrowserWindow, BrowserView, ipcMain, Menu, Notification, dialog, shell, clipboard, session } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const setupMenu = require('./menu');

// Adiciona o recarregamento automático em desenvolvimento
try {
  require('electron-reloader')(module);
} catch (_) {}

const store = new Store();

let mainWindow;
let settingsWindow; // Janela de configurações
const aiViews = {};
let currentView = null;

// Carrega os serviços de IA PADRÃO a partir de um arquivo JSON externo
const servicesPath = path.join(__dirname, 'services.json');
const defaultAiServices = JSON.parse(fs.readFileSync(servicesPath, 'utf-8'));

// Carrega a lista de IAs do usuário ou usa a padrão
let userAiServices = store.get('user-ai-services', defaultAiServices);


// Função para criar a janela de configurações
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 600,
    height: 500,
    parent: mainWindow,
    modal: true,
    resizable: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'), // Preload para a janela de configurações
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/**
 * Cria a janela principal do aplicativo.
 */
function createWindow() {
  const bounds = store.get('windowBounds');
  
  mainWindow = new BrowserWindow({
    width: bounds ? bounds.width : 1200,
    height: bounds ? bounds.height : 800,
    x: bounds ? bounds.x : undefined,
    y: bounds ? bounds.y : undefined,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.loadFile('index.html');

  let resizeTimeout;
  mainWindow.on('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      store.set('windowBounds', mainWindow.getBounds());
      if (currentView) {
        updateViewBounds(currentView); 
      }
    }, 100);
  });
  mainWindow.on('move', () => store.set('windowBounds', mainWindow.getBounds()));

  // Passamos a função para criar a janela de config para o menu
  setupMenu(app, mainWindow, () => currentView, createSettingsWindow);
}

/**
 * Atualiza o tamanho e a posição de uma BrowserView.
 */
function updateViewBounds(view) {
  if (!mainWindow || !view) return;

  const [contentWidth, contentHeight] = mainWindow.getContentSize();
  const sidebarWidth = 60;

  view.setBounds({
    x: sidebarWidth,
    y: 0,
    width: contentWidth - sidebarWidth,
    height: contentHeight
  });
}

app.whenReady().then(() => {
  // Gerenciador de permissões para mais segurança
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL();
    
    // Exemplo: aprova automaticamente as notificações para todos os serviços conhecidos
    if (permission === 'notifications') {
      const isKnownService = defaultAiServices.some(service => url.startsWith(service.url));
      return callback(isKnownService);
    }

    // Nega todas as outras permissões por padrão
    return callback(false);
  });

  createWindow();

  // Usa a lista do usuário para criar as views
  mainWindow.webContents.on('did-finish-load', () => {
    // Limpa views antigas caso a janela seja recarregada
    Object.values(aiViews).forEach(view => {
        mainWindow.removeBrowserView(view);
        view.webContents.destroy();
    });

    userAiServices.forEach(service => {
        const view = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'view-preload.js')
            }
        });
        mainWindow.addBrowserView(view);

        view.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });

        view.webContents.on('did-start-loading', () => mainWindow.webContents.send('loading-start', service.id));
        view.webContents.on('did-stop-loading', () => mainWindow.webContents.send('loading-end', service.id));

        view.webContents.on('will-show-notification', (event, title, body, silent, icon) => {
            event.preventDefault();
            new Notification({ title, body, icon: icon || path.join(__dirname, 'assets', 'icon.png'), silent }).show();
        });

        view.webContents.loadURL(service.url).catch(error => console.error(`Erro ao carregar URL para ${service.name}:`, error));
        view.webContents.setZoomFactor(0.9);
        view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        aiViews[service.id] = view;
    });

    // Envia a lista de serviços do USUÁRIO para o renderer
    mainWindow.webContents.send('init-services', userAiServices.map(s => ({ 
        id: s.id, 
        name: s.name,
        iconPath: s.iconPath 
    })));
    
    // Lógica de seleção inicial da view
    const lastActiveAIId = store.get('lastActiveAI');
    let initialServiceId = userAiServices.length > 0 ? userAiServices[0].id : null;
    if (lastActiveAIId && userAiServices.some(s => s.id === lastActiveAIId)) {
        initialServiceId = lastActiveAIId;
    }
    
    if(initialServiceId) {
        const initialView = aiViews[initialServiceId];
        if (initialView) {
            mainWindow.setBrowserView(initialView);
            updateViewBounds(initialView);
            currentView = initialView;
            initialView.webContents.focus();
            mainWindow.webContents.send('set-active-ai', initialServiceId);
            store.set('lastActiveAI', initialServiceId);
        }
    }
  });
  
  // --- LISTENERS IPC ---

  // Para abrir a janela de configurações (chamado pelo menu)
  ipcMain.on('open-settings-window', createSettingsWindow);

  // A janela de configurações pede os dados
  ipcMain.on('get-settings-data', (event) => {
    event.reply('settings-data-response', {
      defaultServices: defaultAiServices,
      userServices: userAiServices
    });
  });

  // Salva as novas configurações
  ipcMain.handle('save-settings-data', (event, newUserServices) => {
    try {
      userAiServices = newUserServices;
      store.set('user-ai-services', userAiServices);
      return { success: true };
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      return { success: false, error: error.message };
    }
  });

  // Reinicia a aplicação após salvar as configurações
  ipcMain.on('relaunch-app', () => {
    app.relaunch();
    app.exit();
  });

  // Listener do menu de contexto (botão direito)
  ipcMain.on('show-context-menu', (event, props) => {
    const { selectionText, isEditable, linkURL } = props;
    const webContents = event.sender;
    const template = [];
    if (linkURL) {
        template.push({ label: 'Abrir link no navegador', click: () => shell.openExternal(linkURL) }, { label: 'Copiar endereço do link', click: () => clipboard.writeText(linkURL) }, { type: 'separator' });
    }
    template.push({ label: 'Copiar', role: 'copy', enabled: !!selectionText }, { label: 'Colar', role: 'paste', enabled: isEditable }, { type: 'separator' }, { label: 'Recarregar', role: 'reload', click: () => webContents.reload() });
    const menu = Menu.buildFromTemplate(template);
    menu.popup(BrowserWindow.fromWebContents(webContents));
  });

  // Listener para trocar o serviço de IA ativo
  ipcMain.on('switch-service', (event, serviceId) => {
    if (currentView) {
      currentView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
    const newView = aiViews[serviceId];
    if (newView) {
      mainWindow.setBrowserView(newView);
      updateViewBounds(newView);
      currentView = newView;
      newView.webContents.focus();
      store.set('lastActiveAI', serviceId);
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});