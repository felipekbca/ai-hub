const { Menu, dialog, shell } = require('electron');

/**
 * Cria o template do menu da aplicação.
 * @param {Electron.App} app - A instância da aplicação Electron.
 * @param {Electron.BrowserWindow} mainWindow - A janela principal da aplicação.
 * @param {Function} getCurrentView - Uma função que retorna a BrowserView atualmente ativa.
 * @returns {Electron.MenuItemConstructorOptions[]} O template do menu.
 */
const createMenuTemplate = (app, mainWindow, getCurrentView) => {
  return [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Recarregar AI Atual',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const view = getCurrentView();
            if (view) {
              view.webContents.reload();
            }
          }
        },
        {
          label: 'Limpar Cache da AI Atual',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: async () => {
            const view = getCurrentView();
            if (view) {
              try {
                await view.webContents.session.clearStorageData();
                console.log('Cache e dados de armazenamento limpos.');
                view.webContents.reload();
              } catch (err) {
                console.error('Falha ao limpar o cache:', err);
              }
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
                const view = getCurrentView();
                if (view) {
                    view.webContents.toggleDevTools();
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
};

/**
 * Constrói e aplica o menu da aplicação.
 * @param {Electron.App} app - A instância da aplicação Electron.
 * @param {Electron.BrowserWindow} mainWindow - A janela principal da aplicação.
 * @param {Function} getCurrentView - Uma função que retorna a BrowserView atualmente ativa.
 */
const setupMenu = (app, mainWindow, getCurrentView) => {
  const template = createMenuTemplate(app, mainWindow, getCurrentView);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

module.exports = setupMenu;