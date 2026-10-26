# Iteration 7 — 用户头像上传 + 修改密码

**日期**: 2026-10-27
**分支**: `feature/user-profile` → merge `fb6fce1ccfd`
**需求来源**: 用户"增加用户管理功能，可以上传头像和修改密码"

---

## 一、改动说明

本轮新增用户头像上传和修改密码功能，**Django 后端 / LocalStorage 降级双路径全部打通**。

### 后端（Django 5.2.6 + DRF 3.18.3）

| 文件 | 改动 |
|------|------|
| `accounts/models.py` | `UserProfile` 新增 `avatar = ImageField(upload_to='avatars/', null=True, blank=True)` |
| `focusflow_backend/settings.py` | 新增 `MEDIA_ROOT` / `MEDIA_URL` / 文件上传 5MB 上限 |
| `focusflow_backend/urls.py` | 新增 `static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)` 开发模式暴露 |
| `accounts/serializers.py` | `UserPublicSerializer` 新增 `get_avatar()` 方法 → 用 `request.build_absolute_uri()` 生成完整可下载 URL |
| `accounts/views.py` | ① `ChangePasswordAPIView`（POST `/api/auth/change-password/`）：旧密码校验 → `user.set_password()` → **所有 Token 强制失效**（`Token.objects.filter(user).delete()`）→ 前端随后清 session + reload ② `AvatarUploadAPIView`（POST `/api/auth/avatar/`）：multipart/form-data 白名单 jpg/png/gif/webp + 5MB 校验 + 文件重命名 `<user_id>_<timestamp>.<ext>` + 删旧文件 ③ register/login 两处 serializer 调用补了 `context={"request": request}` 让 avatar 能拿到完整 URL |
| `accounts/urls.py` | 新增两条路由 |
| `accounts/migrations/0002_userprofile_avatar.py` | 新 migration，已 `migrate` 完成 |

### 前端（三文件改动）

| 文件 | 改动 |
|------|------|
| `auth.js` | 新增 6 个导出函数 + 2 个事件发射 ① `changePassword(oldPwd, newPwd)` — Django：`apiRequest POST /auth/change-password/`；LS：SHA-256 校验旧密码后更新 `ff_users[].passwordHash` ② `uploadAvatar(file)` — Django：**专门的 `apiUpload()` FormData fetch**（apiRequest 固定 JSON Content-Type 不能复用）；LS：FileReader 读 base64 DataURL → Storage.set("ff_avatar_<username>", dataUrl) ③ `getAvatar()` — 读 currentAvatar 或 ff_avatar_<username> ④ `saveAvatarFromUser(userData)` — 登录/注册成功时从返回的 `user.avatar` 字段写入 ⑤ `EventBus.emit("auth:avatar-updated")` — 头像更新时通知全局 ⑥ login/register 成功路径补了 `saveAvatarFromUser(r.data.user)` |
| `index.html` | ① user-area 新增 `<img id="user-avatar" class="user-avatar" hidden />` 和 `<button id="btn-profile">👤</button>` ② 新增完整的 `#profile-modal`：头像圆图 + file input（accept=image/jpeg,image/png,image/gif,image/webp）+ 用户名 + 新密码三字段 + 消息提示 |
| `app.js` | ① `showMainApp()` 里加 `syncUserAvatar()` ② `bindBusEvents()` 加 `auth:avatar-updated` 全局联动（同步 header 小头像 + modal 预览圆图）③ 6 个新函数：openProfileModal / closeProfileModal / refreshAvatarPreview / handleAvatarFile（FileReader 即时预览 + 调用 Auth.uploadAvatar）/ handleChangePassword / setProfileMsg ④ bindMainDomEvents 里绑 btn-profile + avatar-input + profile-pwd-submit + profile-close + modal 遮罩 + Esc 优先关 profile modal |
| `style.css` | 新增 `.user-avatar`（圆形 32×32）+ `.profile-btn` + `.profile-modal` 全套（头像区 flex 横排 + 88px 圆图 + 上传按钮 + 密码 form + success/error 消息颜色） |

## 二、技术决策

### 2.1 `apiUpload()` — 单独的 multipart fetch（不复用 apiRequest）
原 `apiRequest` 硬编码 `headers: {"Content-Type": "application/json"}`，头像上传需要 `multipart/form-data`（浏览器自动设 boundary），**Content-Type 不能手动设**。所以新写了一个 `apiUpload(path, file, token)` 函数：
```js
var fd = new FormData();
fd.append("avatar", file);
return fetch(baseUrl + path, { method:"POST", headers:{Authorization:"Token "+token}, body:fd });
```
**教训**（经验 869765）：头像上传不能盲目复用项目里的 JSON fetch 封装，要先确认请求头契约。

### 2.2 修改密码 → 强制登出
Django 后端用 `Token.objects.filter(user).delete()` 把该用户所有已签发的 Token 全删掉 → 前端 `Auth.forceLogout()` + `location.reload()` → 回到登录页。这是安全最佳实践，避免旧密码泄露后 token 仍可用。

