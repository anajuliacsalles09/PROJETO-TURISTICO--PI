from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Avaliacao, FotoPonto, PontoTuristico, Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    model = Usuario
    ordering = ('nome',)
    list_display = ('nome', 'email', 'is_moderador', 'is_staff')
    list_filter = ('is_moderador', 'is_staff', 'is_superuser')
    search_fields = ('nome', 'email')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Dados pessoais', {'fields': (
            'nome', 'telefone', 'cpf', 'cnpj',
            'data_nascimento', 'bio', 'foto_perfil', 'foto_capa',
        )}),
        ('Permissões', {'fields': (
            'is_active', 'is_moderador', 'is_staff', 'is_superuser', 'groups', 'user_permissions',
        )}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'nome', 'password1', 'password2'),
        }),
    )


class FotoPontoInline(admin.TabularInline):
    model = FotoPonto
    extra = 0
    max_num = PontoTuristico.MAX_FOTOS
    fields = ('imagem', 'ordem')


@admin.register(PontoTuristico)
class PontoTuristicoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'tipo', 'localidade', 'faixa_preco', 'fornecedor', 'status')
    search_fields = ('nome', 'localidade')
    list_filter = ('status', 'tipo', 'faixa_preco')
    inlines = [FotoPontoInline]
    actions = ['aprovar_pontos', 'rejeitar_pontos']

    @admin.action(description='Aprovar locais selecionados')
    def aprovar_pontos(self, request, queryset):
        from django.utils import timezone
        queryset.update(
            status=PontoTuristico.STATUS_APROVADO,
            moderado_por=request.user,
            data_moderacao=timezone.now(),
            motivo_rejeicao=None,
        )

    @admin.action(description='Rejeitar locais selecionados')
    def rejeitar_pontos(self, request, queryset):
        from django.utils import timezone
        queryset.update(
            status=PontoTuristico.STATUS_REJEITADO,
            moderado_por=request.user,
            data_moderacao=timezone.now(),
        )


admin.site.register(Avaliacao)
