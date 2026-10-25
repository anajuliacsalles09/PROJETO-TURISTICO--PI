"""Geocodificação de endereços em latitude/longitude, usada para plotar os
pontos turísticos no mapa da página de destinos.

Usa o Nominatim (serviço gratuito de geocodificação do OpenStreetMap), que
não exige chave de API. É respeitado o limite de uso deles: no máximo 1
requisição por segundo e um User-Agent identificando a aplicação.

Se o endereço não for encontrado, ou se o serviço estiver fora do ar (sem
internet, timeout, etc.), retorna (None, None) sem levantar exceção — o
cadastro do ponto turístico continua funcionando normalmente, só sem
aparecer no mapa até alguém corrigir o endereço.
"""
import json
import time
import urllib.parse
import urllib.request

NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
USER_AGENT = 'TaNoMapaProjetoTuristico/1.0 (projeto academico)'
TIMEOUT_SEGUNDOS = 5


def _consultar_nominatim(query):
    """Faz uma única consulta ao Nominatim. Retorna (lat, lon) ou (None, None)."""
    if not query:
        return None, None

    params = urllib.parse.urlencode({
        'q': query,
        'format': 'json',
        'limit': 1,
        'countrycodes': 'br',
    })
    url = f'{NOMINATIM_URL}?{params}'
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})

    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SEGUNDOS) as resposta:
            dados = json.loads(resposta.read().decode('utf-8'))
    except Exception:
        # Sem internet, timeout, serviço fora do ar, resposta inesperada,
        # etc. — falha silenciosa, não deve travar o cadastro do local.
        return None, None

    if not dados:
        return None, None

    try:
        return float(dados[0]['lat']), float(dados[0]['lon'])
    except (KeyError, ValueError, TypeError):
        return None, None


def geocodificar_endereco(endereco, localidade):
    """Retorna (latitude, longitude) como floats, ou (None, None) se não
    conseguir localizar o endereço.

    Endereços muito específicos (com CEP, nome de estabelecimento, "s/n",
    "Zona Rural" etc.) às vezes não são reconhecidos pelo Nominatim. Por
    isso, se a busca com o endereço completo falhar, tentamos de novo só
    com a cidade/estado antes de desistir — o pin fica menos preciso
    (cai no centro da cidade), mas pelo menos aparece no mapa."""
    endereco = (endereco or '').strip()
    localidade = (localidade or '').strip()

    partes_completas = [p for p in [endereco, localidade, 'Brasil'] if p]
    query_completa = ', '.join(partes_completas)

    lat, lon = _consultar_nominatim(query_completa)
    if lat is not None:
        return lat, lon

    if localidade:
        time.sleep(1)  # respeita o limite de 1 requisição/segundo do Nominatim
        query_simples = f'{localidade}, Brasil'
        lat, lon = _consultar_nominatim(query_simples)
        if lat is not None:
            return lat, lon

    return None, None