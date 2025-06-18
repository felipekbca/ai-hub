var electronAPI;

if (window.electronAPI) {
    electronAPI = window.electronAPI;
} else {
    console.error("electronAPI não está disponível no objeto window. Verifique o preload.js.");
}

document.addEventListener('DOMContentLoaded', () => {
    if (!electronAPI) {
        console.error("Aplicação não pode iniciar a interface da barra lateral devido à falta de electronAPI.");
        return;
    }

    const sidebar = document.getElementById('sidebar');
    const loadingOverlay = document.getElementById('loading-overlay');
    let currentActiveIcon = null;

    /**
     * Atualiza o estado visual do ícone ativo na barra lateral.
     * @param {string} serviceId - O ID do serviço que deve ser marcado como ativo.
     */
    function setActiveIcon(serviceId) {
        if (currentActiveIcon) {
            currentActiveIcon.classList.remove('active');
        }
        const newActiveIcon = document.getElementById(`icon-${serviceId}`);
        if (newActiveIcon) {
            newActiveIcon.classList.add('active');
            currentActiveIcon = newActiveIcon;
        }
    }

    // Listener para o evento 'init-services' vindo do main process.
    // Agora 'service' também inclui 'iconPath'.
    electronAPI.onInitServices((services) => {
        services.forEach(service => {
            const iconDiv = document.createElement('div');
            iconDiv.classList.add('ai-icon');
            iconDiv.id = `icon-${service.id}`;
            iconDiv.title = service.name; // Título para tooltip

            // Cria a tag <img> para o ícone
            const iconImg = document.createElement('img');
            iconImg.src = service.iconPath; // Define o caminho da imagem
            iconImg.alt = service.name; // Texto alternativo
            iconDiv.appendChild(iconImg); // Adiciona a imagem ao div do ícone

            iconDiv.addEventListener('click', () => {
                setActiveIcon(service.id);
                electronAPI.switchService(service.id);
            });
            sidebar.appendChild(iconDiv);
        });
    });

    // Listener para o evento 'set-active-ai' do main process.
    electronAPI.onSetActiveAI((serviceId) => {
        setActiveIcon(serviceId);
    });

    // Listener para o início do carregamento de uma AI.
    electronAPI.onLoadingStart((serviceId) => {
        loadingOverlay.classList.add('visible');
        console.log(`Loading started for ${serviceId}`);
    });

    // Listener para o fim do carregamento de uma AI.
    electronAPI.onLoadingEnd((serviceId) => {
        loadingOverlay.classList.remove('visible');
        console.log(`Loading ended for ${serviceId}`);
    });
});


window.electronAPI.onSettingsUpdated(() => {
    console.log('Configurações atualizadas. Recarregando a janela principal...');
    // A maneira mais simples de redesenhar a UI com as novas IAs é recarregar
    location.reload();
});