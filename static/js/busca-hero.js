

console.log('INICIANDO BUSCA-HERO.JS');

let todosLocaisDisponiveis = [];
let debounceTimer = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM CARREGADO');
    carregarLocaisDisponiveis();
    configurarBuscaHero();
});

async function carregarLocaisDisponiveis() {
    try {
        console.log('Carregando todos os locais...');
        
        const formData = new FormData();
        formData.append('action', 'listar_todos'); 

        const response = await fetch('/api/pontos_handler/', { 
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('JSON Parseado:', result);

        if (result.success && result.pontos) {
            todosLocaisDisponiveis = result.pontos;
            console.log('SUCESSO!', todosLocaisDisponiveis.length, 'locais carregados');
            return true;
        } else {
            console.error('Resposta sem sucesso:', result);
            return false;
        }
        
    } catch (error) {
        console.error('Erro ao carregar:', error);
        return false;
    }
}

function configurarBuscaHero() {
    console.log('Configurando eventos da busca hero...');
    
    const inputBusca = document.getElementById('inputBuscaHero');
    const btnBuscar = document.querySelector('.search-btn');
    
    if (!inputBusca) {
        console.error('Input inputBuscaHero não encontrado!');
        return;
    }
    
    console.log('Input encontrado:', inputBusca);
    
    let suggestoesDiv = document.getElementById('sugestoesHero');
    
    if (!suggestoesDiv) {
        suggestoesDiv = document.createElement('div');
        suggestoesDiv.id = 'sugestoesHero';
        suggestoesDiv.className = 'sugestoes-hero';
        
        const searchBox = inputBusca.closest('.search-box');
        if (searchBox) {
            searchBox.appendChild(suggestoesDiv);
            console.log('Container de sugestões criado');
        }
    }

    inputBusca.addEventListener('input', function(e) {
        const termo = e.target.value.trim();
        
        clearTimeout(debounceTimer);
        
        if (termo.length >= 2) {
            console.log('⌨️ Buscando:', termo);
            debounceTimer = setTimeout(() => {
                buscarLocaisHero(termo);
            }, 300);
        } else {
            ocultarSugestoesHero();
        }
    });

    inputBusca.addEventListener('focus', function(e) {
        const termo = e.target.value.trim();
        if (termo.length >= 2) {
            buscarLocaisHero(termo);
        }
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-box')) {
            ocultarSugestoesHero();
        }
    });

    if (btnBuscar) {
        btnBuscar.addEventListener('click', function(e) {
            e.preventDefault();
            executarBuscaHero();
        });
    }

    inputBusca.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            executarBuscaHero();
        }
    });
    
    console.log('Todos os eventos configurados!');
}

function buscarLocaisHero(termo) {
    console.log('Buscando locais para:', termo);
    console.log('Total de locais disponíveis:', todosLocaisDisponiveis.length);
    
    if (todosLocaisDisponiveis.length === 0) {
        console.warn('Nenhum local carregado ainda. Tentando carregar...');
        carregarLocaisDisponiveis().then(() => {
            if (todosLocaisDisponiveis.length > 0) {
                buscarLocaisHero(termo);
            }
        });
        return;
    }
    
    const termoNorm = normalizarTexto(termo);
    console.log('Termo normalizado:', termoNorm);
    
    const resultados = todosLocaisDisponiveis.filter(local => {
        const nome = normalizarTexto(local.Nome || '');
        const localidade = normalizarTexto(local.Localidade || '');
        const tipo = normalizarTexto(local.Tipo || '');
        const bio = normalizarTexto(local.Bio || '');
        
        return nome.includes(termoNorm) || 
               localidade.includes(termoNorm) ||
               tipo.includes(termoNorm) ||
               bio.includes(termoNorm);
    });

    resultados.sort((a, b) => {
        const nomeA = normalizarTexto(a.Nome || '');
        const nomeB = normalizarTexto(b.Nome || '');
        
        const matchA = nomeA.startsWith(termoNorm);
        const matchB = nomeB.startsWith(termoNorm);
        
        if (matchA && !matchB) return -1;
        if (!matchA && matchB) return 1;
        return nomeA.localeCompare(nomeB);
    });

    console.log('', resultados.length, 'resultados encontrados');
    
    if (resultados.length > 0) {
        console.log('Primeiros resultados:', resultados.slice(0, 3).map(r => r.Nome));
    }
    
    exibirSugestoesHero(resultados.slice(0, 8), termo);
}

