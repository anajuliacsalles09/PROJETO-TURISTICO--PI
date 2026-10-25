import json
import unicodedata
from datetime import timedelta
from functools import wraps

from django.contrib.auth import logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.db.models import Avg, Count, Max
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .geocoding import geocodificar_endereco
from .models import Avaliacao, FotoPonto, PontoTuristico, Usuario


def moderador_required(view_func):
    """Restringe a view a usuários autenticados com is_moderador=True.
    Usada nas páginas do painel de moderação."""

    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('login')
        if not request.user.is_moderador:
            return redirect('index')
        return view_func(request, *args, **kwargs)

    return _wrapped


def _normalizar_texto(texto):
    """Minúsculas e sem acentos, para busca igual à usada em busca-hero.js
    (ex.: 'Açaí' e 'acai' devem casar)."""
    texto = texto or ''
    texto = unicodedata.normalize('NFD', texto)
    texto = ''.join(c for c in texto if unicodedata.category(c) != 'Mn')
    return texto.lower()


# ---------------------------------------------------------------------------
# Páginas
# ---------------------------------------------------------------------------

def _placeholder(request, titulo):
    return render(request, 'core/em_construcao.html', {'titulo': titulo})


@login_required
def perfil_view(request):
    """Página 'Meu Perfil'. Todo usuário autenticado gerencia aqui tanto os
    locais que cadastrou (editar, excluir, trocar foto, ver detalhes)
    quanto as avaliações que deixou em outros locais."""
    contexto = {}

    meus_locais = (
        PontoTuristico.objects.filter(fornecedor=request.user)
        .prefetch_related('fotos')
        .annotate(
            avaliacao_media=Avg('avaliacoes__nota'),
            total_avaliacoes=Count('avaliacoes'),
        )
        .order_by('-data_cadastro')
    )
    contexto['meus_locais'] = meus_locais
    contexto['total_locais'] = meus_locais.count()

    minhas_avaliacoes = (
        Avaliacao.objects.filter(avaliador=request.user)
        .select_related('ponto_turistico')
        .prefetch_related('ponto_turistico__fotos')
        .order_by('-data_avaliacao')
    )
    contexto['minhas_avaliacoes'] = minhas_avaliacoes
    contexto['total_avaliacoes_turista'] = minhas_avaliacoes.count()

    return render(request, 'core/perfil.html', contexto)


# ---------------------------------------------------------------------------
# Endpoints JSON (substituem includes/pontos_handler.php). Mantidos nas
# mesmas URLs relativas usadas pelo JS original (js/index.js,
# js/busca-hero.js e js/destinos.js), então nada no JavaScript precisou
# ser alterado.
#
# São isentos de CSRF porque o JS original também não enviava nenhum
# token (o PHP não tinha proteção CSRF nesses handlers).
# ---------------------------------------------------------------------------

def _ponto_para_json(ponto):
    fornecedor = ponto.fornecedor
    fotos = [foto.imagem.url for foto in ponto.fotos.all()]
    foto_capa = fotos[0] if fotos else None
    return {
        'Id': ponto.id,
        'Nome': ponto.nome,
        'Tipo': ponto.tipo,
        'Localidade': ponto.localidade,
        'Endereco': ponto.endereco,
        'Bio': ponto.bio,
        'Latitude': float(ponto.latitude) if ponto.latitude is not None else None,
        'Longitude': float(ponto.longitude) if ponto.longitude is not None else None,
        'Fotos': fotos,
        # Aliases mantidos por compatibilidade com o JS existente (cards de
        # destinos.js/index.js/busca-hero.js), que sempre usam a primeira
        # foto da galeria como imagem de destaque.
        'Foto_Perfil': foto_capa,
        'Foto_Capa': foto_capa,
        'FaixaPreco': ponto.faixa_preco,
        'FaixaPrecoLabel': ponto.get_faixa_preco_display(),
        'Fornecedor': ponto.fornecedor_id,
        'NomeFornecedor': fornecedor.nome if fornecedor else None,
        'FotoFornecedor': (fornecedor.foto_perfil.url if fornecedor and fornecedor.foto_perfil else None),
        'IdFornecedor': ponto.fornecedor_id,
        'Avaliacao': float(getattr(ponto, 'avaliacao_media', 0) or 0),
        'Total_Avaliacoes': getattr(ponto, 'total_avaliacoes', 0) or 0,
        'Status': ponto.status,
        'StatusLabel': ponto.get_status_display(),
        'MotivoRejeicao': ponto.motivo_rejeicao,
    }


