# market/forms.py (새 파일)

from django import forms
from .models import Item

class ItemForm(forms.ModelForm):
    class Meta:
        model = Item  # Item 모델을 기반으로 폼을 만듭니다.
        fields = ['name', 'cost', 'link']  # 폼에 표시할 필드를 지정합니다.