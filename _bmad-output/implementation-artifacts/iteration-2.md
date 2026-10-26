# Iteration 2 — 用户认证系统（注册 + 登录 + 令牌 + 5次锁定5分钟）

**日期**：2026-10-26  
**分支**：`feature/auth` → merge 入 `main`（--no-ff）  
**对应 FR**：FR-22（注册）、FR-23（登录+令牌签发）、FR-24（令牌校验/路由守卫）、FR-25（5次失败锁定5分钟）、FR-26（登出）

---

## 改动说明

| 文件 | 改动 | 对应 FR |
|------|------|---------|
| `src/js/auth.js` | **新建** — 完整认证模块：register / login / validateCurrentSession / logout + SHA-256 哈希 + 锁定逻辑 | FR-22~FR-26 |
| `src/js/storage.js` | KEYS 新增 `users`、`authState`、`currentToken`、`currentUsername` | — |
| `src/index.html` | 新增登录/注册页（默认显示），主应用区域加 `.hidden` 控制，顶部加用户显示 + 登出按钮 | — |
| `src/css/style.css` | 新增 `.hidden`、`.auth-page`、`.auth-card`、`.auth-tabs`、`.user-area`、`.btn-logout` 等样式 | — |
| `src/js/app.js` | 启动改为 async `boot()`：先校验 session，未登录 → 显示 auth-page；已登录 → 初始化主应用 | FR-24 |
| `_bmad-output/planning-artifacts/prd.md` | 新增 4.7 节 + FR-22~FR-26；Non-Goals 移除"账号注册/登录"；MVP Scope 加入认证 | FR-22~FR-26 |

## 核心实现要点（踩过的坑）

### 1. 锁定逻辑在密码校验**之前**执行（FR-25）
**必须**在密码哈希比较之前检查 `lockedUntil > now`。否则攻击者可以在锁定期间仍用正确密码登录（锁定变成"防爆破但不防绕过"）。

### 2. SubtleCrypto SHA-256 是 async
`crypto.subtle.digest()` 返回 Promise。所以 auth.js 里 `register` / `login` 都必须是 `async function`，app.js 调用也要 `await`。

### 3. 状态结构设计（FR-25 数据模型）
```
ff_users = [{ username, passwordHash, createdAt }]
ff_auth_state = {
  "alice": {
    failedAttempts: 0,       // 连续失败次数，成功登录归零
    lockedUntil: 0,          // 毫秒时间戳，0=未锁定
    activeToken: "ff_abc...", // 当前有效令牌
    tokenCreatedAt: 1730000000000
  }
}
ff_current_token = "ff_abc..."   // 当前用户的令牌（路由守卫用）
ff_current_username = "alice"    // 方便快速查找 auth_state
```

### 4. 令牌校验（路由守卫）
启动时读 `currentToken` + `currentUsername` → 去 `auth_state[username].activeToken` 对比 → 匹配才放行。手动篡改 localStorage token 会被踢回登录页。

### 5. 错误码结构化返回（参考 experience 1587916）
```js
// 成功
{ ok: true, token, user: { username } }
// 密码错误
{ ok: false, error: 'WRONG_PASSWORD', message: '密码错误', remaining: 2 }
// 锁定
{ ok: false, error: 'ACCOUNT_LOCKED', message: '...', lockedUntil: 1730000300000 }
// 用户不存在
{ ok: false, error: 'USER_NOT_FOUND', message: '用户不存在' }
```

## 构建/验证结果

| 项 | 结果 |
|----|------|
| 9 个 JS 文件语法检查 | **9/9 PASS** |

## 已知局限

1. **前端认证 = 安全性有限**：所有代码在浏览器，用户可以打开 DevTools 直接改 LocalStorage 伪造 token。**本模块实现的是"体验层面的登录"和"防误操作/防小朋友乱玩"的屏障**，不是后端级安全。如需真正安全必须接后端 + HTTPS。
2. **锁定基于账户（非 IP）**：换个浏览器/设备可以绕过锁定，只锁同一个浏览器里的同一个账户。
3. **令牌无服务端吊销**：手动篡改 token 只会让自己被踢回登录，无法影响其他地方的登录。
4. **无找回密码 / 邮箱验证**：v1 明确不在 scope。

## 安全边界声明

> 本次实现的是**前端单页应用的用户体验层认证**。密码 SHA-256 哈希避免明文存储，但密钥/哈希仍在同一浏览器里，**无法抵御有动机的前端攻击者**。如需真正的账户安全（防止密码泄漏、防止前端篡改 token），必须引入后端服务 + HTTPS + 服务端 session/JWT 校验。
