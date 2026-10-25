from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from core.models import Usuario


# ---------------------------------------------------------------------------
# Páginas
# ---------------------------------------------------------------------------

def login_view(request):
    if request.user.is_authenticated:
        return redirect('index')
    return render(request, 'contas/login.html')


def cadastro_view(request):
    if request.user.is_authenticated:
        return redirect('index')
    return render(request, 'contas/cadastro.html')


def logout_view(request):
    auth_logout(request)
    return redirect('index')


# ---------------------------------------------------------------------------
# Endpoints JSON — mesmas URLs relativas usadas por js/login.js e
# js/cadastro.js (includes/processar_login.php e includes/processar_cadastro.php),
# então os arquivos JS originais não precisaram ser alterados.
# São isentos de CSRF porque o JS original também não enviava token algum
# (o PHP não usava proteção CSRF nesses handlers).
# ---------------------------------------------------------------------------

@csrf_exempt
@require_POST
def processar_login(request):
    email = (request.POST.get('email') or '').strip().lower()
    senha = request.POST.get('senha') or ''

    if not email or not senha:
        return JsonResponse({'success': False, 'message': 'Preencha todos os campos obrigatórios'})

    try:
        usuario = Usuario.objects.get(email__iexact=email)
    except Usuario.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Usuário não encontrado'})

    if not usuario.check_password(senha):
        return JsonResponse({'success': False, 'message': 'Senha incorreta'})

    auth_login(request, usuario)

    next_url = request.POST.get('next') or ''
    redirect_url = '/'
    if next_url and url_has_allowed_host_and_scheme(
        url=next_url, allowed_hosts={request.get_host()}, require_https=request.is_secure()
    ):
        redirect_url = next_url

    return JsonResponse({
        'success': True,
        'message': 'Login realizado com sucesso!',
        'redirect': redirect_url,
    })


@csrf_exempt
@require_POST
def processar_cadastro(request):
    nome = (request.POST.get('nome') or '').strip()
    email = (request.POST.get('email') or '').strip().lower()
    senha = request.POST.get('senha') or ''
    telefone = (request.POST.get('telefone') or '').strip() or None
    data_nascimento = (request.POST.get('dataNascimento') or '').strip() or None
    cpf = (request.POST.get('cpf') or '').strip() or None
    cnpj = (request.POST.get('cnpj') or '').strip() or None

    if not nome or not email or not senha:
        return JsonResponse({'success': False, 'message': 'Preencha todos os campos obrigatórios'})

    if len(senha) < 6:
        return JsonResponse({'success': False, 'message': 'A senha deve ter no mínimo 6 caracteres'})

    if Usuario.objects.filter(email__iexact=email).exists():
        return JsonResponse({'success': False, 'message': 'Este email já está cadastrado'})

    if cpf and Usuario.objects.filter(cpf=cpf).exists():
        return JsonResponse({'success': False, 'message': 'Este CPF já está cadastrado'})

    if cnpj and Usuario.objects.filter(cnpj=cnpj).exists():
        return JsonResponse({'success': False, 'message': 'Este CNPJ já está cadastrado'})

    usuario = Usuario.objects.create_user(
        email=email,
        nome=nome,
        password=senha,
        telefone=telefone,
        data_nascimento=data_nascimento or None,
        cpf=cpf,
        cnpj=cnpj,
    )

    return JsonResponse({
        'success': True,
        'message': 'Cadastro realizado com sucesso!',
        'user_id': usuario.id,
    })
