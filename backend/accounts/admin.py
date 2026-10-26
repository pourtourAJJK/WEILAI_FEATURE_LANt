from django.contrib import admin
from .models import UserProfile

# UserProfile 内联到 User admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name = "锁定信息"


class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)


# 替换默认 User admin
try:
    admin.site.unregister(User)
except Exception:
    pass
admin.site.register(User, UserAdmin)
admin.site.register(UserProfile)
