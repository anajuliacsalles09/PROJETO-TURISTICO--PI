from django.urls import path

from . import views

# Páginas com URL limpa (ex.: /perfil/, /moderador/) e endpoints JSON em
# /api/... usados via fetch pelo JavaScript. Os caminhos no JS são
# absolutos (começam com "/"), então funcionam em qualquer página.
urlpatterns = [
    path('perfil/', views.perfil_view, name='perfil'),
    path('api/pontos_handler/', views.pontos_handler, name='pontos_handler'),
    path('api/local_handler/', views.local_handler, name='local_handler'),
    path('api/avaliacao_handler/', views.avaliacao_handler, name='avaliacao_handler'),
    path('api/perfil_handler/', views.perfil_handler, name='perfil_handler'),
    # Painel do moderador: aprovação/rejeição das solicitações dos turistas.
    path('moderador/', views.moderador_view, name='moderador'),
    path('api/admin_handler/', views.admin_handler, name='admin_handler'),
]
