# market/urls.py

from django.urls import path
from . import views
from . import api_views
from django.contrib.auth import views as auth_views #

urlpatterns = [
    # Teacher Views
    path('teacher/login', views.teacher_login, name='teacher_login'),
    path('teacher/login/', views.teacher_login), # Fallback
    path('teacher', views.teacher_dashboard, name='teacher_dashboard'),
    path('teacher/', views.teacher_dashboard), # Fallback
    path('teacher/grade/<int:grade>', views.teacher_student_list, name='teacher_student_list'),
    path('teacher/grade/<int:grade>/', views.teacher_student_list), # Fallback
    path('ticket/update/<int:student_id>', views.update_ticket, name='update_ticket'),
    path('ticket/update/<int:student_id>/', views.update_ticket), # Fallback
    path('teacher/logout', auth_views.LogoutView.as_view(next_page='teacher_login'), name='teacher_logout'),
    path('teacher/logout/', auth_views.LogoutView.as_view(next_page='teacher_login')), # Fallback
    
    # API endpoints
    path('api/login/', api_views.api_login, name='api_login'),
    path('api/logout/', api_views.api_logout, name='api_logout'),
    path('api/items/', api_views.api_item_list, name='api_item_list'),
    path('api/students/', api_views.api_students_by_grade, name='api_students_by_grade'),
    path('api/student/<int:student_id>/', api_views.api_student_detail, name='api_student_detail'),
    path('api/purchase/', api_views.api_purchase_item, name='api_purchase_item'),
]