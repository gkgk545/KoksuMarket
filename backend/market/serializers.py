from rest_framework import serializers
from .models import Student, Item, Purchase

class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ['id', 'name', 'grade', 'ticket_count']

class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ['id', 'name', 'cost', 'link', 'image_url', 'quantity']

class PurchaseSerializer(serializers.ModelSerializer):
    item_name = serializers.ReadOnlyField(source='item.name')
    item_cost = serializers.ReadOnlyField(source='item.cost')
    
    class Meta:
        model = Purchase
        fields = ['id', 'student', 'item', 'item_name', 'item_cost', 'timestamp', 'is_delivered']
