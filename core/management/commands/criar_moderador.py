from django.core.management.base import BaseCommand, CommandError

from core.models import Usuario


class Command(BaseCommand):
    help = (
        'Cria um novo usuário moderador ou promove um usuário já existente '
        '(identificado pelo e-mail) a moderador.'
    )

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='E-mail do moderador')
        parser.add_argument(
            '--nome', type=str, default=None,
            help='Nome do moderador (obrigatório ao criar um usuário novo)',
        )
        parser.add_argument(
            '--senha', type=str, default=None,
            help='Senha (obrigatória ao criar um usuário novo)',
        )

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        nome = options['nome']
        senha = options['senha']

        usuario = Usuario.objects.filter(email__iexact=email).first()

        if usuario:
            usuario.is_moderador = True
            usuario.save(update_fields=['is_moderador'])
            self.stdout.write(self.style.SUCCESS(
                f'Usuário "{usuario.email}" agora é moderador.'
            ))
            return

        if not nome or not senha:
            raise CommandError(
                'Usuário não encontrado. Para criar um novo, informe --nome e --senha.'
            )

        usuario = Usuario.objects.create_user(email=email, nome=nome, password=senha)
        usuario.is_moderador = True
        usuario.save(update_fields=['is_moderador'])
        self.stdout.write(self.style.SUCCESS(
            f'Moderador "{usuario.email}" criado com sucesso.'
        ))
