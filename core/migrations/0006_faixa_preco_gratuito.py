from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_criar_moderador_padrao'),
    ]

    operations = [
        migrations.AlterField(
            model_name='pontoturistico',
            name='faixa_preco',
            field=models.CharField(
                choices=[
                    ('Gratuito', '🆓 Gratuito'),
                    ('Baixo', '💰 Baixo'),
                    ('Médio', '💰💰 Médio'),
                    ('Elevado', '💰💰💰 Elevado'),
                ],
                default='Médio', max_length=10, verbose_name='Faixa de preço',
            ),
        ),
    ]
