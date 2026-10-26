"""
accounts/urls.py — /api/auth/* 和 /api/users/*
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AvatarUploadAPIView,
    ChangePasswordAPIView,
    LoginAPIView,
    LogoutAPIView,
    RegisterAPIView,
    UserDetailView,
    UserListView,
)

urlpatterns = [
    # 认证
    path("auth/register/", RegisterAPIView.as_view(), name="auth-register"),
    path("auth/login/", LoginAPIView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutAPIView.as_view(), name="auth-logout"),
    # 用户资料
    path("auth/change-password/", ChangePasswordAPIView.as_view(), name="auth-change-password"),
    path("auth/avatar/", AvatarUploadAPIView.as_view(), name="auth-avatar"),
    # 用户读取
    path("users/", UserListView.as_view(), name="user-list"),
    path("users/<int:pk>/", UserDetailView.as_view(), name="user-detail"),
]
