from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.contrib.auth.hashers import check_password
from django.contrib.auth import logout
from .models import Student, Item, Purchase
from .serializers import StudentSerializer, ItemSerializer, PurchaseSerializer

@api_view(['GET'])
def api_students_by_grade(request):
    """
    Returns list of students filtered by grade.
    id and name only for privacy/listing.
    """
    grade = request.GET.get('grade')
    if grade:
        students = Student.objects.filter(grade=grade).order_by('name')
    else:
        students = Student.objects.all().order_by('grade', 'name')
    
    serializer = StudentSerializer(students, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def api_login(request):
    """
    Simple login API that validates student ID and password.
    Returns student data if successful.
    """
    student_id = request.data.get('student_id')
    password = request.data.get('password')

    try:
        student = Student.objects.get(pk=student_id)
        if check_password(password, student.password):
            serializer = StudentSerializer(student)
            return Response({'status': 'success', 'student': serializer.data})
        else:
            return Response({'status': 'error', 'message': '비밀번호가 틀렸습니다.'}, status=401)
    except Student.DoesNotExist:
        return Response({'status': 'error', 'message': '학생을 찾을 수 없습니다.'}, status=404)

@api_view(['POST'])
def api_logout(request):
    """
    Logs out the user (clears session if applicable).
    """
    logout(request)
    return Response({'status': 'success', 'message': 'Logged out'})

@api_view(['GET'])
def api_item_list(request):
    """
    Returns list of all items.
    """
    items = Item.objects.all()
    serializer = ItemSerializer(items, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def api_student_detail(request, student_id):
    """
    Returns student info, current balance, and purchase history.
    """
    student = get_object_or_404(Student, pk=student_id)
    student_serializer = StudentSerializer(student)
    
    purchases = Purchase.objects.filter(student=student).order_by('-timestamp')
    purchase_serializer = PurchaseSerializer(purchases, many=True)
    
    return Response({
        'student': student_serializer.data,
        'purchases': purchase_serializer.data
    })

@api_view(['POST'])
def api_purchase_item(request):
    """
    Handles item purchase. checks balance and creates record.
    """
    student_id = request.data.get('student_id')
    item_id = request.data.get('item_id')
    
    student = get_object_or_404(Student, pk=student_id)
    item = get_object_or_404(Item, pk=item_id)
    
    if item.quantity <= 0:
        return Response({
            'status': 'error', 
            'message': '품절된 상품입니다.'
        }, status=400)

    if student.ticket_count >= item.cost:
        # Atomic transaction recommended for concurrency
        item.quantity -= 1
        item.save()
        
        student.ticket_count -= item.cost
        student.save()
        purchase = Purchase.objects.create(student=student, item=item)
        
        # Reload student to get updated balance
        serializer = StudentSerializer(student)
        return Response({
            'status': 'success', 
            'message': f'{item.name} 구매 완료!',
            'student': serializer.data
        })
    else:
        return Response({
            'status': 'error', 
            'message': '티켓이 부족합니다.'
        }, status=400)
