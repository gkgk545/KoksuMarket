# market/models.py

from django.db import models

class Student(models.Model):
    GRADE_CHOICES = [
        (3, '3학년'),
        (4, '4학년'),
        (5, '5학년'),
        (6, '6학년'),
    ]
    name = models.CharField(max_length=100)
    grade = models.IntegerField(choices=GRADE_CHOICES, default=3)
    ticket_count = models.IntegerField(default=0)
    password = models.CharField(max_length=128)

    class Meta:
        verbose_name = '학생'
        verbose_name_plural = '학생 관리'

    def __str__(self):
        return self.name

class Item(models.Model):
    name = models.CharField(max_length=200)
    cost = models.IntegerField()
    link = models.URLField(blank=True, null=True)
    image_url = models.URLField(blank=True, null=True)  # 👈 이 줄을 추가하세요.
    quantity = models.IntegerField(default=10) # 👈 수량 필드 추가

    class Meta:
        verbose_name = '물건'
        verbose_name_plural = '물건 관리'

    def __str__(self):
        return f'{self.name} ({self.cost} tickets)'

class Purchase(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
    is_delivered = models.BooleanField(default=False) # 👈 전달 여부 확인

    class Meta:
        verbose_name = '구매 기록'
        verbose_name_plural = '구매 기록'

    def __str__(self):
        return f'{self.student.name} purchased {self.item.name}'



# Proxy Models for Admin Separation
class PendingPurchase(Purchase):
    class Meta:
        proxy = True
        verbose_name = '배송 전 목록'
        verbose_name_plural = '배송 전 목록'

class CompletedPurchase(Purchase):
    class Meta:
        proxy = True
        verbose_name = '배송 완료 목록'
        verbose_name_plural = '배송 완료 목록'