@csrf_exempt
def pontos_handler(request):
    """Equivalente a includes/pontos_handler.php."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Método inválido'}, status=405)

    action = request.POST.get('action', '')
    # As listagens públicas (carrossel da home, busca, filtro por tipo)
    # só devem mostrar locais já aprovados por um moderador — locais
    # pendentes ou rejeitados não aparecem para os outros usuários.
    base_qs = (
        PontoTuristico.objects.filter(status=PontoTuristico.STATUS_APROVADO)
        .select_related('fornecedor').prefetch_related('fotos').annotate(
            avaliacao_media=Avg('avaliacoes__nota'),
            total_avaliacoes=Count('avaliacoes'),
        )
    )

    if action == 'top5':
        # Só entram no carrossel de "melhores avaliados" locais que já têm
        # avaliação real de algum turista — nada de completar a lista com
        # locais aleatórios/recentes sem nota (isso fazia locais sem
        # avaliação aparecerem com um "⭐ 5.0" fixo no carrossel).
        pontos = list(
            base_qs.filter(total_avaliacoes__gt=0)
            .order_by('-avaliacao_media', '-total_avaliacoes')[:5]
        )
        return JsonResponse({'success': True, 'pontos': [_ponto_para_json(p) for p in pontos]})

    if action == 'listar_por_tipo':
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'message': 'Login necessário'}, status=403)
        tipo = request.POST.get('tipo') or None
        busca = (request.POST.get('busca') or '').strip()

        qs = base_qs.filter(tipo=tipo) if tipo else base_qs
        qs = qs.order_by('-data_cadastro')
        pontos = [_ponto_para_json(p) for p in qs]

        if busca:
            termo = _normalizar_texto(busca)
            pontos = [
                p for p in pontos
                if termo in _normalizar_texto(p.get('Nome'))
                or termo in _normalizar_texto(p.get('Localidade'))
                or termo in _normalizar_texto(p.get('Tipo'))
                or termo in _normalizar_texto(p.get('Bio'))
            ]

        return JsonResponse({'success': True, 'pontos': pontos})

    if action == 'listar_todos':
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'message': 'Login necessário'}, status=403)
        # Usado pela busca da home (js/busca-hero.js): retorna todos os
        # pontos turísticos sem filtro, para busca no lado do cliente.
        qs = base_qs.order_by('nome')
        pontos = [_ponto_para_json(p) for p in qs]
        return JsonResponse({'success': True, 'pontos': pontos, 'total': len(pontos)})

    return JsonResponse({'success': False, 'message': 'Ação inválida'})


@csrf_exempt
def local_handler(request):
    """Equivalente a includes/local_handler.php (cadastro de ponto
    turístico). Qualquer usuário autenticado pode cadastrar e gerenciar
    seus próprios locais."""
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'Acesso negado'})

    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Método inválido'}, status=405)

    action = request.POST.get('action', '')

    FAIXAS_VALIDAS = {c for c, _ in PontoTuristico.FAIXA_PRECO_CHOICES}

    if action == 'criar':
        nome = (request.POST.get('nome') or '').strip()
        tipo = (request.POST.get('tipo') or '').strip()
        localidade = (request.POST.get('localidade') or '').strip()
        endereco = (request.POST.get('endereco') or '').strip()
        bio = (request.POST.get('bio') or '').strip()
        nota = (request.POST.get('nota') or '').strip()
        faixa_preco = (request.POST.get('faixaPreco') or '').strip()

        if not nome or not tipo or not localidade or not endereco:
            return JsonResponse({'success': False, 'message': 'Campos obrigatórios não preenchidos'})

        if faixa_preco not in FAIXAS_VALIDAS:
            faixa_preco = PontoTuristico.FAIXA_MEDIA

        # Até MAX_FOTOS fotos do local (galeria exibida em carrossel na
        # página de detalhes). Fotos além do limite são ignoradas.
        fotos = request.FILES.getlist('fotos')[:PontoTuristico.MAX_FOTOS]

        latitude, longitude = geocodificar_endereco(endereco, localidade)

        # Proteção contra envio duplo (clique repetido no botão enquanto o
        # endereço é geocodificado): se o mesmo usuário acabou de cadastrar
        # exatamente este local, devolve o que já foi criado.
        recente = PontoTuristico.objects.filter(
            fornecedor=request.user,
            nome__iexact=nome,
            localidade__iexact=localidade,
            endereco__iexact=endereco,
            data_cadastro__gte=timezone.now() - timedelta(minutes=2),
        ).first()
        if recente:
            return JsonResponse({
                'success': True,
                'message': 'Local enviado para aprovação! Ele ficará pendente até um moderador revisar as informações.',
                'local_id': recente.id,
            })

        ponto = PontoTuristico.objects.create(
            nome=nome,
            tipo=tipo,
            localidade=localidade,
            endereco=endereco,
            bio=bio,
            faixa_preco=faixa_preco,
            fornecedor=request.user,
            latitude=latitude,
            longitude=longitude,
        )

        for indice, arquivo in enumerate(fotos):
            FotoPonto.objects.create(ponto=ponto, imagem=arquivo, ordem=indice)

        # Recurso extra (não existia no PHP original): quem cadastra o
        # local já pode deixar sua própria avaliação em estrelas.
        if nota:
            try:
                nota_valor = float(nota)
            except ValueError:
                nota_valor = None
            if nota_valor and 1 <= nota_valor <= 5:
                Avaliacao.objects.create(
                    nota=nota_valor,
                    avaliador=request.user,
                    tipo_avaliado=Avaliacao.PONTO_TURISTICO,
                    ponto_turistico=ponto,
                )

        return JsonResponse({
            'success': True,
            'message': 'Local enviado para aprovação! Ele ficará pendente até um moderador revisar as informações.',
            'local_id': ponto.id,
        })

    if action == 'obter':
        ponto_id = request.POST.get('id')
        try:
            ponto = PontoTuristico.objects.get(id=ponto_id)
        except (PontoTuristico.DoesNotExist, ValueError, TypeError):
            return JsonResponse({'success': False, 'message': 'Local não encontrado'})

        if ponto.fornecedor_id != request.user.id:
            return JsonResponse({'success': False, 'message': 'Sem permissão'})

        local = _ponto_para_json(ponto)
        local['FotosDetalhadas'] = [
            {'id': foto.id, 'url': foto.imagem.url} for foto in ponto.fotos.all()
        ]
        return JsonResponse({'success': True, 'local': local})

    if action == 'editar':
        ponto_id = request.POST.get('id')
        try:
            ponto = PontoTuristico.objects.get(id=ponto_id)
        except (PontoTuristico.DoesNotExist, ValueError, TypeError):
            return JsonResponse({'success': False, 'message': 'Local não encontrado'})

        if ponto.fornecedor_id != request.user.id:
            return JsonResponse({'success': False, 'message': 'Sem permissão'})

        nome = (request.POST.get('nome') or '').strip()
        tipo = (request.POST.get('tipo') or '').strip()
        localidade = (request.POST.get('localidade') or '').strip()
        endereco = (request.POST.get('endereco') or '').strip()
        bio = (request.POST.get('bio') or '').strip()
        faixa_preco = (request.POST.get('faixaPreco') or '').strip()

        if not nome or not tipo or not localidade or not endereco:
            return JsonResponse({'success': False, 'message': 'Campos obrigatórios não preenchidos'})

        ponto.nome = nome
        ponto.tipo = tipo
        endereco_mudou = ponto.localidade != localidade or ponto.endereco != endereco
        ponto.localidade = localidade
        ponto.endereco = endereco
        ponto.bio = bio
        if faixa_preco in FAIXAS_VALIDAS:
            ponto.faixa_preco = faixa_preco

        if endereco_mudou:
            ponto.latitude, ponto.longitude = geocodificar_endereco(endereco, localidade)

        # Qualquer edição precisa passar novamente pela moderação, para
        # não deixar uma alteração indevida "furar" a aprovação anterior.
        ponto.status = PontoTuristico.STATUS_PENDENTE
        ponto.motivo_rejeicao = None
        ponto.moderado_por = None
        ponto.data_moderacao = None

        ponto.save()

        # Remove fotos marcadas para exclusão (ids separados por vírgula).
        remover_ids = (request.POST.get('removerFotos') or '').strip()
        if remover_ids:
            ids = [i for i in remover_ids.split(',') if i.strip().isdigit()]
            for foto in ponto.fotos.filter(id__in=ids):
                foto.imagem.delete(save=False)
                foto.delete()

        # Adiciona novas fotos, respeitando o limite máximo do local.
        vagas_restantes = PontoTuristico.MAX_FOTOS - ponto.fotos.count()
        novas_fotos = request.FILES.getlist('fotos')[:max(vagas_restantes, 0)]
        proxima_ordem = (ponto.fotos.aggregate(Max('ordem'))['ordem__max'] or 0) + 1
        for indice, arquivo in enumerate(novas_fotos):
            FotoPonto.objects.create(ponto=ponto, imagem=arquivo, ordem=proxima_ordem + indice)

        local = _ponto_para_json(ponto)
        local['FotosDetalhadas'] = [
            {'id': foto.id, 'url': foto.imagem.url} for foto in ponto.fotos.all()
        ]

        return JsonResponse({
            'success': True,
            'message': 'Local atualizado com sucesso! Ele voltou para análise e ficará pendente até ser aprovado novamente.',
            'local': local,
        })

    if action == 'deletar':
        ponto_id = request.POST.get('id')
        try:
            ponto = PontoTuristico.objects.get(id=ponto_id)
        except (PontoTuristico.DoesNotExist, ValueError, TypeError):
            return JsonResponse({'success': False, 'message': 'Local não encontrado'})

        if ponto.fornecedor_id != request.user.id:
            return JsonResponse({'success': False, 'message': 'Sem permissão'})

        for foto in ponto.fotos.all():
            foto.imagem.delete(save=False)

        ponto.delete()
        return JsonResponse({'success': True, 'message': 'Local deletado'})

    return JsonResponse({'success': False, 'message': 'Ação inválida'})


def _avaliacao_para_json(avaliacao):
    avaliador = avaliacao.avaliador
    return {
        'Id': avaliacao.id,
        'Nota': float(avaliacao.nota),
        'Descricao': avaliacao.descricao,
        'Avaliador': avaliacao.avaliador_id,
        'IdUsuario': avaliacao.avaliador_id,
        'NomeUsuario': avaliador.nome if avaliador else None,
        'Foto_Perfil': avaliador.foto_perfil.url if avaliador and avaliador.foto_perfil else None,
        'DataAvaliacao': avaliacao.data_avaliacao.isoformat(),
    }


@csrf_exempt
def avaliacao_handler(request):
    """Equivalente a includes/avaliacao_handler.php."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Método inválido'}, status=405)

    action = request.POST.get('action', '')

    if action == 'listar_avaliacoes':
        ponto_id = request.POST.get('pontoId') or None

        qs = (
            Avaliacao.objects.select_related('avaliador')
            .filter(ponto_turistico_id=ponto_id)
            .order_by('-data_avaliacao')
        )

        return JsonResponse({'success': True, 'avaliacoes': [_avaliacao_para_json(a) for a in qs]})

    if action == 'criar_avaliacao':
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'message': 'Você precisa estar logado para avaliar'})

        tipo = request.POST.get('tipo') or ''
        try:
            nota = float(request.POST.get('nota') or 0)
        except ValueError:
            nota = 0
        descricao = (request.POST.get('descricao') or '').strip()

        if not (1 <= nota <= 5):
            return JsonResponse({'success': False, 'message': 'Nota inválida'})

        if tipo == 'Ponto_Turistico':
            ponto_id = request.POST.get('pontoId')
            if Avaliacao.objects.filter(
                avaliador=request.user, tipo_avaliado=Avaliacao.PONTO_TURISTICO, ponto_turistico_id=ponto_id
            ).exists():
                return JsonResponse({'success': False, 'message': 'Você já avaliou este local'})

            Avaliacao.objects.create(
                nota=nota, descricao=descricao, avaliador=request.user,
                tipo_avaliado=Avaliacao.PONTO_TURISTICO, ponto_turistico_id=ponto_id,
            )
        else:
            return JsonResponse({'success': False, 'message': 'Tipo inválido'})

        return JsonResponse({'success': True, 'message': 'Avaliação criada com sucesso'})

    if action == 'editar_avaliacao':
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'message': 'Não autenticado'})

        try:
            avaliacao = Avaliacao.objects.get(id=request.POST.get('id'))
        except (Avaliacao.DoesNotExist, ValueError, TypeError):
            return JsonResponse({'success': False, 'message': 'Avaliação não encontrada'})

        if avaliacao.avaliador_id != request.user.id:
            return JsonResponse({'success': False, 'message': 'Sem permissão'})

        try:
            nota = float(request.POST.get('nota') or 0)
        except ValueError:
            nota = 0

        if not (1 <= nota <= 5):
            return JsonResponse({'success': False, 'message': 'Nota inválida'})

        avaliacao.nota = nota
        avaliacao.descricao = (request.POST.get('descricao') or '').strip()
        avaliacao.save()

        return JsonResponse({
            'success': True,
            'message': 'Avaliação atualizada com sucesso',
            'avaliacao': _avaliacao_para_json(avaliacao),
        })

    if action == 'deletar':
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'message': 'Não autenticado'})

        try:
            avaliacao = Avaliacao.objects.get(id=request.POST.get('id'))
        except (Avaliacao.DoesNotExist, ValueError, TypeError):
            return JsonResponse({'success': False, 'message': 'Avaliação não encontrada'})

        if avaliacao.avaliador_id != request.user.id:
            return JsonResponse({'success': False, 'message': 'Sem permissão'})

        avaliacao.delete()
        return JsonResponse({'success': True, 'message': 'Avaliação deletada'})

    return JsonResponse({'success': False, 'message': 'Ação inválida'})


