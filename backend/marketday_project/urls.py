# marketday_project/urls.py

from django.urls import path, include

from django.views.generic import RedirectView
from market.admin import custom_admin_site

urlpatterns = [
    path('admin', RedirectView.as_view(url='/admin/', permanent=True)),
    path('admin/', custom_admin_site.urls),
    path('', include('market.urls')), # '/market' 앱으로 가는 길
]