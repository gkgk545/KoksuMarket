# market/views.py

from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login
from .models import Item, Student, Purchase
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Sum

# T1. 교사용 학년 선택 페이지
@login_required(login_url='teacher_login')
def teacher_dashboard(request):
    # --- 전체 통계만 남겨둡니다 ---
    student_count = Student.objects.count()
    total_tickets = Student.objects.aggregate(total=Sum('ticket_count'))['total'] or 0
    popular_items = Purchase.objects.values('item__name') \
                                    .annotate(purchase_count=Count('item')) \
                                    .order_by('-purchase_count')[:3]
    top_student_overall = Student.objects.order_by('-ticket_count').first()
    
    # 학년 목록 (페이지 하단 링크용)
    grades_links = Student.GRADE_CHOICES

    context = {
        'student_count': student_count,
        'total_tickets': total_tickets,
        'popular_items': popular_items,
        'top_student_overall': top_student_overall,
        'grades_links': grades_links,
    }
    return render(request, 'market/teacher_dashboard.html', context)

# T2. 교사용 학생 목록 및 티켓 관리 페이지
@login_required(login_url='teacher_login')
def teacher_student_list(request, grade):
    # --- 1. 해당 학년의 학생 목록 (기존 기능) ---
    students_in_grade = Student.objects.filter(grade=grade).order_by('name')
    
    # --- 2. 해당 학년의 상세 통계 계산 (새로운 기능) ---
    student_count_grade = students_in_grade.count()
    total_tickets_grade = students_in_grade.aggregate(total=Sum('ticket_count'))['total'] or 0
    popular_items_grade = Purchase.objects.filter(student__grade=grade) \
                                          .values('item__name') \
                                          .annotate(purchase_count=Count('item')) \
                                          .order_by('-purchase_count')[:3]
    top_student_grade = students_in_grade.order_by('-ticket_count').first()

    context = {
        'students': students_in_grade,
        'grade': grade,
        'student_count_grade': student_count_grade,
        'total_tickets_grade': total_tickets_grade,
        'popular_items_grade': popular_items_grade,
        'top_student_grade': top_student_grade,
    }
    return render(request, 'market/teacher_student_list.html', context)

# T3. 티켓 추가/제거 로직
@login_required(login_url='teacher_login')
def update_ticket(request, student_id):
    if request.method == 'POST':
        student = Student.objects.get(pk=student_id)
        # 입력칸에서 'amount' 값을 가져옵니다. 값이 없거나 숫자가 아니면 0으로 처리합니다.
        try:
            amount = int(request.POST.get('amount', 0))
        except (ValueError, TypeError):
            amount = 0

        # 어떤 버튼이 눌렸는지 확인합니다.
        if 'add' in request.POST:
            student.ticket_count += amount
        elif 'remove' in request.POST:
            # 현재 티켓보다 많은 수를 뺄 수 없도록 방지합니다.
            student.ticket_count = max(0, student.ticket_count - amount)
        
        student.save()
        return redirect('teacher_student_list', grade=student.grade)
    
    return redirect('teacher_dashboard')

def teacher_login(request):
    error = None
    if request.method == 'POST':
        password = request.POST.get('password')
        # ID는 'admin'으로 고정하고 비밀번호만 확인합니다.
        user = authenticate(username='admin', password=password)
        if user is not None:
            login(request, user)
            return redirect('teacher_dashboard')
        else:
            error = "비밀번호가 올바르지 않습니다."
            
    return render(request, 'market/teacher_login.html', {'error': error})
