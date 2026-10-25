from django.contrib.auth.decorators import login_required
from django.db.models import Avg, Count
from django.http import Http404
from django.shortcuts import get_object_or_404, render

from core.models import PontoTuristico


@login_required
def destinos_view(request):
    return render(request, 'destinos/destinos.html')


@login_required
def visualizar_ponto_view(request):
    ponto_id = request.GET.get('id')
    if not ponto_id:
        raise Http404('Ponto turístico não informado')

    ponto = get_object_or_404(
        PontoTuristico.objects.select_related('fornecedor').prefetch_related('fotos').annotate(
            avaliacao_media=Avg('avaliacoes__nota'),
            total_avaliacoes=Count('avaliacoes'),
        ),
        id=ponto_id,
    )

    is_autor = (
        request.user.is_authenticated
        and ponto.fornecedor_id == request.user.id
    )
    is_moderador = request.user.is_authenticated and request.user.is_moderador

    # Locais pendentes/rejeitados só podem ser vistos por quem os
    # cadastrou ou por um moderador — para os demais usuários, é como se
    # a solicitação ainda não existisse.
    if not ponto.esta_aprovado and not is_autor and not is_moderador:
        raise Http404('Ponto turístico não encontrado')

    return render(request, 'destinos/visualizar_ponto.html', {
        'ponto': ponto,
        'is_autor': is_autor,
    })
