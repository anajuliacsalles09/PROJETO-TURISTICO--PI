// Mapa de destinos (visualização alternativa à lista, na página de destinos).
// Usa Leaflet + tiles do OpenStreetMap (gratuito, sem chave de API).

let mapaDestinosInstancia = null;
let marcadoresDestinos = [];
const CENTRO_BRASIL = [-14.235, -51.9253];
const ZOOM_INICIAL_BRASIL = 4;
const ZOOM_MINIMO_BRASIL = 4;
// Retângulo que cobre o território brasileiro (com uma margem), usado para
// travar o mapa e impedir que o usuário arraste/afaste até ver outros
// países ou o oceano vazio nas bordas.
const LIMITES_BRASIL = [
    [-35.5, -76.0],  // sudoeste
    [7.0, -28.0],    // nordeste
];

function garantirMapaInicializado() {
    if (mapaDestinosInstancia) return mapaDestinosInstancia;
    if (typeof L === 'undefined') {
        // Leaflet vem de um CDN (unpkg): sem internet ele não carrega.
        console.error('Leaflet não carregou. Verifique a conexão com a internet.');
        return null;
    }

    mapaDestinosInstancia = L.map('mapaDestinos', {
        minZoom: ZOOM_MINIMO_BRASIL,
        maxBounds: LIMITES_BRASIL,
        maxBoundsViscosity: 1.0
    }).setView(CENTRO_BRASIL, ZOOM_INICIAL_BRASIL);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapaDestinosInstancia);

    return mapaDestinosInstancia;
}

function limparMarcadores() {
    marcadoresDestinos.forEach(function(marcador) {
        marcador.remove();
    });
    marcadoresDestinos = [];
}

function renderPopupPonto(ponto) {
    var nota = ponto.Avaliacao ? parseFloat(ponto.Avaliacao).toFixed(1) : 'Novo';
    var html = '<div class="popup-mapa-ponto">';
    html += '<strong>' + ponto.Nome + '</strong><br>';
    html += '<span>' + ponto.Tipo + ' · ' + ponto.Localidade + '</span><br>';
    html += '<span>★ ' + nota + '</span><br>';
    html += '<a href="/visualizar-ponto/?id=' + ponto.Id + '">Ver detalhes</a>';
    html += '</div>';
    return html;
}

async function atualizarMapaDestinos() {
    var secaoMapa = document.getElementById('secaoMapa');
    if (!secaoMapa || secaoMapa.style.display === 'none') return;

    var tipo = document.getElementById('filtroTipo').value;
    var busca = document.getElementById('filtroBusca').value.trim();

    var pontos;
    try {
        pontos = await buscarPontosBackend(tipo, busca);
    } catch (erro) {
        console.error('Erro ao buscar pontos para o mapa:', erro);
        pontos = [];
    }
    var comLocalizacao = pontos.filter(function(p) {
        return p.Latitude !== null && p.Latitude !== undefined
            && p.Longitude !== null && p.Longitude !== undefined;
    });

    var mapa = garantirMapaInicializado();
    if (!mapa) return;
    limparMarcadores();

    var avisoVazio = document.getElementById('avisoMapaVazio');
    avisoVazio.style.display = comLocalizacao.length === 0 ? 'block' : 'none';

    comLocalizacao.forEach(function(ponto) {
        var marcador = L.marker([ponto.Latitude, ponto.Longitude])
            .addTo(mapa)
            .bindPopup(renderPopupPonto(ponto));
        marcadoresDestinos.push(marcador);
    });

    // O mapa sempre parte da visão do Brasil inteiro (definida uma única
    // vez em garantirMapaInicializado) e o zoom/posição ficam livres pra
    // o usuário navegar — não damos zoom automático nos marcadores, senão
    // com poucos pontos cadastrados o mapa fica com o zoom muito apertado.
}
window.atualizarMapaDestinos = atualizarMapaDestinos;

function mudarVisualizacao(modo) {
    window.modoVisualizacaoAtual = modo;

    var secaoLista = document.getElementById('secaoLista');
    var secaoMapa = document.getElementById('secaoMapa');
    var btnGeral = document.getElementById('btnVisualizacaoGeral');
    var btnLista = document.getElementById('btnVisualizacaoLista');
    var btnMapa = document.getElementById('btnVisualizacaoMapa');

    btnGeral.classList.remove('active');
    btnLista.classList.remove('active');
    btnMapa.classList.remove('active');

    if (modo === 'geral') {
        // Mapa e lista juntos, com os filtros aplicados normalmente.
        secaoMapa.style.display = 'block';
        secaoLista.style.display = 'block';
        btnGeral.classList.add('active');
    } else if (modo === 'mapa') {
        // Só o mapa, respeitando os filtros escolhidos.
        secaoLista.style.display = 'none';
        secaoMapa.style.display = 'block';
        btnMapa.classList.add('active');
    } else {
        // Só a lista, respeitando os filtros escolhidos.
        secaoMapa.style.display = 'none';
        secaoLista.style.display = 'block';
        btnLista.classList.add('active');
    }

    if (typeof carregarPontos === 'function') {
        carregarPontos();
    }

    if (secaoMapa.style.display !== 'none') {
        // O Leaflet precisa saber o tamanho do container depois que ele
        // fica visível (senão o mapa renderiza com tamanho errado/cinza).
        setTimeout(function() {
            var mapa = garantirMapaInicializado();
            if (!mapa) return;
            mapa.invalidateSize();
            atualizarMapaDestinos();
        }, 0);
    }
}
window.mudarVisualizacao = mudarVisualizacao;

document.addEventListener('DOMContentLoaded', function() {
    // "Geral" é o modo padrão: mapa e lista aparecem juntos ao entrar em
    // Destinos.
    setTimeout(function() {
        var mapa = garantirMapaInicializado();
        if (!mapa) return;
        mapa.invalidateSize();
        atualizarMapaDestinos();
    }, 0);
});