### 2.3 头像白名单 + 大小校验（Django + LS 双路径独立做）
- 后端：ALLOWED_AVATAR_EXT = {"jpg","jpeg","png","gif","webp"}，5MB（与 settings.py FILE_UPLOAD_MAX_MEMORY_SIZE 对齐）
- 前端 LS 路径：同样的 mime type 白名单 + 5MB size 校验
- 前端 FileReader 即时本地预览（不等后端返回），让用户秒看到效果

### 2.4 EventBus 双 emit（auth:avatar-updated + 登录成功时 saveAvatarFromUser）
- 头像上传成功 → `EventBus.emit("auth:avatar-updated", {avatar: ...})`
- 登录/注册成功 → `saveAvatarFromUser(r.data.user)` 从 `UserPublicSerializer.avatar` 字段取到完整 URL → EventBus 自动联动 header 小头像

### 2.5 文件名重命名策略
```python
safe_name = f"{request.user.id}_{int(time.time())}.{ext}"
profile.avatar.save(safe_name, avatar, save=True)
```
避免同名文件覆盖，天然生成唯一文件名。

## 三、构建 / 验证结果

| 检查项 | 结果 |
|--------|------|
| auth.js 语法 | ✅ PASS new Function |
| app.js 语法 | ✅ PASS new Function |
| Django migration 0002 应用 | ✅ `Applying accounts.0002_userprofile_avatar... OK` |
| Django settings MEDIA_ROOT/MEDIA_URL 配置 | ✅ `BASE_DIR / "media"` |
| Django 根 urls 加 media 路由 | ✅ 仅 DEBUG 模式（开发用） |
| Django 启动 | ✅ `runserver 8766` 成功监听 |
| index.html 200 + profile 元素存在 | ✅ btn-profile / avatar-input / profile-modal 全部 True |
| auth.js 200 + changePassword/uploadAvatar 存在 | ✅ |
| LS 降级路径完整性 | ✅ 已实现：`Auth.uploadAvatar` 和 `Auth.changePassword` 都先 `ensureBackendStatus()`，不可达时自动走 LS |

## 四、API 契约

### Django 后端

| 方法 | URL | 鉴权 | 请求体 | 响应 |
|------|-----|------|--------|------|
| POST | `/api/auth/change-password/` | Token | `{old_password, new_password, confirm_password}` | `{ok, message}` |
| POST | `/api/auth/avatar/` | Token | `multipart/form-data` field=`avatar` | `{ok, avatar}` — 完整 URL |

### LocalStorage 降级

| 函数 | 存储位置 | 返回 |
|------|---------|------|
| `Auth.changePassword(old, new)` | `ff_users[].passwordHash` (SHA-256) | `{ok, message}` |
| `Auth.uploadAvatar(file)` | `ff_avatar_<username>` (base64 DataURL) | `{ok, avatar}` (base64) |
| `Auth.getAvatar()` | 读 `currentAvatar` 或 `ff_avatar_<username>` | dataURL / URL / null |

## 五、已知局限

1. **头像文件尺寸压缩**：前端 FileReader 读原图上传，Django 后端只存原图。大图（如 4MB 的 3000×3000 PNG）会直接进 media 目录。可加 Pillow 后端压缩到 256×256，暂不做（课程作业够用）。
2. **media 文件清理**：profile.avatar.delete() 只删文件、不删目录，长期运行 avatars/ 目录可能有孤儿文件。可加定时清理或信号监听 post_delete。
3. **浏览器原生 file input 样式**：用 `<label>` 包 `<input hidden>` 实现自定义按钮样式，Firefox / Safari 兼容性良好，但 iOS Safari 对 FileReader.readAsDataURL 的返回可能含本地路径前缀，需要额外处理。
4. **修改密码后需要重新登录**：这是安全设计，但体验上可加"密码修改成功后自动刷新页面 + 提示重新登录"，已做（forceLogout + location.reload）。

## 六、集成点一览

```
backend/accounts/models.py     ← UserProfile.avatar ImageField
backend/accounts/views.py      ← +ChangePasswordAPIView +AvatarUploadAPIView
backend/accounts/serializers.py← +UserPublicSerializer.get_avatar()
backend/accounts/urls.py       ← +2 条新路由
backend/accounts/migrations/   ← +0002_userprofile_avatar.py (已 migrate)
backend/focusflow_backend/settings.py ← +MEDIA_ROOT/MEDIA_URL + 5MB 上传限制
backend/focusflow_backend/urls.py     ← +static media 路由

src/js/auth.js                 ← changePassword/uploadAvatar/getAvatar/saveAvatarFromUser + apiUpload + EventBus emit
src/js/app.js                  ← syncUserAvatar + profile modal 6 个函数 + 2 处事件绑定 + auth:avatar-updated 监听
src/index.html                 ← #btn-profile + #profile-modal + #user-avatar img
src/css/style.css              ← .user-avatar + .profile-btn + .profile-modal 全套样式
```

**External 依赖**：PIL/Pillow（Django ImageField 需要，已 pip install）、EventBus（auth:avatar-updated）、Storage（currentAvatar / ff_avatar_<username> / SHA-256 哈希）。