# ---------------------------------------------------------------------------
# Perfil do usuário logado (equivalente a includes/perfil_handler.php):
# editar nome de exibição / foto de perfil, ou excluir a própria conta.
# ---------------------------------------------------------------------------

@csrf_exempt
def perfil_handler(request):
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'Não autenticado'})

    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Método inválido'}, status=405)

    action = request.POST.get('action', '')
    usuario = request.user

    if action == 'editar_perfil':
        nome = (request.POST.get('nome') or '').strip()
        if not nome:
            return JsonResponse({'success': False, 'message': 'O nome não pode ficar vazio'})

        usuario.nome = nome

        nova_foto = request.FILES.get('fotoPerfil')
        if nova_foto:
            if usuario.foto_perfil:
                usuario.foto_perfil.delete(save=False)
            usuario.foto_perfil = nova_foto

        usuario.save()

        return JsonResponse({
            'success': True,
            'message': 'Perfil atualizado com sucesso!',
            'nome': usuario.nome,
            'foto_perfil': usuario.foto_perfil.url if usuario.foto_perfil else None,
        })

    if action == 'editar_capa':
        # Foto de capa (fundo da página de perfil): o usuário usa para
        # colocar uma foto das próprias viagens ou para personalizar sua
        # página de locais cadastrados.
        nova_capa = request.FILES.get('fotoCapa')
        if not nova_capa:
            return JsonResponse({'success': False, 'message': 'Nenhuma imagem enviada'})

        if usuario.foto_capa:
            usuario.foto_capa.delete(save=False)
        usuario.foto_capa = nova_capa
        usuario.save()

        return JsonResponse({
            'success': True,
            'message': 'Foto de capa atualizada com sucesso!',
            'foto_capa': usuario.foto_capa.url if usuario.foto_capa else None,
        })

    if action == 'excluir_perfil':
        if usuario.foto_perfil:
            usuario.foto_perfil.delete(save=False)
        if usuario.foto_capa:
            usuario.foto_capa.delete(save=False)

        auth_logout(request)
        usuario.delete()

        return JsonResponse({'success': True, 'message': 'Perfil excluído com sucesso', 'redirect': '/'})

    return JsonResponse({'success': False, 'message': 'Ação inválida'})


