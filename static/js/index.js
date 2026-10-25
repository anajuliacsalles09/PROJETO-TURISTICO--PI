




let posicaoCarousel = 0;
let animacaoCarousel = null;
let carouselPausado = false;





async function carregarTop5Pontos() {
    console.log('Iniciando carregamento do Top 5...');
    
    try {
        const formData = new FormData();
        formData.append('action', 'top5');

        const response = await fetch('/api/pontos_handler/', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        console.log('Resultado Top 5:', result);
        
        const carousel = document.getElementById('carouselTop5');
        
        if (!carousel) {
            console.error('Elemento carouselTop5 não encontrado!');
            return;
        }
        
        if (result.success && result.pontos && result.pontos.length > 0) {
            const pontosDuplicados = [...result.pontos, ...result.pontos];
            
            carousel.innerHTML = pontosDuplicados.map(ponto => {
                const fotoFornecedor = ponto.FotoFornecedor || 'img/default_avatar.png';
                const idFornecedor = ponto.IdFornecedor || '';
                
                return `
                <div class="carousel-card" onclick="window.location.href='/visualizar-ponto/?id=${ponto.Id}'">
                    <div class="carousel-img" style="background-image: url('${ponto.Foto_Capa || 'img/default_cover.jpg'}');">
                        <span class="badge">★ ${parseFloat(ponto.Avaliacao).toFixed(1)}</span>
                    </div>
                    <div class="carousel-info">
                        <h3>${ponto.Nome}</h3>
                        <p class="carousel-location">${ponto.Localidade || 'Localização não informada'}</p>
                        <p class="carousel-bio">${(ponto.Bio || 'Sem descrição disponível').substring(0, 80)}${ponto.Bio && ponto.Bio.length > 80 ? '...' : ''}</p>
                        <div class="carousel-footer">
                            <div class="carousel-creator-wrapper" onclick="event.stopPropagation(); window.location.href='/perfil-publico/?id=${idFornecedor}'">
                                <img src="${fotoFornecedor}" alt="${ponto.NomeFornecedor}" class="carousel-creator-avatar">
                                <span class="carousel-creator">${ponto.NomeFornecedor || 'Fornecedor'}</span>
                            </div>
                            <span class="carousel-avaliacoes">${ponto.Total_Avaliacoes || 0} avaliações</span>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
            
            console.log('Cards criados, iniciando animação...');
            iniciarCarouselTop5();
        } else {
            console.log('Nenhum ponto avaliado ainda');
            carousel.innerHTML = '<p class="loading-carousel">Ainda não há destinos avaliados. Seja o primeiro a avaliar um local!</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar top 5:', error);
        const carousel = document.getElementById('carouselTop5');
        if (carousel) {
            carousel.innerHTML = '<p class="loading-carousel">Erro ao carregar destinos</p>';
        }
    }
}

function iniciarCarouselTop5() {
    const track = document.getElementById('carouselTop5');
    if (!track) return;
    
    const velocidade = 0.5;
    
    function animar() {
        if (!carouselPausado) {
            posicaoCarousel -= velocidade;
            track.style.transform = `translateX(${posicaoCarousel}px)`;
            
            if (Math.abs(posicaoCarousel) >= track.scrollWidth / 2) {
                posicaoCarousel = 0;
            }
        }
        
        animacaoCarousel = requestAnimationFrame(animar);
    }
    
    animar();
    
    track.addEventListener('mouseenter', function() {
        carouselPausado = true;
    });
    
    track.addEventListener('mouseleave', function() {
        carouselPausado = false;
    });
}

window.moverCarousel = function(direcao) {
    const track = document.getElementById('carouselTop5');
    if (!track) return;
    
    const cardWidth = 370;
    posicaoCarousel += (direcao * cardWidth * -1);
    
    const maxScroll = -(track.scrollWidth / 2);
    if (posicaoCarousel < maxScroll) {
        posicaoCarousel = 0;
    } else if (posicaoCarousel > 0) {
        posicaoCarousel = maxScroll;
    }
    
    track.style.transition = 'transform 0.5s ease';
    track.style.transform = `translateX(${posicaoCarousel}px)`;
    
    setTimeout(() => {
        track.style.transition = '';
    }, 500);
}





function configurarBuscaHero() {
    const form = document.getElementById('formBuscaHero');
    if (!form) return;

    const logado = form.dataset.logado === '1';
    const urlCadastro = form.dataset.urlCadastro;

    if (logado) return; // segue o comportamento normal do form (GET pra destinos)

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        window.location.href = urlCadastro;
    });
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('index.js carregado (apenas carousel)!');
    carregarTop5Pontos();
    configurarBuscaHero();
});


