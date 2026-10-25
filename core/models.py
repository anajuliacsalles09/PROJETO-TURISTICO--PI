from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


class UsuarioManager(BaseUserManager):
    """Gerenciador de usuário customizado: login por e-mail (como no PHP original)."""

    def create_user(self, email, nome, password=None, **extra_fields):
        if not email:
            raise ValueError('O e-mail é obrigatório')
        email = self.normalize_email(email)
        usuario = self.model(email=email, nome=nome, **extra_fields)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_superuser(self, email, nome, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, nome, password, **extra_fields)


class Usuario(AbstractUser):
    """Equivalente à tabela `usuarios` / classe Usuario.php do projeto original.

    O projeto original distinguia dois tipos de conta (Turista e
    Fornecedor). Essa distinção foi removida: agora existe um único tipo de
    usuário, que acumula todas as funções — pode tanto cadastrar/gerenciar
    pontos turísticos quanto avaliar locais.
    """

    username = None
    email = models.EmailField('E-mail', unique=True)
    nome = models.CharField('Nome', max_length=150)
    telefone = models.CharField('Telefone', max_length=20, blank=True, null=True)
    cpf = models.CharField('CPF', max_length=14, blank=True, null=True)
    cnpj = models.CharField('CNPJ', max_length=18, blank=True, null=True)
    data_nascimento = models.DateField('Data de nascimento', blank=True, null=True)
    bio = models.TextField('Bio', blank=True, null=True)
    foto_perfil = models.ImageField('Foto de perfil', upload_to='perfil/', blank=True, null=True)
    foto_capa = models.ImageField('Foto de capa', upload_to='capa/', blank=True, null=True)
    data_cadastro = models.DateTimeField('Data de cadastro', auto_now_add=True)
    is_moderador = models.BooleanField(
        'Moderador', default=False,
        help_text='Usuários moderadores podem aprovar ou rejeitar os locais enviados pelos turistas.',
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nome']

    objects = UsuarioManager()

    def __str__(self):
        return self.nome


class PontoTuristico(models.Model):
    """Equivalente à tabela `pontosturisticos` / classe PontoTuristico.php."""

    TIPO_CHOICES = [
        (t, t) for t in [
            'Museu', 'Parque', 'Monumento', 'Igreja', 'Restaurante',
            'Hotel', 'Praia', 'Teatro', 'Centro Cultural', 'Outro',
        ]
    ]

    FAIXA_GRATUITO = 'Gratuito'
    FAIXA_BAIXA = 'Baixo'
    FAIXA_MEDIA = 'Médio'
    FAIXA_ALTA = 'Elevado'
    FAIXA_PRECO_CHOICES = [
        (FAIXA_GRATUITO, '🆓 Gratuito'),
        (FAIXA_BAIXA, '💰 Baixo'),
        (FAIXA_MEDIA, '💰💰 Médio'),
        (FAIXA_ALTA, '💰💰💰 Elevado'),
    ]

    MAX_FOTOS = 4

    STATUS_PENDENTE = 'pendente'
    STATUS_APROVADO = 'aprovado'
    STATUS_REJEITADO = 'rejeitado'
    STATUS_CHOICES = [
        (STATUS_PENDENTE, 'Pendente'),
        (STATUS_APROVADO, 'Aprovado'),
        (STATUS_REJEITADO, 'Rejeitado'),
    ]

    tipo = models.CharField('Tipo', max_length=30, choices=TIPO_CHOICES)
    nome = models.CharField('Nome', max_length=150)
    localidade = models.CharField('Cidade/Estado', max_length=150)
    endereco = models.CharField('Endereço', max_length=255)
    bio = models.TextField('Descrição', blank=True, null=True)
    faixa_preco = models.CharField(
        'Faixa de preço', max_length=10, choices=FAIXA_PRECO_CHOICES, default=FAIXA_MEDIA,
    )
    fornecedor = models.ForeignKey(
        Usuario, verbose_name='Fornecedor', on_delete=models.CASCADE,
        related_name='pontos_turisticos',
    )
    latitude = models.DecimalField(
        'Latitude', max_digits=9, decimal_places=6, blank=True, null=True,
    )
    longitude = models.DecimalField(
        'Longitude', max_digits=9, decimal_places=6, blank=True, null=True,
    )
    data_cadastro = models.DateTimeField('Data de cadastro', auto_now_add=True)

    # -- Moderação -----------------------------------------------------
    # Todo local cadastrado por um turista entra como "pendente" e só
    # aparece nas listagens públicas (home, destinos) depois que um
    # moderador aprova a solicitação. Se for rejeitado, o motivo fica
    # registrado para o autor entender o porquê.
    status = models.CharField(
        'Status', max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDENTE,
    )
    motivo_rejeicao = models.TextField('Motivo da rejeição', blank=True, null=True)
    moderado_por = models.ForeignKey(
        Usuario, verbose_name='Moderado por', on_delete=models.SET_NULL,
        related_name='pontos_moderados', blank=True, null=True,
    )
    data_moderacao = models.DateTimeField('Data da moderação', blank=True, null=True)

    class Meta:
        verbose_name = 'Ponto turístico'
        verbose_name_plural = 'Pontos turísticos'

    def __str__(self):
        return self.nome

    @property
    def esta_aprovado(self):
        return self.status == self.STATUS_APROVADO

    @property
    def foto_capa(self):
        """Primeira foto da galeria: usada como imagem de destaque nos
        cards, no carrossel da home e como capa da página de detalhes."""
        return self.fotos.first()


def _upload_foto_ponto(instance, filename):
    return f'pontos/galeria/{instance.ponto_id}/{filename}'


class FotoPonto(models.Model):
    """Fotos da galeria de um ponto turístico (até
    `PontoTuristico.MAX_FOTOS` por local), exibidas em carrossel na página
    de detalhes."""

    ponto = models.ForeignKey(
        PontoTuristico, verbose_name='Ponto turístico', on_delete=models.CASCADE,
        related_name='fotos',
    )
    imagem = models.ImageField('Foto', upload_to=_upload_foto_ponto)
    ordem = models.PositiveSmallIntegerField('Ordem', default=0)
    data_upload = models.DateTimeField('Data de envio', auto_now_add=True)

    class Meta:
        ordering = ['ordem', 'id']
        verbose_name = 'Foto do local'
        verbose_name_plural = 'Fotos do local'

    def __str__(self):
        return f'Foto de {self.ponto.nome} ({self.ordem})'


class Avaliacao(models.Model):
    """Equivalente à tabela `avaliacao` / classe Avaliacao.php."""

    PONTO_TURISTICO = 'Ponto_Turistico'
    TIPO_AVALIADO_CHOICES = [
        (PONTO_TURISTICO, 'Ponto Turístico'),
    ]

    nota = models.DecimalField('Nota', max_digits=3, decimal_places=1)
    descricao = models.TextField('Descrição', blank=True, null=True)
    avaliador = models.ForeignKey(
        Usuario, verbose_name='Avaliador', on_delete=models.CASCADE, related_name='avaliacoes',
    )
    tipo_avaliado = models.CharField(
        'Tipo avaliado', max_length=20, choices=TIPO_AVALIADO_CHOICES, default=PONTO_TURISTICO,
    )
    ponto_turistico = models.ForeignKey(
        PontoTuristico, verbose_name='Ponto turístico', on_delete=models.CASCADE,
        related_name='avaliacoes', blank=True, null=True,
    )
    data_avaliacao = models.DateTimeField('Data da avaliação', auto_now_add=True)

    class Meta:
        verbose_name = 'Avaliação'
        verbose_name_plural = 'Avaliações'