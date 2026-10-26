# FocusFlow — 智能待办清单与番茄钟专注计时工具

> 课程大作业 · 《未来技术》· 兰天霖

## 项目简介

FocusFlow 是一款面向学生群体的**轻量化 Web 工具**，将**待办任务管理**与**番茄钟专注计时**深度联动。

**前后端分离架构**：
- 前端：纯 HTML + CSS + JS（无框架），后端用 Django REST Framework
- 认证：Django TokenAuthentication，密码 pbkdf2_sha256 哈希存储
- 锁定：连续 5 次密码错误自动锁定账户 5 分钟（锁定检查在密码校验之前）
- 数据库：SQLite（零配置），可切换 MySQL/PostgreSQL

核心流程：**打开 → 注册/登录 → 添加任务 → 选中任务 → 开始番茄钟 → 专注 25 分钟 → 听到提示音 → 任务 +1 番茄 → 自动进入休息 → 查看统计**

## 功能清单

| 模块 | 功能 |
|------|------|
| 🔐 **用户认证** | Django 后端注册/登录/登出、TokenAuthentication、5 次锁定 5 分钟 |
| 📋 **任务管理** | 新增、编辑、删除、完成标记、优先级、状态筛选 |
| 🍅 **番茄计时** | 专注（25min）/ 短休息（5min）/ 长休息（15min）、倒计时、暂停/恢复/跳过、Web Audio 提示音 |
| 🔗 **任务联动** | 选中任务启动计时、番茄数自动回写到任务卡片 |
| 📊 **数据统计** | 今日完成任务数、今日专注时长、今日番茄完成数、连续番茄计数 |
| ⚙️ **自定义设置** | 专注/短休息/长休息时长、长休息间隔（2-8）、提示音开关 |
| 👥 **用户读取 API** | GET /api/users/ 分页、GET /api/users/{id}/ 详情（IsAuthenticated） |

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 前端 | HTML5 + CSS3 + JS ES6+ | — |
| 前端 HTTP | Fetch API（调 Django REST API）| — |
| 后端 | Django | 5.2.6 |
| 后端 API | djangorestframework | 3.18.3 |
| 后端认证 | rest_framework.authtoken + TokenAuthentication | — |
| CORS | django-cors-headers | 4.9.0 |
| 数据库 | SQLite（可切换 MySQL） | — |
| 密码哈希 | Django 内置 pbkdf2_sha256 | — |

## 快速启动

```bash
# ===== 1. 后端（另开一个终端）=====
cd backend
python manage.py migrate          # 建表（首次）
python manage.py runserver        # 启动后端 → http://127.0.0.1:8000

# ===== 2. 前端 =====
# 方式 A：HTTP 服务器（推荐）
python -m http.server 8080 --directory src/
# 浏览器打开 http://localhost:8080

# 方式 B：直接双击 src/index.html
```

> **首次使用**：浏览器打开后先注册一个账号（3-20 字符用户名 + ≥6 位密码），注册成功自动登录。

## 后端 API 一览

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register/` | AllowAny | 注册 → 返回 token + 用户 |
| POST | `/api/auth/login/` | AllowAny | 登录（含 5 次锁定） |
| POST | `/api/auth/logout/` | TokenAuth | 登出（删除当前 Token）|
| GET  | `/api/users/` | TokenAuth | 用户列表（分页 20/页）|
| GET  | `/api/users/{id}/` | TokenAuth | 用户详情 |

错误码：`WRONG_PASSWORD` / `USER_NOT_FOUND` / `ACCOUNT_LOCKED` / `USER_EXISTS`

## 项目结构

```
.
├── AGENTS.md                          # 大作业规则文档
├── README.md
├── .gitignore
├── _bmad-output/
│   ├── planning-artifacts/
│   │   ├── product-brief.md           # 产品简报
│   │   ├── prd.md                     # 需求规格（FR-1 ~ FR-26）
│   │   ├── architecture.md            # 技术架构
│   │   └── epics-and-stories.md       # 任务拆分
│   └── implementation-artifacts/
│       ├── iteration-1.md             # 纯前端迭代
│       ├── iteration-2.md             # 纯前端 auth 迭代
│       ├── iteration-3.md             # Django 后端接入（含踩坑记录）
│       ├── build-report.md
│       └── test-report.md             # 34/34 前端逻辑 + 15/15 Django 测试
├── src/                               # 前端
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js                     # 主控制器（含登录守卫 boot）
│       ├── auth.js                    # 认证（调 Django API）
│       ├── event-bus.js / storage.js / utils.js
│       ├── settings.js / task-manager.js / timer.js / stats.js
└── backend/                           # Django 后端
    ├── manage.py
    ├── focusflow_backend/
    │   ├── settings.py                # DRF + authtoken + CORS + 锁定
    │   └── urls.py
    └── accounts/
        ├── models.py                  # UserProfile（OneToOne → auth.User）
        ├── serializers.py             # Register / Login / UserPublic
        ├── views.py                   # 5 个 API View
        ├── urls.py
        ├── admin.py
        ├── tests.py                   # 15 个 TestCase
        └── migrations/
