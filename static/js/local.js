

async function criarLocal(event) {
    event.preventDefault();
    
    const dados = {
        nome: document.getElementById('nomePonto').value,
        tipo: document.getElementById('tipoPonto').value,
        localidade: document.getElementById('localidadePonto').value,
        endereco: document.getElementById('enderecoPonto').value,
        bio: document.getElementById('bioPonto').value,
        faixaPreco: document.getElementById('faixaPrecoPonto') ? document.getElementById('faixaPrecoPonto').value : 'Médio'
    };

    if (!dados.nome || !dados.tipo || !dados.localidade || !dados.endereco) {
        alert('Por favor, preencha todos os campos obrigatórios');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('action', 'criar');
        formData.append('nome', dados.nome);
        formData.append('tipo', dados.tipo);
        formData.append('localidade', dados.localidade);
        formData.append('endereco', dados.endereco);
        formData.append('bio', dados.bio);
        formData.append('faixaPreco', dados.faixaPreco);
        
        
        const fotoPerfil = document.getElementById('fotoPerfilPonto').files[0];
        const fotoCapa = document.getElementById('fotoCapaPonto').files[0];
        
        if (fotoPerfil) {
            formData.append('fotoPerfil', fotoPerfil);
        }
        if (fotoCapa) {
            formData.append('fotoCapa', fotoCapa);
        }

        const response = await fetch('/api/local_handler/', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert('Local cadastrado com sucesso!');
            if (typeof fecharModal === 'function') {
                fecharModal();
            }
            document.getElementById('formPonto').reset();
            
            if (typeof carregarDadosPerfil === 'function') {
                carregarDadosPerfil();
            }
        } else {
            alert('Erro: ' + result.message);
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao cadastrar local. Tente novamente.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const formPonto = document.getElementById('formPonto');
    if (formPonto) {
        formPonto.addEventListener('submit', criarLocal);
    }
});