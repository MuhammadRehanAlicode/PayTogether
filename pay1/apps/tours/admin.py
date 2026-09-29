from django.contrib import admin
from .models import TourMember, tour

@admin.register(tour)
class TourAdmin(admin.ModelAdmin):
    list_display = ('title', 'destination', 'created_by', 'join_code', 'created_at')
    search_fields = ('title', 'destination', 'join_code')


@admin.register(TourMember)
class TourMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'tour', 'joined_at')
    search_fields = ('user__email', 'tour__title')