```

## BMAD-Method 工作流产物

| 阶段 | 产物 | Commit |
|------|------|--------|
| 初始化 | AGENTS.md + .gitignore | `be34483` |
| 需求分析 | product-brief.md + prd.md | `3045f21` |
| 规划与设计 | architecture.md + epics-and-stories.md | `411b650` |
| 开发实现 | 纯前端功能 | `1bb385f`（merge `76dd259`） |
| 认证系统 | 前端 LocalStorage auth + PRD 扩展 | `0649567`（merge `8f236c6`） |
| **后端接入** | **Django + DRF + CORS + Token + SQLite** | **`99fed30`（merge `7a776a3`）** |
| 验证改进 | 34/34 前端 + 15/15 Django 测试 | `570750d` |

## Git 分支与合并痕迹

```
*   7a776a3  Merge branch 'feature/backend-django' into main  ← merge --no-ff ✅
|\
| * 99fed30  feat: 搭建 Django 后端（DRF+CORS+Token+SQLite）+ 15 单元测试
|/
*   8f236c6  Merge branch 'feature/auth' into main
*   76dd259  Merge branch 'feature/full-implementation' into main
  ... 更早的 BMAD 四阶段 ...
```

## 测试结果

| 层 | 测试类型 | 结果 |
|----|---------|------|
| 前端 JS 语法 | 8 文件 Function constructor 检查 | **8/8 PASS** |
| 前端核心逻辑 | Node.js with(g) 沙箱 34 用例 | **34/34 PASS** |
| Django TestCase | accounts.tests 15 用例 | **15/15 PASS** |
| API 端到端 | Python urllib 8 用例 | **8/8 PASS** |

### Django 单元测试覆盖

| 测试类 | 用例 | 覆盖点 |
|--------|------|--------|
| RegisterTests (5) | 成功+201 / 密码哈希非明文pbkdf2_sha256前缀 / 重复用户名400 / 两次密码不一致400 / 用户名<3→400 | ✅ |
| LoginTests (6) | 正确密码200+token / 错误密码401+remaining / 用户不存在404 / **锁定期间正确密码仍403** / 5次错误→第5次ACCOUNT_LOCKED / 过期锁定成功+计数器归零 | ✅ |
| UserListTests (3) | 未认证401 / 分页count+results / 无password字段暴露 | ✅ |
| LogoutTests (1) | 登出后Token删除 | ✅ |

## 安全边界声明

| 点 | 实现 | 风险 |
|----|------|------|
| 密码存储 | Django `User.set_password()` → pbkdf2_sha256 哈希 | ✅ 安全 |
| 锁定绕过 | **锁定检查在 `check_password` 之前**执行 | ✅ 防止锁定期间用正确密码绕过 |
| 读取接口 | `IsAuthenticated` 权限 + `UserPublicSerializer` 不暴露 password | ✅ |
| CORS | 开发环境 `CORS_ALLOW_ALL_ORIGINS=True` | ⚠️ 生产需改白名单 |
| Token | DRF TokenAuthentication（随机 40 字符） | ⚠️ 默认永不过期，v2 换 JWT |
| 前端篡改 token | `auth.js` 只存字符串，无法伪造有效 Token（后端校验） | ✅ |

## 核心演示流程（可当场跑通）

1. 后端已启动 `http://127.0.0.1:8000`
2. 前端 `http://localhost:8080` 打开登录页
3. 点"注册"Tab → 输入 username / password / password2 → 注册成功自动登录
4. 添加任务 → 选中 → 开始番茄钟
5. 连续输错后端登录密码 5 次 → 观察账户被锁定（5 分钟）
6. 后端 admin：`python manage.py createsuperuser` → 访问 `/admin/` 看 UserProfile 锁定状态

## 迭代历史

- **Iteration 1** — 纯前端骨架 + 完整功能（任务/计时/联动/统计/设置）
- **Iteration 2** — 前端 LocalStorage 认证（注册/登录/令牌/5 次锁定）
- **Iteration 3** — Django 后端接入（DRF + Token + SQLite）+ 前端 auth.js 改调后端 API

详细技术决策见 [iteration-3.md](_bmad-output/implementation-artifacts/iteration-3.md)