# ---------------------------------------------------------------------------
# Painel do moderador: aprovação/rejeição dos locais enviados pelos
# turistas, além da gestão geral de usuários e pontos (equivalente a
# includes/admin_handler.php, reaproveitando static/js/admin.js e
# static/css/style-admin.css que já existiam no projeto original).
# ---------------------------------------------------------------------------

@moderador_required
def moderador_view(request):
    contexto = {
        'total_usuarios': Usuario.objects.count(),
        'total_pontos': PontoTuristico.objects.count(),
        'total_pendentes': PontoTuristico.objects.filter(status=PontoTuristico.STATUS_PENDENTE).count(),
    }
    return render(request, 'core/moderador.html', contexto)


def _ponto_pendente_para_json(ponto):
    fornecedor = ponto.fornecedor
    return {
        'id': ponto.id,
        'nome': ponto.nome,
        'tipo': ponto.tipo,
        'localidade': ponto.localidade,
        'endereco': ponto.endereco,
        'bio': ponto.bio,
        'faixaPreco': ponto.get_faixa_preco_display(),
        'fotos': [foto.imagem.url for foto in ponto.fotos.all()],
        'fornecedor': fornecedor.nome if fornecedor else 'Usuário removido',
        'fornecedorEmail': fornecedor.email if fornecedor else None,
        'fotoFornecedor': fornecedor.foto_perfil.url if fornecedor and fornecedor.foto_perfil else None,
        'dataCadastro': ponto.data_cadastro.isoformat(),
    }


