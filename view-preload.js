const { ipcRenderer } = require('electron');

/**
 * Adiciona um listener para o evento de 'contextmenu' (clique com o botão direito).
 * Quando acionado, previne o menu padrão do navegador e envia um evento IPC
 * para o processo principal ('main.js') com as propriedades do contexto,
 * como texto selecionado, se a área é editável e a URL de um link.
 */
window.addEventListener('contextmenu', (e) => {
    // Previne o menu de contexto padrão do navegador.
    e.preventDefault();

    // Extrai o ancestral do link, caso o clique seja em um elemento filho de uma tag <a>.
    let target = e.target;
    while (target && !(target instanceof HTMLAnchorElement)) {
        target = target.parentElement;
    }
    const linkURL = target ? target.href : null;

    // Coleta as propriedades do contexto.
    const props = {
        selectionText: window.getSelection().toString(),
        isEditable: e.target.isContentEditable || (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'),
        linkURL: linkURL
    };

    // Envia as propriedades para o processo principal para construir o menu de contexto.
    ipcRenderer.send('show-context-menu', props);
}, false);