let paginaAtualDestinos = 1;
const itensPorPagina = 6;
let debounceBusca = null;
window.modoVisualizacaoAtual = 'geral';

function filtrarPontos() {
    paginaAtualDestinos = 1;
    clearTimeout(debounceBusca);
    debounceBusca = setTimeout(function() {
        carregarPontos();
        if (typeof window.atualizarMapaDestinos === 'function') {
            window.atualizarMapaDestinos();
        }
    }, 250);
}

async function buscarPontosBackend(tipo, busca) {
    var formData = new FormData();
    formData.append('action', 'listar_por_tipo');
    formData.append('tipo', tipo);
    formData.append('busca', busca);

    var response = await fetch('/api/pontos_handler/', {
        method: 'POST',
        body: formData
    });
    var result = await response.json();
    var pontos = result.success ? result.pontos : [];

    var estado = document.getElementById('filtroEstado').value;
    if (estado) {
        pontos = pontos.filter(function(p) {
            return extrairUF(p.Localidade) === estado;
        });
    }

    return pontos;
}

function extrairUF(localidade) {
    if (!localidade) return '';
    var partes = localidade.split(',');
    var ultima = partes[partes.length - 1].trim();
    return ultima.toUpperCase();
}
window.extrairUF = extrairUF;

async function carregarPontos() {
    var tipo = document.getElementById('filtroTipo').value;
    var busca = document.getElementById('filtroBusca').value.trim();

    var secaoResultados = document.getElementById('secaoResultadosBusca');
    var tituloOutros = document.getElementById('tituloOutrosDestinos');

    try {
        if (busca) {
            // Com termo de busca: mostra os resultados que combinam em
            // destaque no topo, e o restante dos destinos (mesmo tipo,
            // sem o termo) logo abaixo, como "outros destinos".
            var resultados = await buscarPontosBackend(tipo, busca);
            var todos = await buscarPontosBackend(tipo, '');

            var idsResultados = new Set(resultados.map(function(p) { return p.Id; }));
            var outros = todos.filter(function(p) { return !idsResultados.has(p.Id); });

            exibirResultadosBusca(resultados, busca);
            secaoResultados.style.display = 'block';
            tituloOutros.textContent = 'Outros destinos disponíveis';

            exibirPontos(outros);
            criarPaginacao(outros.length);
        } else {
            // Sem busca: comportamento normal, lista única de destinos.
            secaoResultados.style.display = 'none';
            tituloOutros.textContent = 'Destinos disponíveis';

            var pontos = await buscarPontosBackend(tipo, '');
            exibirPontos(pontos);
            criarPaginacao(pontos.length);
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

function renderCardPonto(ponto) {
    var nota = ponto.Avaliacao ? parseFloat(ponto.Avaliacao).toFixed(1) : 'Novo';
    var bio = ponto.Bio || 'Sem descricao';
    var bioTruncada = bio.length > 100 ? bio.substring(0, 100) + '...' : bio;
    var fotoCapa = ponto.Foto_Capa || 'img/default_cover.jpg';
    var fornecedor = ponto.NomeFornecedor || 'Desconhecido';
    var avaliacoes = ponto.Total_Avaliacoes || 0;
    var fotoFornecedor = ponto.FotoFornecedor || 'img/default_avatar.png';
    var idFornecedor = ponto.IdFornecedor || '';

    var html = '';
    html += '<div class="card-ponto" onclick="window.location.href=\'/visualizar-ponto/?id=' + ponto.Id + '\'">';
    html += '<div class="card-img" style="background-image: url(\'' + fotoCapa + '\')">';
    html += '<span class="badge">★ ' + nota + '</span>';
    html += '</div>';
    html += '<div class="card-info">';
    html += '<h3>' + ponto.Nome + '</h3>';
    html += '<p class="card-location">' + ponto.Localidade + '</p>';
    html += '<p class="card-bio">' + bioTruncada + '</p>';
    html += '<div class="card-footer">';
    html += '<div class="carousel-creator-wrapper" onclick="event.stopPropagation(); window.location.href=\'/perfil-publico/?id=' + idFornecedor + '\'">';
    html += '<img src="' + fotoFornecedor + '" alt="' + fornecedor + '" class="carousel-creator-avatar">';
    html += '<span>Criado por ' + fornecedor + '</span>';
    html += '</div>';
    html += '<span>' + avaliacoes + ' avaliações</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    return html;
}

function exibirResultadosBusca(pontos, termo) {
    var titulo = document.getElementById('tituloResultadosBusca');
    titulo.textContent = pontos.length > 0
        ? 'Resultados para "' + termo + '" (' + pontos.length + ')'
        : 'Resultados para "' + termo + '"';

    var grid = document.getElementById('gridResultados');
    if (pontos.length === 0) {
        grid.innerHTML = '<p class="aviso-vazio">Nenhum resultado encontrado para "' + termo + '".</p>';
        return;
    }
    grid.innerHTML = pontos.map(renderCardPonto).join('');
}

function exibirPontos(pontos) {
    var grid = document.getElementById('gridPontos');

    if (pontos.length === 0) {
        grid.innerHTML = '<p class="aviso-vazio">Nenhum ponto turistico encontrado</p>';
        return;
    }

    var inicio = (paginaAtualDestinos - 1) * itensPorPagina;
    var fim = inicio + itensPorPagina;
    var pontosPagina = pontos.slice(inicio, fim);

    grid.innerHTML = pontosPagina.map(renderCardPonto).join('');
}

function criarPaginacao(total) {
    var totalPaginas = Math.ceil(total / itensPorPagina);
    var paginacao = document.getElementById('paginacao');
    
    if (totalPaginas <= 1) {
        paginacao.innerHTML = '';
        return;
    }
    
    var html = '';
    for (var i = 1; i <= totalPaginas; i++) {
        var ativo = i === paginaAtualDestinos ? 'active' : '';
        html += '<button class="btn-pagina ' + ativo + '" onclick="irParaPagina(' + i + ')">' + i + '</button>';
    }
    
    paginacao.innerHTML = html;
}

function irParaPagina(pagina) {
    paginaAtualDestinos = pagina;
    carregarPontos();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', function() {
    var params = new URLSearchParams(window.location.search);
    var buscaUrl = params.get('busca');
    if (buscaUrl) {
        document.getElementById('filtroBusca').value = buscaUrl;
    }
    carregarPontos();
});