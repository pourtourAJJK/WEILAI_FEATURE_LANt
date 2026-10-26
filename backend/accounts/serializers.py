"""
accounts/serializers.py — DRF Serializer
"""
from django.contrib.auth.models import User
from rest_framework import serializers


class UserRegisterSerializer(serializers.ModelSerializer):
    """注册：仅暴露 username + password，密码不回显"""
    password = serializers.CharField(write_only=True, min_length=6, max_length=128)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("username", "password", "password2", "email")
        extra_kwargs = {
            "email": {"required": False, "allow_blank": True},
            "username": {"min_length": 3, "max_length": 20},
        }

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "两次密码不一致"})
        return attrs

    def create(self, validated_data):
        # 经验 419896：必须走 create_user 或 set_password，绝不能直接写 password 字段
        validated_data.pop("password2")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],  # create_user 内部会哈希
        )
        return user


class UserLoginSerializer(serializers.Serializer):
    """登录：输入 username + password"""
    username = serializers.CharField()
    password = serializers.CharField()


class UserPublicSerializer(serializers.ModelSerializer):
    """读取接口：安全暴露的用户字段（不含密码）"""
    class Meta:
        model = User
        fields = ("id", "username", "email", "is_active", "date_joined")
        read_only_fields = fields
