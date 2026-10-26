/**
 * auth.js — 对接 Django 后端 API
 *
 * 后端路由：
 *   POST /api/auth/register/  → 注册
 *   POST /api/auth/login/     → 登录（含锁定）
 *   POST /api/auth/logout/    → 登出
 *   GET  /api/users/          → 用户列表（分页 + IsAuthenticated）
 *   GET  /api/users/{id}/      → 用户详情
 *
 * 令牌机制：DRF TokenAuthentication，前端存 token 字符串到 localStorage，
 * 每次请求受保护接口带 Header: Authorization: Token <key>
 *
 * 密码哈希 / 锁定逻辑全部在后端（Django check_password + UserProfile.locked_until）
 * 前端不再存任何用户密码或哈希
 */
(function (global) {

  // ===== 后端地址（固定 8766；前端跑在 8765 时可跨域访问）=====
  var API_BASE = "http://127.0.0.1:8766/api";

  function getApiBase() {
    // 允许通过 window.FOCUSFLOW_API_BASE 覆盖（生产部署时设为同域或后端域名）
    return (global.FOCUSFLOW_API_BASE || API_BASE).replace(/\/$/, "");
  }

  // ===== fetch 封装 =====
  async function apiRequest(path, method, body, token) {
    var opts = {
      method: method || "GET",
      headers: { "Content-Type": "application/json" },
      mode: "cors"
    };
    if (token) opts.headers["Authorization"] = "Token " + token;
    if (body) opts.body = JSON.stringify(body);

    try {
      var resp = await fetch(getApiBase() + path, opts);
      var data = null;
      try { data = await resp.json(); } catch (e) {}

      return {
        ok: resp.ok,
        status: resp.status,
        data: data,
        _rawStatusText: resp.statusText,
      };
    } catch (e) {
      // 网络不可达 → 后端未启动
      return {
        ok: false,
        status: 0,
        data: null,
        networkError: true,
        error: "NETWORK_ERROR",
        message: "无法连接到后端服务，请确认 Django 已启动（python manage.py runserver）",
      };
    }
  }

  function saveSession(token, username) {
    Storage.set("currentToken", token);
    Storage.set("currentUsername", username);
  }

  function clearSession() {
    Storage.remove("currentToken");
    Storage.remove("currentUsername");
  }

  // ===== FR-22: 注册 =====
  async function register(username, password) {
    username = (username || "").trim();
    // 前端快速校验（后端会再次校验）
    if (username.length < 3 || username.length > 20) {
      return { ok: false, error: "USERNAME_SHORT", message: "用户名需 3-20 个字符" };
    }
    if (password.length < 6) {
      return { ok: false, error: "PASSWORD_SHORT", message: "密码至少 6 位" };
    }

    var r = await apiRequest("/auth/register/", "POST", {
      username: username,
      password: password,
      password2: password,  // Django serializer 要求
    });

    if (r.networkError) return r;

    if (r.ok) {
      saveSession(r.data.token, r.data.user.username);
      EventBus.emit("auth:login", { username: r.data.user.username });
      return { ok: true, token: r.data.token, user: r.data.user };
    }

    // 后端返回错误 → 转成业务可读的错误码
    var msg = (r.data && (r.data.username || r.data.password || r.data.password2 || r.data.detail));
    if (Array.isArray(msg)) msg = msg[0];
    msg = msg || "注册失败";

    var errCode = "REGISTER_FAILED";
    if (r.status === 400 && msg.indexOf("已存在") >= 0) errCode = "USER_EXISTS";
    else if (msg.indexOf("用户名") >= 0) errCode = "USERNAME_INVALID";
    else if (msg.indexOf("密码") >= 0) errCode = "PASSWORD_INVALID";

    return { ok: false, error: errCode, message: String(msg) };
  }

  // ===== FR-23: 登录（锁定逻辑后端实现）=====
  async function login(username, password) {
    var r = await apiRequest("/auth/login/", "POST", {
      username: username,
      password: password,
    });

    if (r.networkError) return r;

    if (r.ok) {
      saveSession(r.data.token, r.data.user.username);
      EventBus.emit("auth:login", { username: r.data.user.username });
      return { ok: true, token: r.data.token, user: r.data.user };
    }

    // 透传后端错误码（WRONG_PASSWORD / USER_NOT_FOUND / ACCOUNT_LOCKED）
    return {
      ok: false,
      error: (r.data && r.data.error) || "LOGIN_FAILED",
      message: (r.data && r.data.message) || "登录失败",
      remaining: r.data && r.data.remaining,
      lockedUntil: r.data && r.data.lockedUntil,
    };
  }

  // ===== FR-24: 令牌校验（路由守卫）=====
  // 前端只做快速可用性检查（token 字符串存在），真正有效性由后端每次请求校验
  function validateCurrentSession() {
    var token = Storage.get("currentToken", null);
    var username = Storage.get("currentUsername", null);
    if (!token || !username) return null;
    return { username: username, token: token };
  }

  // ===== FR-26: 登出 =====
  async function logout() {
    var token = Storage.get("currentToken", null);
    var username = Storage.get("currentUsername", null);

    if (token) {
      // 通知后端删除 token（忽略失败）
      try {
        await apiRequest("/auth/logout/", "POST", {}, token);
      } catch (e) {}
    }

    clearSession();
    EventBus.emit("auth:logout", { username: username });
  }

  function forceLogout() {
    clearSession();
  }

  // ===== 受保护 API 的 fetch 辅助 =====
  async function authedFetch(path, method, body) {
    var token = Storage.get("currentToken", null);
    if (!token) return { ok: false, error: "NOT_AUTHENTICATED", message: "未登录" };
    return apiRequest(path, method, body, token);
  }

  global.Auth = {
    MAX_ATTEMPTS: 5,
    LOCK_MS: 5 * 60 * 1000,
    API_BASE: API_BASE,
    register: register,
    login: login,
    validateCurrentSession: validateCurrentSession,
    logout: logout,
    forceLogout: forceLogout,
    authedFetch: authedFetch,
  };
})(window);
