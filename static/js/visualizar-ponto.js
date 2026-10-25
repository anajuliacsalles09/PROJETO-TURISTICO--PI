

let fotoAtualIndex = 0;
let totalFotos = 0;
let fotosArray = [];

function inicializarGaleria() {
    const thumbnails = document.querySelectorAll('.thumbnail-item');
    totalFotos = thumbnails.length;
    
    fotosArray = Array.from(thumbnails).map(thumb => {
        const img = thumb.querySelector('img');
        return {
            src: img.src,
            id: thumb.dataset.fotoId
        };
    });
}

function navegarGaleria(direcao) {
    fotoAtualIndex += direcao;
    
    if (fotoAtualIndex < 0) {
        fotoAtualIndex = totalFotos - 1;
    } else if (fotoAtualIndex >= totalFotos) {
        fotoAtualIndex = 0;
    }
    
    atualizarFotoPrincipal();
}

function selecionarFoto(index) {
    fotoAtualIndex = index;
    atualizarFotoPrincipal();
}

function atualizarFotoPrincipal() {
    const fotoPrincipal = document.getElementById('fotoPrincipal');
    const fotoAtualSpan = document.getElementById('fotoAtual');
    const thumbnails = document.querySelectorAll('.thumbnail-item');
    
    if (fotoPrincipal && fotosArray[fotoAtualIndex]) {
        fotoPrincipal.src = fotosArray[fotoAtualIndex].src;
        fotoPrincipal.onclick = () => abrirLightbox(fotosArray[fotoAtualIndex].src);
    }
    
    if (fotoAtualSpan) {
        fotoAtualSpan.textContent = fotoAtualIndex + 1;
    }
    
    thumbnails.forEach((thumb, index) => {
        if (index === fotoAtualIndex) {
            thumb.classList.add('active');
            thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            thumb.classList.remove('active');
        }
    });
}

function abrirModalAvaliacao() {
    const modal = document.getElementById('modalAvaliacao');
    if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
    }
}

function abrirModalAddFotos() {
    const modal = document.getElementById('modalAddFotos');
    if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
    }
}

function editarSobre() {
    const modal = document.getElementById('modalEditarSobre');
    if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
    }
}

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('show');
        }
    });
});

function abrirLightbox(src) {
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightbox').classList.add('show');
}

function fecharLightbox() {
    document.getElementById('lightbox').classList.remove('show');
}

async function carregarAvaliacoes() {
    try {
        const formData = new FormData();
        formData.append('action', 'listar_avaliacoes');
        formData.append('tipo', 'Ponto_Turistico');
        formData.append('pontoId', pontoId);

        const response = await fetch('/api/avaliacao_handler/', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        const container = document.getElementById('listaAvaliacoes');

        if (result.success && result.avaliacoes && result.avaliacoes.length > 0) {
            container.innerHTML = result.avaliacoes.map(aval => {
                const fotoUrl = aval.Foto_Perfil || '';
                const avatarHTML = fotoUrl 
                    ? `<img src="${fotoUrl}" alt="${aval.NomeUsuario}">`
                    : '👤';
                
                return `
                    <div class="avaliacao-card">
                        <div class="avaliacao-header">
                            <div class="avaliacao-usuario" onclick="event.stopPropagation(); window.location.href='/perfil-publico/?id=${aval.IdUsuario}'" style="cursor: pointer; transition: opacity 0.3s;">
                                <div class="usuario-avatar">${avatarHTML}</div>
                                <div>
                                    <p class="usuario-nome" style="cursor: pointer;">${aval.NomeUsuario}</p>
                                    <p class="avaliacao-data">${formatarData(aval.DataAvaliacao)}</p>
                                </div>
                            </div>
                            <div class="avaliacao-nota">${'★'.repeat(Math.round(aval.Nota))}</div>
                        </div>
                        ${aval.Descricao ? `<p class="avaliacao-texto">${escapeHtml(aval.Descricao)}</p>` : ''}
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<p class="aviso-vazio">Nenhuma avaliação ainda. Seja o primeiro a avaliar!</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar avaliações:', error);
        document.getElementById('listaAvaliacoes').innerHTML = '<p class="erro">Erro ao carregar avaliações</p>';
    }
}

const formAvaliacao = document.getElementById('formAvaliacao');
if (formAvaliacao) {
    formAvaliacao.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(formAvaliacao);
        formData.append('action', 'criar_avaliacao');
        formData.append('tipo', 'Ponto_Turistico');

        try {
            const response = await fetch('/api/avaliacao_handler/', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                alert('Avaliação enviada com sucesso!');
                fecharModal('modalAvaliacao');
                formAvaliacao.reset();
                carregarAvaliacoes();
                location.reload();
            } else {
                alert('Erro: ' + result.message);
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao enviar avaliação');
        }
    });
}

const formEditarSobre = document.getElementById('formEditarSobre');
if (formEditarSobre) {
    formEditarSobre.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(formEditarSobre);
        formData.append('action', 'editar');
        formData.append('pontoId', pontoId);

        try {
            const response = await fetch('/api/ponto_handler/', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                alert('Informações atualizadas com sucesso!');
                location.reload();
            } else {
                alert('Erro: ' + result.message);
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao atualizar informações');
        }
    });
}

const formAddFotos = document.getElementById('formAddFotos');
if (formAddFotos) {
    document.getElementById('fotosGaleria').addEventListener('change', function(e) {
        const previewContainer = document.getElementById('previewFotos');
        previewContainer.innerHTML = '';
        
        Array.from(e.target.files).forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <button type="button" class="btn-remover-foto" onclick="removerFotoPreview(${index})">×</button>
                `;
                previewContainer.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    });

    formAddFotos.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(formAddFotos);
        formData.append('action', 'adicionar_fotos');
        formData.append('pontoId', pontoId);

        try {
            const response = await fetch('/api/ponto_handler/', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                alert('Fotos adicionadas com sucesso!');
                fecharModal('modalAddFotos');
                formAddFotos.reset();
                document.getElementById('previewFotos').innerHTML = '';
                location.reload();
            } else {
                alert('Erro: ' + result.message);
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao adicionar fotos');
        }
    });
}

async function removerFotoGaleria(fotoId) {
    if (!confirm('Tem certeza que deseja remover esta foto?')) {
        return;
    }

    try {
        const formData = new FormData();
        formData.append('action', 'remover_foto_galeria');
        formData.append('fotoId', fotoId);

        const response = await fetch('/api/ponto_handler/', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            location.reload();
        } else {
            alert('Erro: ' + result.message);
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao remover foto');
    }
}

function removerFotoPreview(index) {
    const input = document.getElementById('fotosGaleria');
    const dt = new DataTransfer();
    const files = input.files;

    for (let i = 0; i < files.length; i++) {
        if (i !== index) {
            dt.items.add(files[i]);
        }
    }

    input.files = dt.files;
    
    const event = new Event('change');
    input.dispatchEvent(event);
}

function formatarData(data) {
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

document.querySelectorAll('.rating-input input').forEach((input, index) => {
    input.addEventListener('change', () => {
        const labels = input.closest('.rating-input').querySelectorAll('label');
        labels.forEach((label, i) => {
            if (i >= labels.length - index - 1) {
                label.style.color = '#FFD700';
            } else {
                label.style.color = '#ddd';
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    carregarAvaliacoes();
    inicializarGaleria();
    
    document.addEventListener('keydown', (e) => {
        if (totalFotos > 1) {
            if (e.key === 'ArrowLeft') {
                navegarGaleria(-1);
            } else if (e.key === 'ArrowRight') {
                navegarGaleria(1);
            }
        }
    });
});