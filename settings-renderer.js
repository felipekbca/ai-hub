document.addEventListener('DOMContentLoaded', () => {
    const availableList = document.getElementById('available-list');
    const selectedList = document.getElementById('selected-list');
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');

    let allServices = [];
    let userServices = [];

    function renderLists() {
        availableList.innerHTML = '';
        selectedList.innerHTML = '';

        const selectedIds = new Set(userServices.map(s => s.id));

        allServices.forEach(service => {
            if (!selectedIds.has(service.id)) {
                availableList.appendChild(createServiceItem(service, 'add'));
            }
        });

        userServices.forEach(service => {
            selectedList.appendChild(createServiceItem(service, 'remove'));
        });
    }

    function createServiceItem(service, type) {
        const li = document.createElement('li');
        li.dataset.id = service.id;

        const img = document.createElement('img');
        img.src = service.iconPath;
        li.appendChild(img);

        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = service.name;
        li.appendChild(name);

        const button = document.createElement('button');
        button.textContent = type === 'add' ? '+' : '−';
        button.onclick = () => handleAction(type, service);
        li.appendChild(button);

        return li;
    }

    function handleAction(type, service) {
        if (type === 'add') {
            userServices.push(service);
        } else {
            userServices = userServices.filter(s => s.id !== service.id);
        }
        renderLists();
    }

    window.settingsAPI.onDataResponse(data => {
        allServices = data.defaultServices;
        userServices = JSON.parse(JSON.stringify(data.userServices)); // Deep copy
        renderLists();
    });

    saveButton.addEventListener('click', async () => {
        const result = await window.settingsAPI.saveData(userServices);
        if (result.success) {
            alert('Configurações salvas! A aplicação será reiniciada para aplicar as mudanças.');
            window.settingsAPI.relaunchApp();
        } else {
            alert(`Erro ao salvar: ${result.error}`);
        }
    });

    cancelButton.addEventListener('click', () => {
        window.settingsAPI.closeWindow();
    });

    // Solicitar os dados iniciais
    window.settingsAPI.getData();
});