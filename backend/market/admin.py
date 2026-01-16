from django.contrib import admin
from django.contrib.admin import AdminSite
from .models import Student, Item, PendingPurchase, CompletedPurchase


class CustomAdminSite(AdminSite):
    site_header = '곡수마켓 관리자'
    site_title = '곡수마켓 관리자'
    index_title = 'Site administration'

    def get_app_list(self, request, app_label=None):
        app_list = super().get_app_list(request, app_label)

        # 원하는 모델 순서 정의
        model_order = ['student', 'item', 'pendingpurchase', 'completedpurchase']

        for app in app_list:
            if app['app_label'] == 'market':
                app['models'].sort(
                    key=lambda x: model_order.index(x['object_name'].lower())
                    if x['object_name'].lower() in model_order else 999
                )

        return app_list


# 커스텀 admin site 인스턴스 생성
custom_admin_site = CustomAdminSite(name='custom_admin')


@admin.register(Student, site=custom_admin_site)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('name', 'grade', 'ticket_count')
    list_filter = ('grade',)
    search_fields = ('name',)


@admin.register(Item, site=custom_admin_site)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'cost', 'quantity')
    list_editable = ('quantity',)
    search_fields = ('name',)


@admin.register(PendingPurchase, site=custom_admin_site)
class PendingPurchaseAdmin(admin.ModelAdmin):
    list_display = ('student', 'item', 'timestamp')
    list_filter = ('timestamp',)
    actions = ['mark_as_delivered', 'restore_stock_action', 'delete_without_restore_action']

    def get_queryset(self, request):
        return super().get_queryset(request).filter(is_delivered=False)

    @admin.action(description='선택한 물건을 배송 완료 처리하기')
    def mark_as_delivered(self, request, queryset):
        queryset.update(is_delivered=True)

    @admin.action(description='물건 원상 복구 처리하기(재고 복원)')
    def restore_stock_action(self, request, queryset):
        restored_count = 0
        for obj in queryset:
            item = obj.item
            item.quantity += 1
            item.save()

            student = obj.student
            student.ticket_count += item.cost
            student.save()

            obj.delete()
            restored_count += 1

        self.message_user(request, f"{restored_count}개의 구매 내역이 원상 복구(재고 복원/환불) 되었습니다.")

    @admin.action(description='선택한 물건 삭제하기 (목록 정리)')
    def delete_without_restore_action(self, request, queryset):
        deleted_count = queryset.count()
        queryset.delete()
        self.message_user(request, f"{deleted_count}개의 항목이 삭제되었습니다 (재고/티켓 영향 없음).")

    def get_actions(self, request):
        actions = super().get_actions(request)
        if 'delete_selected' in actions:
            del actions['delete_selected']
        return actions


@admin.register(CompletedPurchase, site=custom_admin_site)
class CompletedPurchaseAdmin(admin.ModelAdmin):
    list_display = ('student', 'item', 'timestamp')
    list_filter = ('timestamp',)
    actions = ['mark_as_pending', 'delete_without_restore_action']

    def get_queryset(self, request):
        return super().get_queryset(request).filter(is_delivered=True)

    @admin.action(description='선택한 물건을 배송 취소 처리하기(장바구니 복원)')
    def mark_as_pending(self, request, queryset):
        queryset.update(is_delivered=False)

    @admin.action(description='선택한 물건 삭제하기 (목록 정리)')
    def delete_without_restore_action(self, request, queryset):
        deleted_count = queryset.count()
        queryset.delete()
        self.message_user(request, f"{deleted_count}개의 항목이 삭제되었습니다.")

    def get_actions(self, request):
        actions = super().get_actions(request)
        if 'delete_selected' in actions:
            del actions['delete_selected']
        return actions