@csrf_exempt
def admin_handler(request):
    """Equivalente a includes/admin_handler.php: aprovar/rejeitar
    solicitações pendentes e gerenciar usuários/pontos. Só acessível a
    usuários com is_moderador=True."""
    if not request.user.is_authenticated or not request.user.is_moderador:
        return JsonResponse({'success': False, 'message': 'Acesso restrito a moderadores'}, status=403)

    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Método inválido'}, status=405)

    action = request.POST.get('action', '')

    if action == 'estatisticas':
        return JsonResponse({
            'success': True,
            'stats': {
                'usuarios': Usuario.objects.count(),
                'pontos': PontoTuristico.objects.count(),
                'pendentes': PontoTuristico.objects.filter(status=PontoTuristico.STATUS_PENDENTE).count(),
            },
        })

    if action == 'listar_pendentes':
        pontos = (
            PontoTuristico.objects.filter(status=PontoTuristico.STATUS_PENDENTE)
            .select_related('fornecedor').prefetch_related('fotos')
            .order_by('data_cadastro')
        )
        return JsonResponse({
            'success': True,
            'pontos': [_ponto_pendente_para_json(p) for p in pontos],
        })

    if action == 'aprovar':
        try:
            ponto = PontoTuristico.objects.get(id=request.POST.get('id'))
        except (PontoTuristico.DoesNotExist, ValueError, TypeError):
            return JsonResponse({'success': False, 'message': 'Local não encontrado'})

        ponto.status = PontoTuristico.STATUS_APROVADO
        ponto.motivo_rejeicao = None
        ponto.moderado_por = request.user
        ponto.data_moderacao = timezone.now()
        ponto.save()

        return JsonResponse({'success': True, 'message': f'"{ponto.nome}" foi aprovado e já está visível no site.'})

    if action == 'rejeitar':
        try:
            ponto = PontoTuristico.objects.get(id=request.POST.get('id'))
        except (PontoTuristico.DoesNotExist, ValueError, TypeError):
            return JsonResponse({'success': False, 'message': 'Local não encontrado'})

        motivo = (request.POST.get('motivo') or '').strip()
        ponto.status = PontoTuristico.STATUS_REJEITADO
        ponto.motivo_rejeicao = motivo or 'Não especificado pelo moderador.'
        ponto.moderado_por = request.user
        ponto.data_moderacao = timezone.now()
        ponto.save()

        return JsonResponse({'success': True, 'message': f'"{ponto.nome}" foi rejeitado.'})

    if action == 'listar_usuarios':
        usuarios = Usuario.objects.annotate(total_pontos=Count('pontos_turisticos')).order_by('nome')
        dados = [{
            'id': u.id,
            'nome': u.nome,
            'email': u.email,
            'fotoPerfil': u.foto_perfil.url if u.foto_perfil else None,
            'dataCriacao': u.data_cadastro.isoformat(),
            'totalPontos': u.total_pontos,
            'isModerador': u.is_moderador,
        } for u in usuarios]
        return JsonResponse({'success': True, 'usuarios': dados})

    if action == 'listar_pontos':
        pontos = (
            PontoTuristico.objects.select_related('fornecedor').prefetch_related('fotos')
            .annotate(avaliacao_media=Avg('avaliacoes__nota'))
            .order_by('-data_cadastro')
        )
        dados = [{
            'id': p.id,
            'nome': p.nome,
            'tipo': p.tipo,
            'localidade': p.localidade,
            'fornecedor': p.fornecedor.nome if p.fornecedor else 'Usuário removido',
            'avaliacao': float(p.avaliacao_media) if p.avaliacao_media else None,
            'fotoPerfil': p.fotos.first().imagem.url if p.fotos.exists() else None,
            'status': p.status,
            'statusLabel': p.get_status_display(),
        } for p in pontos]
        return JsonResponse({'success': True, 'pontos': dados})

    if action == 'excluir_usuario':
        user_id = request.POST.get('id')
        if str(user_id) == str(request.user.id):
            return JsonResponse({'success': False, 'message': 'Você não pode excluir sua própria conta por aqui'})

        try:
            usuario = Usuario.objects.get(id=user_id)
        except (Usuario.DoesNotExist, ValueError, TypeError):
            return JsonResponse({'success': False, 'message': 'Usuário não encontrado'})

        if usuario.foto_perfil:
            usuario.foto_perfil.delete(save=False)
        if usuario.foto_capa:
            usuario.foto_capa.delete(save=False)
        usuario.delete()

        return JsonResponse({'success': True, 'message': 'Usuário excluído com sucesso'})

    if action == 'excluir_ponto':
        try:
            ponto = PontoTuristico.objects.get(id=request.POST.get('id'))
        except (PontoTuristico.DoesNotExist, ValueError, TypeError):
            return JsonResponse({'success': False, 'message': 'Local não encontrado'})

        for foto in ponto.fotos.all():
            foto.imagem.delete(save=False)
        ponto.delete()

        return JsonResponse({'success': True, 'message': 'Local excluído com sucesso'})

    return JsonResponse({'success': False, 'message': 'Ação inválida'})