"""
accounts/tests.py — Django TestCase 单元测试
验证：注册 / 登录 / 锁定 / 密码哈希 / 列表读取
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import UserProfile


class RegisterTests(TestCase):
    """POST /api/auth/register"""

    def setUp(self):
        self.client = APIClient()

    def test_register_success_creates_user(self):
        """正确数据 → 201 + 返回 token"""
        r = self.client.post(
            "/api/auth/register/",
            {"username": "alice", "password": "secret123", "password2": "secret123"},
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["ok"])
        self.assertIn("token", r.data)
        self.assertEqual(r.data["user"]["username"], "alice")
        # 数据库确认
        self.assertTrue(User.objects.filter(username="alice").exists())

    def test_register_password_is_hashed(self):
        """密码不应明文存库"""
        self.client.post(
            "/api/auth/register/",
            {"username": "bob", "password": "plaintext999", "password2": "plaintext999"},
            format="json",
        )
        user = User.objects.get(username="bob")
        # Django 密码哈希格式：pbkdf2_sha256$260000$<salt>$<hash>
        self.assertNotEqual(user.password, "plaintext999")
        self.assertTrue(user.password.startswith("pbkdf2_sha256$"))

    def test_register_duplicate_rejected(self):
        """重复用户名 → 400"""
        self.client.post(
            "/api/auth/register/",
            {"username": "alice", "password": "xxx123456", "password2": "xxx123456"},
            format="json",
        )
        r2 = self.client.post(
            "/api/auth/register/",
            {"username": "alice", "password": "yyy123456", "password2": "yyy123456"},
            format="json",
        )
        self.assertEqual(r2.status_code, 400)

    def test_register_password_mismatch(self):
        """两次密码不一致 → 400"""
        r = self.client.post(
            "/api/auth/register/",
            {"username": "charlie", "password": "aaa111", "password2": "bbb222"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_register_short_username(self):
        """用户名 < 3 字符 → 400"""
        r = self.client.post(
            "/api/auth/register/",
            {"username": "ab", "password": "secret123", "password2": "secret123"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)


class LoginTests(TestCase):
    """POST /api/auth/login"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="dave", password="mypassword123")
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)

    def test_login_success_returns_token(self):
        """正确密码 → 200 + token"""
        r = self.client.post(
            "/api/auth/login/",
            {"username": "dave", "password": "mypassword123"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["ok"])
        self.assertIn("token", r.data)

    def test_login_wrong_password(self):
        """错误密码 → 401 + remaining"""
        r = self.client.post(
            "/api/auth/login/",
            {"username": "dave", "password": "wrongwrong"},
            format="json",
        )
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.data["error"], "WRONG_PASSWORD")
        self.assertIn("remaining", r.data)

    def test_login_user_not_found(self):
        """不存在用户 → 404"""
        r = self.client.post(
            "/api/auth/login/",
            {"username": "ghost", "password": "whatever"},
            format="json",
        )
        self.assertEqual(r.status_code, 404)

    def test_login_locked_before_password_check(self):
        """锁定期间正确密码也拒绝 — 锁定检查在密码校验之前"""
        self.profile.locked_until = timezone.now() + timedelta(minutes=5)
        self.profile.save()

        r = self.client.post(
            "/api/auth/login/",
            {"username": "dave", "password": "mypassword123"},  # 正确密码
            format="json",
        )
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["error"], "ACCOUNT_LOCKED")

    def test_login_5_fails_triggers_lock(self):
        """连续 5 次错误密码 → 第 5 次返回 ACCOUNT_LOCKED"""
        for i in range(4):
            self.client.post(
                "/api/auth/login/",
                {"username": "dave", "password": "wrong" + str(i)},
                format="json",
            )
        # 第 5 次
        r = self.client.post(
            "/api/auth/login/",
            {"username": "dave", "password": "wrongFinal"},
            format="json",
        )
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["error"], "ACCOUNT_LOCKED")

        # profile 确认锁定
        self.profile.refresh_from_db()
        self.assertIsNotNone(self.profile.locked_until)
        self.assertTrue(self.profile.locked_until > timezone.now())

    def test_login_success_resets_failed_attempts(self):
        """锁定过期 + 正确密码 → 成功登录 + 计数器归零"""
        self.profile.failed_attempts = 3
        self.profile.locked_until = timezone.now() - timedelta(seconds=10)  # 已过期
        self.profile.save()

        r = self.client.post(
            "/api/auth/login/",
            {"username": "dave", "password": "mypassword123"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.failed_attempts, 0)
        self.assertIsNone(self.profile.locked_until)


class UserListTests(TestCase):
    """GET /api/users/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="eve", password="pass123456")
        self.token, _ = Token.objects.get_or_create(user=self.user)

    def test_list_requires_auth(self):
        """未登录 → 401"""
        r = self.client.get("/api/users/")
        self.assertEqual(r.status_code, 401)

    def test_list_paginated(self):
        """已登录 → 200 + 分页结构"""
        for i in range(25):
            User.objects.create_user(username=f"user_{i}", password="pw123456")
        # 带 token
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        r = self.client.get("/api/users/")
        self.assertEqual(r.status_code, 200)
        # DRF PageNumberPagination 默认返回 count/next/previous/results
        self.assertIn("count", r.data)
        self.assertIn("results", r.data)
        self.assertTrue(len(r.data["results"]) <= 20)  # PAGE_SIZE=20

    def test_list_does_not_expose_password(self):
        """密码绝不能在读取接口暴露"""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        r = self.client.get("/api/users/")
        self.assertNotIn("password", r.data["results"][0])


class LogoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="frank", password="pw123456")
        self.token, _ = Token.objects.get_or_create(user=self.user)

    def test_logout_deletes_token(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        r = self.client.post("/api/auth/logout/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(Token.objects.filter(key=self.token.key).exists())
