const { app, BrowserWindow, BrowserView, ipcMain, Menu, Notification, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

let mainWindow;
const aiViews = {};
let currentView = null;

// Definição dos serviços de IA com caminhos para os ícones
const aiServices = [
  { id: 'notebooklm', name: 'NotebookLM', url: 'https://notebooklm.google.com/', iconPath: 'assets/icons/notebooklm.png' }, // Adicionado iconPath
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/', iconPath: 'assets/icons/gemini.png' },     // Adicionado iconPath
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com/', iconPath: 'assets/icons/chatgpt.png' },      // Adicionado iconPath
  { id: 'Meta', name: 'Meta AI', url: 'https://www.meta.ai/', iconPath: 'assets/icons/metaai.png' }      // Adicionado iconPath
];

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

  // mainWindow.webContents.openDevTools();

  setupApplicationMenu();
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
  createWindow();

  mainWindow.webContents.on('did-finish-load', () => {
    aiServices.forEach(service => {
      const view = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        }
      });
      mainWindow.addBrowserView(view);

      view.webContents.on('did-start-loading', () => {
        mainWindow.webContents.send('loading-start', service.id);
        console.log(`[Loading] ${service.name} started loading.`);
      });
      view.webContents.on('did-stop-loading', () => {
        mainWindow.webContents.send('loading-end', service.id);
        console.log(`[Loading] ${service.name} stopped loading.`);
      });

      view.webContents.on('will-show-notification', (event, title, body, silent, icon, badge, data) => {
        event.preventDefault();
        new Notification({
          title: title,
          body: body,
          icon: icon || path.join(__dirname, 'assets', 'icon.png'), // Use o ícone padrão ou o do serviço
          silent: silent
        }).show();
        console.log(`[Notification] Title: ${title}, Body: ${body}`);
      });

      view.webContents.loadURL(service.url)
        .then(() => {
          console.log(`URL ${service.url} carregada com sucesso para ${service.name}`);
        })
        .catch(error => {
          console.error(`Erro ao carregar URL para ${service.name} (${service.url}):`, error);
        });
      view.webContents.setZoomFactor(0.9);

      view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

      aiViews[service.id] = view;
    });

    // Envia a lista de serviços completa para o renderer (incluindo iconPath).
    mainWindow.webContents.send('init-services', aiServices.map(s => ({ 
        id: s.id, 
        name: s.name,
        iconPath: s.iconPath // Inclui o caminho do ícone
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
     // initialView.webContents.openDevTools();
      mainWindow.webContents.send('set-active-ai', initialServiceId);
      store.set('lastActiveAI', initialServiceId);
    }
  });

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
     // newView.webContents.openDevTools();
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

function setupApplicationMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Recarregar AI Atual',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (currentView) {
              currentView.webContents.reload();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Sair',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'delete', label: 'Excluir' },
        { role: 'selectAll', label: 'Selecionar Tudo' }
      ]
    },
    {
      label: 'Visualizar',
      submenu: [
        { role: 'reload', label: 'Recarregar Janela Principal' },
        { role: 'forceReload', label: 'Forçar Recarregar Janela Principal' },
        { type: 'separator' },
        { role: 'toggledevtools', label: 'Alternar DevTools da Janela Principal' },
        {
            label: 'Alternar DevTools da AI Ativa',
            accelerator: 'F12',
            click: () => {
                if (currentView) {
                    currentView.webContents.toggleDevTools();
                } else {
                    dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: 'DevTools da AI',
                        message: 'Nenhuma AI ativa para abrir o DevTools.'
                    });
                }
            }
        },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Redefinir Zoom' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela Cheia' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre o AI Hub',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Sobre o AI Hub',
              message: `AI Hub v${app.getVersion()}\n\nUm integrador de IAs feito com Electron.`,
              detail: 'Desenvolvido para unificar o acesso às suas ferramentas de Inteligência Artificial favoritas.'
            });
          }
        },
        {
            label: 'Visitar Site do Electron',
            click: () => {
                shell.openExternal('https://www.electronjs.org');
            }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
