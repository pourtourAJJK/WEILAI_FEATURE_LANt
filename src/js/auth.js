/**
 * auth.js — 自动降级认证
 *
 * 运行模式：
 *   1. 先尝试 fetch Django 后端 API（API_BASE = http://127.0.0.1:8766/api）
 *   2. 如果网络不可达（NETWORK_ERROR）→ 自动降级为 LocalStorage SHA-256 模式
 *
 * 这样：
 *   - 有后端 → 走 Django 完整链路（pbkdf2_sha256 + TokenAuthentication）
 *   - 无后端（沙箱/file://）→ 走 LocalStorage（v2 迭代方案，前端自管哈希 + 锁定）
 *   - 两种模式登录/注册/登出 API 签名完全一致，app.js 无需任何改动
 */
(function (global) {

  var API_BASE = "http://127.0.0.1:8766/api";
  var MAX_ATTEMPTS = 5;
  var LOCK_MS = 5 * 60 * 1000;
  var backendAvailable = null;  // 未知时 null，探测后 true/false

  function getApiBase() {
    return (global.FOCUSFLOW_API_BASE || API_BASE).replace(/\/$/, "");
  }

  // ===== SHA-256（SubtleCrypto）=====
  async function sha256(text) {
    var enc = new TextEncoder();
    var buf = enc.encode(text);
    var digest = await crypto.subtle.digest("SHA-256", buf);
    var bytes = Array.from(new Uint8Array(digest));
    return bytes.map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  function genToken() {
    return "ff_" + Utils.genId() + "_" + Date.now().toString(36);
  }

  function saveSession(token, username) {
    Storage.set("currentToken", token);
    Storage.set("currentUsername", username);
  }

  function clearSession() {
    Storage.remove("currentToken");
    Storage.remove("currentUsername");
  }

  // ===== 后端检测 =====
  async function probeBackend() {
    try {
      // 用 HEAD 或 GET 任意路径 —— 能连上就是活的
      var resp = await fetch(getApiBase() + "/auth/login/", {
        method: "OPTIONS",
        mode: "cors",
      });
      backendAvailable = true;
      return true;
    } catch (e) {
      backendAvailable = false;
      return false;
    }
  }

  async function ensureBackendStatus() {
    if (backendAvailable !== null) return backendAvailable;
    return probeBackend();
  }

  // ===== fetch 封装 =====
  async function apiRequest(path, method, body, token) {
    var opts = {
      method: method || "GET",
      headers: { "Content-Type": "application/json" },
      mode: "cors",
    };
    if (token) opts.headers["Authorization"] = "Token " + token;
    if (body) opts.body = JSON.stringify(body);

    try {
      var resp = await fetch(getApiBase() + path, opts);
      var data = null;
      try { data = await resp.json(); } catch (e) {}
      return { ok: resp.ok, status: resp.status, data: data };
    } catch (e) {
      return { ok: false, status: 0, networkError: true, error: "NETWORK_ERROR" };
    }
  }

  // ==================== LocalStorage 降级实现（v2 迭代逻辑）====================

  function LS_getUsers() { return Storage.get("users", []); }
  function LS_setUsers(u) { Storage.set("users", u); }
  function LS_getState(username) {
    var st = Storage.get("authState", {});
    if (!st[username]) st[username] = { failedAttempts: 0, lockedUntil: 0 };
    return st[username];
  }
  function LS_setState(username, s) {
    var st = Storage.get("authState", {});
    st[username] = s;
    Storage.set("authState", st);
  }
  function LS_user(username) { return LS_getUsers().find(function (u) { return u.username === username; }); }

  async function LS_register(username, password) {
    if (username.length < 3 || username.length > 20) return { ok: false, error: "USERNAME_SHORT", message: "用户名需 3-20 个字符" };
    if (password.length < 6) return { ok: false, error: "PASSWORD_SHORT", message: "密码至少 6 位" };
    if (LS_user(username)) return { ok: false, error: "USER_EXISTS", message: "用户名已存在" };

    var hash = await sha256(password);
    var users = LS_getUsers();
    users.push({ username: username, passwordHash: hash, createdAt: new Date().toISOString() });
    LS_setUsers(users);

    var token = genToken();
    saveSession(token, username);
    EventBus.emit("auth:login", { username: username });
    return { ok: true, token: token, user: { username: username } };
  }

  async function LS_login(username, password) {
    var user = LS_user(username);
    if (!user) return { ok: false, error: "USER_NOT_FOUND", message: "用户不存在" };

    var st = LS_getState(username);
    var now = Date.now();

    // 锁定检查（在密码校验之前）
    if (st.lockedUntil > now) {
      return { ok: false, error: "ACCOUNT_LOCKED", message: "账户已锁定 5 分钟，请稍后再试" };
    }

    var hash = await sha256(password);
    if (hash !== user.passwordHash) {
      st.failedAttempts = (st.failedAttempts || 0) + 1;
      if (st.failedAttempts >= MAX_ATTEMPTS) {
        st.lockedUntil = now + LOCK_MS;
        LS_setState(username, st);
        return { ok: false, error: "ACCOUNT_LOCKED", message: "密码错误次数过多，账户已锁定 5 分钟" };
      }
      LS_setState(username, st);
      return { ok: false, error: "WRONG_PASSWORD", message: "密码错误", remaining: MAX_ATTEMPTS - st.failedAttempts };
    }

    // 密码正确
    st.failedAttempts = 0;
    st.lockedUntil = 0;
    LS_setState(username, st);

    var token = genToken();
    saveSession(token, username);
    EventBus.emit("auth:login", { username: username });
    return { ok: true, token: token, user: { username: username } };
  }

  function LS_validate() {
    var token = Storage.get("currentToken", null);
    var username = Storage.get("currentUsername", null);
    if (!token || !username) return null;
    return { username: username, token: token };
  }

  async function LS_logout() {
    clearSession();
    EventBus.emit("auth:logout", { username: Storage.get("currentUsername", null) });
  }

  // ==================== 统一入口：先试后端，降级 LocalStorage ====================

  async function register(username, password) {
    username = (username || "").trim();
    if (username.length < 3 || username.length > 20)
      return { ok: false, error: "USERNAME_SHORT", message: "用户名需 3-20 个字符" };
    if (password.length < 6)
      return { ok: false, error: "PASSWORD_SHORT", message: "密码至少 6 位" };

    var backend = await ensureBackendStatus();
    if (!backend) return LS_register(username, password);

    var r = await apiRequest("/auth/register/", "POST", { username: username, password: password, password2: password });
    if (r.networkError) { backendAvailable = false; return LS_register(username, password); }
    if (r.ok) {
      saveSession(r.data.token, r.data.user.username);
      EventBus.emit("auth:login", { username: r.data.user.username });
      return { ok: true, token: r.data.token, user: r.data.user };
    }
    var msg = (r.data && (r.data.username || r.data.password || r.data.password2 || r.data.detail));
    if (Array.isArray(msg)) msg = msg[0];
    msg = msg || "注册失败";
    var errCode = "REGISTER_FAILED";
    if (r.status === 400 && String(msg).indexOf("已存在") >= 0) errCode = "USER_EXISTS";
    return { ok: false, error: errCode, message: String(msg) };
  }

  async function login(username, password) {
    var backend = await ensureBackendStatus();
    if (!backend) return LS_login(username, password);

    var r = await apiRequest("/auth/login/", "POST", { username: username, password: password });
    if (r.networkError) { backendAvailable = false; return LS_login(username, password); }
    if (r.ok) {
      saveSession(r.data.token, r.data.user.username);
      EventBus.emit("auth:login", { username: r.data.user.username });
      return { ok: true, token: r.data.token, user: r.data.user };
    }
    return {
      ok: false,
      error: (r.data && r.data.error) || "LOGIN_FAILED",
      message: (r.data && r.data.message) || "登录失败",
      remaining: r.data && r.data.remaining,
      lockedUntil: r.data && r.data.lockedUntil,
    };
  }

  function validateCurrentSession() {
    var token = Storage.get("currentToken", null);
    var username = Storage.get("currentUsername", null);
    if (!token || !username) return null;
    return { username: username, token: token };
  }

  async function logout() {
    var token = Storage.get("currentToken", null);
    if (token && backendAvailable) {
      try { await apiRequest("/auth/logout/", "POST", {}, token); } catch (e) {}
    }
    clearSession();
  }

  function forceLogout() { clearSession(); }

  global.Auth = {
    MAX_ATTEMPTS: MAX_ATTEMPTS,
    LOCK_MS: LOCK_MS,
    API_BASE: API_BASE,
    register: register,
    login: login,
    validateCurrentSession: validateCurrentSession,
    logout: logout,
    forceLogout: forceLogout,
    // 暴露状态（调试用）
    _isBackendAvailable: function () { return backendAvailable; },
  };
})(window);
