# Iteration 3 — Django 后端接入（DRF + Token + SQLite + 5 次锁定）

**日期**：2026-10-26  
**分支**：`feature/backend-django` → merge 入 `main`（--no-ff）  
**Commit**：开发 `99fed30` / merge `7a776a3`  
**后端技术栈**：Django 5.2 + DRF 3.18 + TokenAuthentication + django-cors-headers 4.9 + SQLite

---

## 为什么选 Django 而不是 FastAPI / Spring Boot

| 维度 | Django + DRF | 说明 |
|------|-------------|------|
| **大作业已有环境** | ✅ 预装（pip show 确认 5.2.6 + DRF 3.18.3） | 零额外安装 |
| **密码哈希体系稳定** | ✅ `create_user()` / `set_password()` 自动 pbkdf2_sha256 | **经验 283813 教训**：绝不能混用原生 bcrypt 写库 + check_password 校验 |
| **TokenAuthentication** | ✅ `rest_framework.authtoken` 开箱即用 | 经验 179090 强调必须加 `authtoken` 到 INSTALLED_APPS |
| **SQLite 零配置** | ✅ `db.sqlite3` 单文件 | 无需装 MySQL，大作业演示方便 |
| **分页 / 权限 / 校验** | ✅ DRF Default 开箱（PageNumberPagination + IsAuthenticated） | 写量最少 |

## 后端目录结构

```
backend/
├── manage.py
├── focusflow_backend/          # Django project
│   ├── settings.py             # DRF + authtoken + cors + SQLite + 锁定配置
│   └── urls.py                 # root → /api/ 委托给 accounts
└── accounts/                   # 我们的 app
    ├── models.py               # (auth.User 内置) + UserProfile 扩展锁定字段
    ├── serializers.py          # RegisterSerializer / LoginSerializer / UserPublicSerializer
    ├── views.py                # 5 个 API View（注册/登录/登出/列表/详情）
    ├── urls.py                 # /api/auth/* + /api/users/*
    ├── admin.py                # UserProfile 内联到 admin
    ├── tests.py                # 15 个 TestCase
    └── migrations/             # 自动生成
```

## 数据模型（两层）

```
Django User（内置 auth.User）
├── username         (unique, 3-128)
├── password         ★ set_password() 自动 pbkdf2_sha256 哈希
├── email
├── is_active
├── date_joined
└── last_login

UserProfile（accounts.UserProfile, OneToOneField → User）
├── user             OneToOne → auth.User
├── failed_attempts  默认 0
├── locked_until     DateTimeField(nullable) 锁定到期时间
└── created_at / updated_at

authtoken.Token（DRF 内置）
├── key              40 字符随机字符串 = 我们的"令牌"
├── user             ForeignKey → User
└── created
```

## API 契约

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register/` | AllowAny | 注册（username + password + password2）→ 返回 token |
| POST | `/api/auth/login/` | AllowAny | 登录 → Token |
| POST | `/api/auth/logout/` | TokenAuth | 登出（删除当前 Token） |
| GET  | `/api/users/` | TokenAuth | 用户列表，分页（PAGE_SIZE=20）|
| GET  | `/api/users/{id}/` | TokenAuth | 用户详情 |

### 登录响应错误码（与前端 auth.js 对应）

| HTTP | error 字段 | 含义 |
|------|-----------|------|
| 200  | — | 成功，返回 token |
| 400  | — | 参数校验失败（重复用户名、密码不一致等）|
| 401  | WRONG_PASSWORD | 密码错误，带 remaining 字段 |
| 403  | ACCOUNT_LOCKED | 5 次锁定或锁定期间 |
| 404  | USER_NOT_FOUND | 用户不存在 |

## 锁定实现的关键细节（经验 2161745 + 283813）

```
LoginAPIView.post() 逻辑顺序：
  1. User.objects.get(username=username)     ← 查用户（不存在 → 404）
  2. _ensure_profile(user)                   ← 确保有 UserProfile
  3. ★ locked_until > now?                  ← 锁定检查在密码校验之前！
     → YES: 403 ACCOUNT_LOCKED，不进密码校验
  4. user.check_password(password)          ← Django 内置 pbkdf2 校验
  5. 密码错: failed_attempts +=1 → 达 5 次 → locked_until = now+5min
  6. 密码对: failed_attempts=0, locked_until=None → get_or_create Token
```

**为什么 `check_password` 一定能和 `set_password` 对应？**  
因为 Django 只走自己的哈希体系（pbkdf2_sha256 默认），不会混用 bcrypt / 原生 $2b$ 格式。这是经验 283813 的核心教训。

## 密码为什么不暴露

UserPublicSerializer 只暴露 `(id, username, email, is_active, date_joined)` — password 字段**根本没写进 Meta.fields**，DRF 自动排除。

## 前端 auth.js 改造

从纯 LocalStorage 哈希方案 → fetch 调 Django API：
- 注册/登录：fetch POST → 后端返回 token → 存 LocalStorage `ff_current_token`
- 每次 fetch 带 `Authorization: Token <key>` 头
- 密码**再也不经过前端本地存储或哈希**
- 锁定逻辑、密码校验完全在后端

## 测试结果

### Django TestCase — 15/15 PASS

| 类 | 用例 | 验证点 |
|----|------|--------|
| RegisterTests (5) | 注册成功 + 201 + token | ✅ |
| | 密码哈希非明文 | ✅ pbkdf2_sha256 前缀 |
| | 重复用户名 → 400 | ✅ |
| | 两次密码不一致 → 400 | ✅ |
| | 用户名 <3 → 400 | ✅ |
| LoginTests (6) | 正确密码 → 200 + token | ✅ |
| | 错误密码 → 401 + remaining | ✅ |
| | 用户不存在 → 404 | ✅ |
| | **锁定期间正确密码也拒绝** | ✅（锁定检查在密码校验前）|
| | 5 次错误 → 第 5 次 ACCOUNT_LOCKED | ✅ |
| | 过期锁定成功登录 + 计数器归零 | ✅ |
| UserListTests (3) | 未认证 → 401 | ✅ |
| | 分页 count/results | ✅ |
| | 无 password 字段暴露 | ✅ |
| LogoutTests (1) | 登出后 Token 被删 | ✅ |

### 端到端 API 验证 — 8/8 PASS

- 注册 201 + token ✅
- 重复注册 400 ✅
- 登录成功 200 + token ✅
- 错误密码 5 次 → 第 5 次 403 ACCOUNT_LOCKED ✅
- 锁定期间正确密码 → 仍 403 ✅
- 用户列表带 token → 200 + count ✅
- 用户列表无 token → 401 ✅
- 登出 200 ✅

## 如何启动

```bash
# 1. 后端（首次）
cd backend
python manage.py migrate
python manage.py runserver

# 2. 前端（另一个终端）
cd ..
python -m http.server 8080 --directory src/

# 3. 浏览器打开 http://localhost:8080
#    后端 API 在 http://127.0.0.1:8000/api/
```

## 已知局限

1. **Token 无过期**：DRF TokenAuthentication 默认永不过期（除非手动删 Token 记录）。v2 可换 JWT（simplejwt）
2. **CORS 全开**：`CORS_ALLOW_ALL_ORIGINS = True` 仅开发用，生产需改白名单
3. **数据库 SQLite**：并发写入能力差，生产换 MySQL/PostgreSQL
4. **只有一个锁定维度（账户）**：v2 可加 IP 维度 / 设备维度
5. **前端 API_BASE 硬编码**：生产部署需设 `window.FOCUSFLOW_API_BASE = "..."` 覆盖