function exibirSugestoesHero(resultados, termo) {
    const suggestoesDiv = document.getElementById('sugestoesHero');
    
    if (!suggestoesDiv) {
        console.error('Container de sugestões não existe!');
        return;
    }

    if (resultados.length === 0) {
        suggestoesDiv.innerHTML = `
            <div class="sugestao-vazia-hero">
                <span style="font-size: 2rem; display: block; margin-bottom: 8px;"></span>
                <p style="margin: 0 0 4px 0; font-weight: 600; color: #333;">Nenhum local encontrado</p>
                <small style="color: #666;">Tente buscar por "praia", "museu" ou nome de cidade</small>
            </div>
        `;
        suggestoesDiv.classList.add('show');
        return;
    }

    suggestoesDiv.innerHTML = resultados.map(local => {
        
        const foto = local.Foto_Capa || local.Foto_Perfil || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23999" font-size="14" dy=".3em"%3ESem Foto%3C/text%3E%3C/svg%3E';
        const nomeDestacado = destacarTermo(local.Nome, termo);
        const nomeEscapado = (local.Nome || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
        
        return `
            <div class="sugestao-item-hero" onclick="selecionarLocalHero(${local.Id}, '${nomeEscapado}')">
                <img src="${foto}" 
                     alt="${local.Nome}" 
                     class="sugestao-foto-hero" 
                     onerror="this.style.display='none'">
                <div class="sugestao-info-hero">
                    <div class="sugestao-nome-hero">${nomeDestacado}</div>
                    <div class="sugestao-detalhes-hero">
                        <span>${local.Tipo || 'Local'}</span>
                        <span style="color: #ccc; margin: 0 6px;">•</span>
                        <span>${local.Localidade || 'Localização não informada'}</span>
                    </div>
                </div>
                <div class="sugestao-seta-hero">→</div>
            </div>
        `;
    }).join('');

    suggestoesDiv.classList.add('show');
    console.log('Sugestões exibidas!');
}

function ocultarSugestoesHero() {
    const suggestoesDiv = document.getElementById('sugestoesHero');
    if (suggestoesDiv) {
        suggestoesDiv.classList.remove('show');
    }
}

window.selecionarLocalHero = function(id, nome) {
    console.log('Local selecionado:', id, nome);
    window.location.href = `/visualizar-ponto/?id=${id}`;
}

function executarBuscaHero() {
    const inputBusca = document.getElementById('inputBuscaHero');
    const termo = inputBusca ? inputBusca.value.trim() : '';

    console.log('Executando busca completa:', termo);

    if (!termo) {
        alert('Digite algo para buscar');
        return;
    }

    window.location.href = `/destinos/?busca=${encodeURIComponent(termo)}`;
}

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function destacarTermo(texto, termo) {
    if (!termo || !texto) return texto;
    
    const regex = new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return texto.replace(regex, '<mark style="background: #fef3c7; color: #92400e; padding: 2px 4px; border-radius: 3px; font-weight: 600;">$1</mark>');
}

window.debugBuscaHero = function() {
    console.log('DEBUG BUSCA HERO:');
    console.log('- Locais carregados:', todosLocaisDisponiveis.length);
    console.log('- Input existe?', !!document.getElementById('inputBuscaHero'));
    console.log('- Container existe?', !!document.getElementById('sugestoesHero'));
    
    if (todosLocaisDisponiveis.length > 0) {
        console.log('- Primeiro local:', todosLocaisDisponiveis[0]);
    }
}

console.log('Script busca-hero.js carregado completamente');