# market/apps.py

from django.apps import AppConfig

class MarketConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'market'
    verbose_name = '마켓데이 관리'  # 이 줄을 추가해주세요.