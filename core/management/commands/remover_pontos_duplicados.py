from django.core.management.base import BaseCommand

from core.models import PontoTuristico


class Command(BaseCommand):
    help = (
        'Encontra pontos turísticos duplicados (mesmo autor, nome, localidade '
        'e endereço). Sem argumentos, só lista o que seria apagado. Com '
        '--aplicar, apaga as cópias e mantém uma de cada (a aprovada, se '
        'houver; senão a mais antiga).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--aplicar', action='store_true',
            help='Apaga de verdade as cópias (sem isso, é só uma simulação).',
        )

    def handle(self, *args, **options):
        grupos = {}
        for ponto in PontoTuristico.objects.order_by('id'):
            chave = (
                ponto.fornecedor_id,
                (ponto.nome or '').strip().lower(),
                (ponto.localidade or '').strip().lower(),
                (ponto.endereco or '').strip().lower(),
            )
            grupos.setdefault(chave, []).append(ponto)

        total_copias = 0
        for pontos in grupos.values():
            if len(pontos) < 2:
                continue

            manter = next(
                (p for p in pontos if p.status == PontoTuristico.STATUS_APROVADO),
                pontos[0],
            )
            copias = [p for p in pontos if p.id != manter.id]
            total_copias += len(copias)

            self.stdout.write(
                f'"{manter.nome}" ({manter.localidade}): mantendo id {manter.id}, '
                f'cópias: {", ".join("id " + str(c.id) for c in copias)}'
            )
            if options['aplicar']:
                for copia in copias:
                    copia.delete()

        if total_copias == 0:
            self.stdout.write(self.style.SUCCESS('Nenhum ponto duplicado encontrado.'))
        elif options['aplicar']:
            self.stdout.write(self.style.SUCCESS(f'{total_copias} cópia(s) apagada(s).'))
        else:
            self.stdout.write(self.style.WARNING(
                f'{total_copias} cópia(s) encontrada(s). Para apagar, rode de novo com --aplicar.'
            ))
