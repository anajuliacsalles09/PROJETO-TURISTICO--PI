from django.contrib.auth.hashers import make_password
from django.db import migrations

EMAIL_MODERADOR = 'moderador@tanomapa.com'
SENHA_MODERADOR = 'Moderador@123'


def criar_moderador_padrao(apps, schema_editor):
    Usuario = apps.get_model('core', 'Usuario')
    if Usuario.objects.filter(email__iexact=EMAIL_MODERADOR).exists():
        return
    Usuario.objects.create(
        email=EMAIL_MODERADOR,
        nome='Moderação Ta no Mapa',
        password=make_password(SENHA_MODERADOR),
        is_moderador=True,
        is_active=True,
        is_staff=False,
        is_superuser=False,
    )


def remover_moderador_padrao(apps, schema_editor):
    Usuario = apps.get_model('core', 'Usuario')
    Usuario.objects.filter(email__iexact=EMAIL_MODERADOR).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_moderacao'),
    ]

    operations = [
        migrations.RunPython(criar_moderador_padrao, remover_moderador_padrao),
    ]
