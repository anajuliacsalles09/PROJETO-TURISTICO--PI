// Painel de moderação: solicitações pendentes (aprovar/rejeitar) +
// gestão geral de usuários e pontos turísticos.
// Equivalente a /api/admin_handler/.
//
// Todas as funções e chamadas à API continuam as mesmas; esta versão só
// muda a apresentação (cards, ícones SVG, toasts e diálogo de confirmação).

let dadosUsuarios = [];
let dadosPontos = [];
let idLocalEmRejeicao = null;

// Escapa texto vindo do banco antes de colocar no HTML (um nome com < ou "
// quebraria a tabela, e poderia injetar código na tela do moderador).
function esc(valor) {
    return String(valor === null || valor === undefined ? '' : valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------
// Ícones (SVG inline, herdam a cor do texto)
// ---------------------------------------------------------------------

const ICONES = {
    olho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    lixeira: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    foto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    calendario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    preco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/></svg>',
};

// ---------------------------------------------------------------------
// Toasts e diálogo de confirmação (substituem alert() e confirm())
// ---------------------------------------------------------------------

function mostrarToast(mensagem, tipo = 'sucesso') {
    let area = document.querySelector('.adm-toasts');
    if (!area) {
        area = document.createElement('div');
        area.className = 'adm-toasts';
        document.body.appendChild(area);
    }

    const icone = tipo === 'sucesso' ? ICONES.check : (tipo === 'erro' ? ICONES.x : ICONES.alerta);
    const toast = document.createElement('div');
    toast.className = `adm-toast ${tipo}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `${icone}<span>${esc(mensagem)}</span>`;
    area.appendChild(toast);

    const remover = () => {
        toast.classList.add('saindo');
        setTimeout(() => toast.remove(), 300);
    };
    setTimeout(remover, 4000);
    toast.addEventListener('click', remover);
}

// Retorna uma Promise<boolean>: true se o moderador confirmou.
function confirmarAcao({ titulo, texto, textoConfirmar = 'Confirmar', perigo = false }) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'adm-dialog-overlay';
        overlay.innerHTML = `
            <div class="adm-dialog ${perigo ? 'perigo' : ''}" role="alertdialog" aria-modal="true">
                <div class="adm-dialog-icone">${perigo ? ICONES.alerta : ICONES.check}</div>
                <h3>${esc(titulo)}</h3>
                <p>${esc(texto)}</p>
                <div class="adm-dialog-acoes">
                    <button type="button" class="adm-dialog-cancelar">Cancelar</button>
                    <button type="button" class="adm-dialog-confirmar">${esc(textoConfirmar)}</button>
                </div>
            </div>
        `;

        function fechar(resposta) {
            document.removeEventListener('keydown', aoTeclar);
            overlay.remove();
            resolve(resposta);
        }
        function aoTeclar(e) {
            if (e.key === 'Escape') fechar(false);
        }

        overlay.querySelector('.adm-dialog-cancelar').addEventListener('click', () => fechar(false));
        overlay.querySelector('.adm-dialog-confirmar').addEventListener('click', () => fechar(true));
        overlay.addEventListener('click', e => { if (e.target === overlay) fechar(false); });
        document.addEventListener('keydown', aoTeclar);

        document.body.appendChild(overlay);
        overlay.querySelector('.adm-dialog-confirmar').focus();
    });
}

// ---------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------

function mostrarAbaModeracao(aba, botao) {
    document.querySelectorAll('.aba-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(`aba-${aba}`).classList.add('active');
    if (botao) botao.classList.add('active');

    if (aba === 'pendentes') {
        carregarPendentes();
    } else if (aba === 'usuarios') {
        carregarUsuarios();
    } else if (aba === 'pontos') {
        carregarPontos();
    }
}

// ---------------------------------------------------------------------
// Solicitações pendentes
// ---------------------------------------------------------------------

async function carregarPendentes() {
    const lista = document.getElementById('listaPendentes');

    // Esqueleto de carregamento (só se a lista ainda estiver vazia)
    if (!lista.querySelector('.pend-card')) {
        lista.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';
    }

    try {
        const formData = new FormData();
        formData.append('action', 'listar_pendentes');

        const response = await fetch('/api/admin_handler/', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();

        if (result.success) {
            renderizarPendentes(result.pontos);
        } else {
            lista.innerHTML = `<p class="aviso-lista">${esc(result.message)}</p>`;
        }
    } catch (error) {
        console.error('Erro ao carregar solicitações pendentes:', error);
        lista.innerHTML = `<p class="aviso-lista">Erro ao carregar solicitações (${esc(error.message)}).</p>`;
    }
}

function avatarFornecedor(ponto) {
    if (ponto.fotoFornecedor) {
        return `<img class="pend-avatar" src="${esc(ponto.fotoFornecedor)}" alt="" loading="lazy">`;
    }
    const inicial = (ponto.fornecedor || '?').trim().charAt(0).toUpperCase();
    return `<span class="pend-avatar">${esc(inicial)}</span>`;
}

function renderizarPendentes(pontos) {
    const lista = document.getElementById('listaPendentes');

    if (!pontos.length) {
        lista.innerHTML = `
            <div class="aviso-lista">
                <div class="vazio-icone">${ICONES.check}</div>
                <strong>Tudo em dia!</strong>
                Nenhuma solicitação pendente no momento.
            </div>`;
        return;
    }

    lista.innerHTML = pontos.map((ponto, i) => {
        const capa = ponto.fotos[0] || '/static/img/default.jpeg';
        const bio = ponto.bio
            ? esc(ponto.bio.length > 180 ? ponto.bio.slice(0, 180) + '…' : ponto.bio)
            : 'Sem descrição.';
        const contadorFotos = ponto.fotos.length > 1
            ? `<span class="pend-fotos">${ICONES.foto} ${ponto.fotos.length}</span>`
            : '';
        const chipPreco = ponto.faixaPreco
            ? `<span class="pend-chip">${ICONES.preco} ${esc(ponto.faixaPreco)}</span>`
            : '';

        return `
        <article class="pend-card" data-local-id="${ponto.id}" style="animation-delay:${Math.min(i, 8) * 50}ms">
            <div class="pend-media">
                <img src="${esc(capa)}" alt="${esc(ponto.nome)}" loading="lazy"
                     onerror="this.onerror=null;this.src='/static/img/default.jpeg'">
                <span class="pend-tipo">${esc(ponto.tipo)}</span>
                ${contadorFotos}
            </div>
            <div class="pend-body">
                <h3 class="pend-nome">${esc(ponto.nome)}</h3>
                <p class="pend-local">${ICONES.pin}<span>${esc(ponto.localidade)} • ${esc(ponto.endereco)}</span></p>
                <p class="pend-bio">${bio}</p>
                <div class="pend-meta">
                    <span class="pend-autor">${avatarFornecedor(ponto)}<span>Enviado por <strong>${esc(ponto.fornecedor)}</strong></span></span>
                    <span class="pend-chip">${ICONES.calendario} ${formatarData(ponto.dataCadastro)}</span>
                    ${chipPreco}
                </div>
            </div>
            <div class="pend-acoes">
                <button type="button" class="btn-acao btn-acao-ver" onclick="window.open('/visualizar-ponto/?id=${ponto.id}', '_blank')">${ICONES.olho} Ver detalhes</button>
                <button type="button" class="btn-acao btn-acao-aprovar" onclick="aprovarLocal(${ponto.id})">${ICONES.check} Aprovar</button>
                <button type="button" class="btn-acao btn-acao-rejeitar" onclick="abrirModalRejeitar(${ponto.id})">${ICONES.x} Rejeitar</button>
            </div>
        </article>`;
    }).join('');
}

// Some com o card antes de recarregar a lista (transição suave)
function removerCardPendente(id) {
    const card = document.querySelector(`.pend-card[data-local-id="${id}"]`);
    if (!card) return carregarPendentes();
    card.classList.add('saindo');
    setTimeout(carregarPendentes, 350);
}

async function aprovarLocal(id) {
    const confirmacao = await confirmarAcao({
        titulo: 'Aprovar este local?',
        texto: 'Ele ficará visível para todos os usuários.',
        textoConfirmar: 'Aprovar',
    });
    if (!confirmacao) return;

    try {
        const formData = new FormData();
        formData.append('action', 'aprovar');
        formData.append('id', id);

        const response = await fetch('/api/admin_handler/', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.success) {
            mostrarToast('Local aprovado com sucesso!');
            removerCardPendente(id);
            atualizarEstatisticas();
        } else {
            mostrarToast('Erro: ' + result.message, 'erro');
        }
    } catch (error) {
        console.error('Erro ao aprovar local:', error);
        mostrarToast('Erro ao aprovar local.', 'erro');
    }
}

function abrirModalRejeitar(id) {
    idLocalEmRejeicao = id;
    document.getElementById('motivoRejeicao').value = '';
    const modal = document.getElementById('modalRejeitarLocal');
    modal.classList.add('show');
    modal.style.display = 'block';
    setTimeout(() => document.getElementById('motivoRejeicao').focus(), 100);
}

function fecharModalRejeitar() {
    idLocalEmRejeicao = null;
    const modal = document.getElementById('modalRejeitarLocal');
    modal.classList.remove('show');
    modal.style.display = 'none';
}

(function() {
    const form = document.getElementById('formRejeitarLocal');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!idLocalEmRejeicao) return;

        const motivo = document.getElementById('motivoRejeicao').value.trim();
        if (!motivo) {
            mostrarToast('Descreva o motivo da rejeição.', 'aviso');
            return;
        }

        const idRejeitado = idLocalEmRejeicao;

        try {
            const formData = new FormData();
            formData.append('action', 'rejeitar');
            formData.append('id', idRejeitado);
            formData.append('motivo', motivo);

            const response = await fetch('/api/admin_handler/', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.success) {
                fecharModalRejeitar();
                mostrarToast('Local rejeitado.');
                removerCardPendente(idRejeitado);
                atualizarEstatisticas();
            } else {
                mostrarToast('Erro: ' + result.message, 'erro');
            }
        } catch (error) {
            console.error('Erro ao rejeitar local:', error);
            mostrarToast('Erro ao rejeitar local.', 'erro');
        }
    });
})();

document.addEventListener('click', function(event) {
    if (event.target.id === 'modalRejeitarLocal') {
        fecharModalRejeitar();
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('modalRejeitarLocal');
        if (modal && modal.classList.contains('show')) fecharModalRejeitar();
    }
});

// ---------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------

async function carregarUsuarios() {
    try {
        const formData = new FormData();
        formData.append('action', 'listar_usuarios');

        const response = await fetch('/api/admin_handler/', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();

        if (result.success) {
            dadosUsuarios = result.usuarios;
            renderizarUsuarios(dadosUsuarios);
        } else {
            document.getElementById('tabelaUsuarios').innerHTML =
                `<tr><td colspan="6" class="loading">${esc(result.message)}</td></tr>`;
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        document.getElementById('tabelaUsuarios').innerHTML =
            `<tr><td colspan="6" class="loading">Erro ao carregar dados (${esc(error.message)})</td></tr>`;
    }
}

function renderizarUsuarios(usuarios) {
    const tbody = document.getElementById('tabelaUsuarios');

    if (usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Nenhum usuário encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = usuarios.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <img src="${esc(user.fotoPerfil || '/static/img/default_avatar.png')}"
                         alt="${esc(user.nome)}"
                         class="user-avatar"
                         loading="lazy">
                    <div class="user-info">
                        <span class="user-name">${esc(user.nome)}</span>
                    </div>
                </div>
            </td>
            <td>${esc(user.email)}</td>
            <td>
                <span class="badge ${user.isModerador ? 'badge-moderador' : 'badge-turista'}">
                    ${user.isModerador ? 'Moderador' : 'Usuário'}
                </span>
            </td>
            <td>${formatarData(user.dataCriacao)}</td>
            <td>${user.totalPontos} locais</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn btn-delete"
                            onclick="excluirUsuario(${user.id})"
                            title="Excluir usuário"
                            aria-label="Excluir usuário">${ICONES.lixeira}</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function excluirUsuario(id) {
    const confirmacao = await confirmarAcao({
        titulo: 'Excluir este usuário?',
        texto: 'Esta ação não pode ser desfeita.',
        textoConfirmar: 'Excluir',
        perigo: true,
    });
    if (!confirmacao) return;

    try {
        const formData = new FormData();
        formData.append('action', 'excluir_usuario');
        formData.append('id', id);

        const response = await fetch('/api/admin_handler/', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            mostrarToast('Usuário excluído.');
            carregarUsuarios();
            atualizarEstatisticas();
        } else {
            mostrarToast('Erro: ' + result.message, 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarToast('Erro ao excluir usuário', 'erro');
    }
}

// ---------------------------------------------------------------------
// Pontos turísticos (todos, independente do status)
// ---------------------------------------------------------------------

async function carregarPontos() {
    try {
        const formData = new FormData();
        formData.append('action', 'listar_pontos');

        const response = await fetch('/api/admin_handler/', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = await response.json();

        if (result.success) {
            dadosPontos = result.pontos;
            renderizarPontos(dadosPontos);
        } else {
            document.getElementById('tabelaPontos').innerHTML =
                `<tr><td colspan="7" class="loading">${esc(result.message)}</td></tr>`;
        }
    } catch (error) {
        console.error('Erro ao carregar pontos:', error);
        document.getElementById('tabelaPontos').innerHTML =
            `<tr><td colspan="7" class="loading">Erro ao carregar dados (${esc(error.message)})</td></tr>`;
    }
}

function badgeStatus(ponto) {
    const classes = {
        aprovado: 'badge-ativo',
        pendente: 'badge-oculto',
        rejeitado: 'badge-inativo',
    };
    const classe = classes[ponto.status] || 'badge-oculto';
    return `<span class="badge ${classe}">${esc(ponto.statusLabel)}</span>`;
}

function renderizarPontos(pontos) {
    const tbody = document.getElementById('tabelaPontos');

    if (pontos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Nenhum ponto encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = pontos.map(ponto => `
        <tr>
            <td>
                <div class="user-cell">
                    <img src="${esc(ponto.fotoPerfil || '/static/img/default.jpeg')}"
                         alt="${esc(ponto.nome)}"
                         class="user-avatar quadrado"
                         loading="lazy"
                         onerror="this.onerror=null;this.src='/static/img/default.jpeg'">
                    <div class="user-info">
                        <span class="user-name">${esc(ponto.nome)}</span>
                    </div>
                </div>
            </td>
            <td>${esc(ponto.tipo)}</td>
            <td>${esc(ponto.localidade)}</td>
            <td>${esc(ponto.fornecedor)}</td>
            <td>${ponto.avaliacao
                ? '<span class="nota-estrela">★ ' + parseFloat(ponto.avaliacao).toFixed(1) + '</span>'
                : '<span class="sem-nota">Sem avaliações</span>'}</td>
            <td>${badgeStatus(ponto)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn btn-view"
                            onclick="window.open('/visualizar-ponto/?id=${ponto.id}', '_blank')"
                            title="Visualizar"
                            aria-label="Visualizar">${ICONES.olho}</button>
                    <button class="action-btn btn-delete"
                            onclick="excluirPonto(${ponto.id})"
                            title="Excluir"
                            aria-label="Excluir">${ICONES.lixeira}</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function excluirPonto(id) {
    const confirmacao = await confirmarAcao({
        titulo: 'Excluir este ponto turístico?',
        texto: 'Esta ação não pode ser desfeita.',
        textoConfirmar: 'Excluir',
        perigo: true,
    });
    if (!confirmacao) return;

    try {
        const formData = new FormData();
        formData.append('action', 'excluir_ponto');
        formData.append('id', id);

        const response = await fetch('/api/admin_handler/', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            mostrarToast('Ponto excluído.');
            carregarPontos();
            atualizarEstatisticas();
        } else {
            mostrarToast('Erro: ' + result.message, 'erro');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarToast('Erro ao excluir ponto', 'erro');
    }
}

// ---------------------------------------------------------------------
// Busca local nas tabelas já carregadas + estatísticas do topo
// ---------------------------------------------------------------------

function filtrarTabelaModeracao(tipo) {
    if (tipo === 'usuarios') {
        const termo = document.getElementById('searchUsuarios').value.toLowerCase();
        const filtrados = dadosUsuarios.filter(user =>
            (user.nome || '').toLowerCase().includes(termo) ||
            (user.email || '').toLowerCase().includes(termo)
        );
        renderizarUsuarios(filtrados);
    } else if (tipo === 'pontos') {
        const termo = document.getElementById('searchPontos').value.toLowerCase();
        const filtrados = dadosPontos.filter(ponto =>
            (ponto.nome || '').toLowerCase().includes(termo) ||
            (ponto.localidade || '').toLowerCase().includes(termo)
        );
        renderizarPontos(filtrados);
    }
}

function formatarData(dataISO) {
    if (!dataISO) return 'N/A';
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR');
}

// Anima o número de um contador até o novo valor
function animarNumero(elemento, destino) {
    if (!elemento) return;
    const inicio = parseInt(elemento.textContent, 10) || 0;
    if (inicio === destino) { elemento.textContent = destino; return; }

    const duracao = 600;
    const t0 = performance.now();
    function passo(agora) {
        const progresso = Math.min((agora - t0) / duracao, 1);
        const suave = 1 - Math.pow(1 - progresso, 3);
        elemento.textContent = Math.round(inicio + (destino - inicio) * suave);
        if (progresso < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
}

async function atualizarEstatisticas() {
    try {
        const response = await fetch('/api/admin_handler/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'action=estatisticas'
        });

        const result = await response.json();

        if (result.success) {
            animarNumero(document.getElementById('totalUsuarios'), result.stats.usuarios);
            animarNumero(document.getElementById('totalPontos'), result.stats.pontos);
            animarNumero(document.getElementById('totalPendentes'), result.stats.pendentes);
        }
    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    carregarPendentes();
});
