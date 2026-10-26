"""
accounts/models.py — 用户模型
用 Django 自带 User（不自定义 AUTH_USER_MODEL，避免迁移风险）
额外用 UserProfile 存储登录锁定状态
"""
from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):
    """扩展 User 的额外字段：登录锁定 + 头像"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    failed_attempts = models.PositiveIntegerField(default=0, verbose_name="连续失败次数")
    locked_until = models.DateTimeField(null=True, blank=True, verbose_name="锁定到期时间")
    avatar = models.ImageField(
        upload_to="avatars/",
        null=True,
        blank=True,
        verbose_name="头像",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounts_user_profile"
        verbose_name = "用户扩展信息"
        verbose_name_plural = "用户扩展信息"

    def __str__(self):
        return f"{self.user.username} (fails={self.failed_attempts})"
