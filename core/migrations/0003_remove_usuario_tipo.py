from django.db import migrations


class Migration(migrations.Migration):
    """Remove a distinção de tipo de conta (Turista/Fornecedor): agora
    existe um único tipo de usuário, que acumula as duas funções."""

    dependencies = [
        ('core', '0002_pontoturistico_latitude_longitude'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='usuario',
            name='tipo',
        ),
    ]
