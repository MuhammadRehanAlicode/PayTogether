from django.contrib import admin

from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('title', 'tour', 'paid_by', 'amount', 'created_at')
    search_fields = ('title', 'tour__title', 'paid_by__email')
    list_filter = ('tour',)
