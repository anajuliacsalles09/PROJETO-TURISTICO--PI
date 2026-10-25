import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def aprovar_pontos_existentes(apps, schema_editor):
    """Locais cadastrados antes da moderação existir já estavam
    publicados no site, então são marcados como aprovados
    retroativamente (senão sumiriam das listagens públicas)."""
    PontoTuristico = apps.get_model('core', 'PontoTuristico')
    PontoTuristico.objects.update(status='aprovado')


def reverter_status(apps, schema_editor):
    PontoTuristico = apps.get_model('core', 'PontoTuristico')
    PontoTuristico.objects.update(status='pendente')


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0003_remove_usuario_tipo'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuario',
            name='is_moderador',
            field=models.BooleanField(
                default=False,
                help_text='Usuários moderadores podem aprovar ou rejeitar os locais enviados pelos turistas.',
                verbose_name='Moderador',
            ),
        ),
        migrations.AddField(
            model_name='pontoturistico',
            name='status',
            field=models.CharField(
                choices=[('pendente', 'Pendente'), ('aprovado', 'Aprovado'), ('rejeitado', 'Rejeitado')],
                default='pendente',
                max_length=10,
                verbose_name='Status',
            ),
        ),
        migrations.AddField(
            model_name='pontoturistico',
            name='motivo_rejeicao',
            field=models.TextField(blank=True, null=True, verbose_name='Motivo da rejeição'),
        ),
        migrations.AddField(
            model_name='pontoturistico',
            name='data_moderacao',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Data da moderação'),
        ),
        migrations.AddField(
            model_name='pontoturistico',
            name='moderado_por',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='pontos_moderados',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Moderado por',
            ),
        ),
        migrations.RunPython(aprovar_pontos_existentes, reverter_status),
    ]
