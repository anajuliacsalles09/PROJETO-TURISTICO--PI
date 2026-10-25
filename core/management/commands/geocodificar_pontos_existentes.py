import time

from django.core.management.base import BaseCommand

from core.geocoding import geocodificar_endereco
from core.models import PontoTuristico


class Command(BaseCommand):
    help = (
        'Busca a latitude/longitude de todos os pontos turísticos que ainda '
        'não têm essa informação (cadastrados antes da funcionalidade de '
        'mapa), pra eles passarem a aparecer no mapa de destinos.'
    )

    def handle(self, *args, **options):
        pontos = PontoTuristico.objects.filter(latitude__isnull=True)
        total = pontos.count()

        if total == 0:
            self.stdout.write(self.style.SUCCESS('Nenhum ponto pendente. Todos já têm localização.'))
            return

        self.stdout.write(f'Encontrados {total} ponto(s) sem localização. Buscando...')

        sucesso = 0
        falha = 0

        for indice, ponto in enumerate(pontos, start=1):
            lat, lon = geocodificar_endereco(ponto.endereco, ponto.localidade)

            if lat is not None and lon is not None:
                ponto.latitude = lat
                ponto.longitude = lon
                ponto.save(update_fields=['latitude', 'longitude'])
                sucesso += 1
                self.stdout.write(f'  [{indice}/{total}] OK: {ponto.nome}')
            else:
                falha += 1
                self.stdout.write(self.style.WARNING(
                    f'  [{indice}/{total}] Não encontrado: {ponto.nome} '
                    f'({ponto.endereco}, {ponto.localidade})'
                ))

            # Respeita o limite de uso do Nominatim (1 requisição/segundo).
            if indice < total:
                time.sleep(1)

        self.stdout.write(self.style.SUCCESS(
            f'Concluído: {sucesso} localizado(s), {falha} não encontrado(s).'
        ))
        if falha:
            self.stdout.write(
                'Pontos não encontrados provavelmente têm endereço incompleto '
                'ou impreciso — edite o endereço deles pelo site pra tentar de novo.'
            )
            