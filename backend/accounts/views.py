"""
accounts/views.py — RESTful API 视图
POST /api/auth/register  注册
POST /api/auth/login     登录（含锁定）
POST /api/auth/logout    登出
GET  /api/users/         列表（分页）
GET  /api/users/{id}/    详情
"""
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UserProfile
from .serializers import (
    UserLoginSerializer,
    UserPublicSerializer,
    UserRegisterSerializer,
)


# ===== 确保每个 User 有 Profile（可放在 signals 里，这里保持简单）=====
def _ensure_profile(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


# ============ 注册 ============
class RegisterAPIView(generics.CreateAPIView):
    """POST /api/auth/register — 用户注册"""
    serializer_class = UserRegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)

        # 注册后自动签发 token
        token, _ = Token.objects.get_or_create(user=user)
        _ensure_profile(user)

        return Response(
            {
                "ok": True,
                "token": token.key,
                "user": UserPublicSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def perform_create(self, serializer):
        return serializer.save()


# ============ 登录 ============
class LoginAPIView(APIView):
    """POST /api/auth/login — 登录 + 锁定（锁定检查在密码校验之前）"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]

        # 查找用户（不用 authenticate，因为用户不存在时 authenticate 也返回 None）
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {"ok": False, "error": "USER_NOT_FOUND", "message": "用户不存在"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # 确保有 profile
        profile = _ensure_profile(user)

        # ★ 锁定检查 —— 在密码哈希校验之前执行！
        if profile.locked_until and profile.locked_until > timezone.now():
            remaining = int((profile.locked_until - timezone.now()).total_seconds())
            return Response(
                {
                    "ok": False,
                    "error": "ACCOUNT_LOCKED",
                    "message": f"账户已锁定，请 {remaining} 秒后重试",
                    "locked_until": profile.locked_until.isoformat(),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # 密码校验
        if not user.check_password(password):
            profile.failed_attempts += 1
            if profile.failed_attempts >= settings.LOGIN_MAX_ATTEMPTS:
                profile.locked_until = timezone.now() + timedelta(seconds=settings.LOGIN_LOCK_SECONDS)
                profile.save()
                return Response(
                    {
                        "ok": False,
                        "error": "ACCOUNT_LOCKED",
                        "message": "密码错误次数过多，账户已锁定 5 分钟",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            profile.save()
            remaining = settings.LOGIN_MAX_ATTEMPTS - profile.failed_attempts
            return Response(
                {
                    "ok": False,
                    "error": "WRONG_PASSWORD",
                    "message": "密码错误",
                    "remaining": remaining,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # 密码正确 —— 重置计数 + 签发/返回 token
        profile.failed_attempts = 0
        profile.locked_until = None
        profile.save()

        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "ok": True,
                "token": token.key,
                "user": UserPublicSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


# ============ 登出 ============
class LogoutAPIView(APIView):
    """POST /api/auth/logout — 登出（删除当前 token）"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        token = request.auth
        if token:
            token.delete()
        return Response({"ok": True, "message": "已登出"}, status=status.HTTP_200_OK)


# ============ 用户读取接口 ============
class UserListView(generics.ListAPIView):
    """GET /api/users/ — 用户列表（分页）"""
    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserPublicSerializer
    permission_classes = [permissions.IsAuthenticated]


class UserDetailView(generics.RetrieveAPIView):
    """GET /api/users/{id}/ — 用户详情"""
    queryset = User.objects.all()
    serializer_class = UserPublicSerializer
    permission_classes = [permissions.IsAuthenticated]
