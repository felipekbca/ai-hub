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
const aiViews = {};
let currentView = null;

// Carrega os serviços de IA a partir de um arquivo JSON externo
const servicesPath = path.join(__dirname, 'services.json');
const aiServices = JSON.parse(fs.readFileSync(servicesPath, 'utf-8'));

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

  // Chama a função de setup do menu do módulo externo
  setupMenu(app, mainWindow, () => currentView);
}

/**
 * Atualiza o tamanho e a posição de uma BrowserView.
 */
function updateViewBounds(view) {
  if (!mainWindow || !view) return;

  const [contentWidth, contentHeight] = mainWindow.getContentSize();
  const sidebarWidth = 40;

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
    
    // Exemplo: aprova automaticamente as notificações para todos os serviços confiáveis
    if (permission === 'notifications') {
      const isKnownService = aiServices.some(service => url.startsWith(service.url));
      return callback(isKnownService);
    }

    // Nega todas as outras permissões por padrão
    return callback(false);
  });

  createWindow();

  mainWindow.webContents.on('did-finish-load', () => {
    aiServices.forEach(service => {
      const view = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'view-preload.js')
        }
      });
      mainWindow.addBrowserView(view);

      // Handler para abrir links externos no navegador padrão
      view.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
      });

      view.webContents.on('did-start-loading', () => {
        mainWindow.webContents.send('loading-start', service.id);
      });
      view.webContents.on('did-stop-loading', () => {
        mainWindow.webContents.send('loading-end', service.id);
      });

      view.webContents.on('will-show-notification', (event, title, body, silent, icon, badge, data) => {
        event.preventDefault();
        new Notification({
          title: title,
          body: body,
          icon: icon || path.join(__dirname, 'assets', 'icon.png'),
          silent: silent
        }).show();
      });

      view.webContents.loadURL(service.url)
        .catch(error => {
          console.error(`Erro ao carregar URL para ${service.name} (${service.url}):`, error);
        });
      view.webContents.setZoomFactor(0.9);

      view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

      aiViews[service.id] = view;
    });

    mainWindow.webContents.send('init-services', aiServices.map(s => ({ 
        id: s.id, 
        name: s.name,
        iconPath: s.iconPath 
    })));

    const lastActiveAIId = store.get('lastActiveAI');
    let initialServiceId = aiServices[0].id;
    if (lastActiveAIId && aiServices.some(s => s.id === lastActiveAIId)) {
        initialServiceId = lastActiveAIId;
    }
    
    const initialView = aiViews[initialServiceId];
    if (initialView) {
      mainWindow.setBrowserView(initialView);
      updateViewBounds(initialView);
      currentView = initialView;
      initialView.webContents.focus();
      mainWindow.webContents.send('set-active-ai', initialServiceId);
      store.set('lastActiveAI', initialServiceId);
    }
  });
  
  // Listener do menu de contexto (botão direito)
  ipcMain.on('show-context-menu', (event, props) => {
    const { selectionText, isEditable, linkURL } = props;
    const webContents = event.sender;
    
    const template = [];

    if (linkURL) {
        template.push({
            label: 'Abrir link no navegador',
            click: () => shell.openExternal(linkURL)
        }, {
            label: 'Copiar endereço do link',
            click: () => clipboard.writeText(linkURL)
        }, {
            type: 'separator'
        });
    }

    template.push({
        label: 'Copiar',
        role: 'copy',
        enabled: !!selectionText
    }, {
        label: 'Colar',
        role: 'paste',
        enabled: isEditable
    }, {
        type: 'separator'
    }, {
        label: 'Recarregar',
        role: 'reload',
        click: () => webContents.reload()
    });

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