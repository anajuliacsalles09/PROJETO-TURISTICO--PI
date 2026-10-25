from django.urls import path

from . import views

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('cadastro/', views.cadastro_view, name='cadastro'),
    path('logout/', views.logout_view, name='logout'),
    path('api/processar_login/', views.processar_login, name='processar_login'),
    path('api/processar_cadastro/', views.processar_cadastro, name='processar_cadastro'),
]
