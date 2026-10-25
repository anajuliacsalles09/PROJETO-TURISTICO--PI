from django.urls import path

from . import views

urlpatterns = [
    path('destinos/', views.destinos_view, name='destinos'),
    path('visualizar-ponto/', views.visualizar_ponto_view, name='visualizar_ponto'),
]
