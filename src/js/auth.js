/**
 * auth.js — 用户注册 / 登录 / 令牌 / 锁定
 * 对应 FR-22 ~ FR-26
 *
 * 数据模型（LocalStorage）：
 *   ff_users      = [{ username, passwordHash, createdAt }]
 *   ff_auth_state = { username: { failedAttempts, lockedUntil, activeToken } }
 *   ff_current_token = "abc-uuid..."    （当前登录令牌）
 *
 * 锁定规则：连续 5 次密码错误 → lockedUntil = now + 300000 (5 min)
 * 锁定检查在密码哈希校验**之前**执行 → 短路拒绝
 */
(function (global) {

  var MAX_ATTEMPTS = 5;
  var LOCK_MS = 5 * 60 * 1000;            // 5 分钟
  var TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 令牌有效期 24h（可选）

  // ===== SubtleCrypto SHA-256 哈希 =====
  async function sha256(text) {
    var enc = new TextEncoder();
    var buf = enc.encode(text);
    var digest = await crypto.subtle.digest('SHA-256', buf);
    var bytes = Array.from(new Uint8Array(digest));
    return bytes.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  // ===== 内部工具 =====
  function getUsers() { return Storage.get('users', []); }
  function setUsers(u) { Storage.set('users', u); }
  function getAuthState() { return Storage.get('authState', {}); }
  function setAuthState(s) { Storage.set('authState', s); }

  function getUser(username) {
    return getUsers().find(function (u) { return u.username === username; });
  }

  function getState(username) {
    var st = getAuthState();
    if (!st[username]) st[username] = { failedAttempts: 0, lockedUntil: 0, activeToken: null, tokenCreatedAt: 0 };
    return st[username];
  }

  function setState(username, newState) {
    var st = getAuthState();
    st[username] = newState;
    setAuthState(st);
  }

  function genToken() {
    return 'ff_' + Utils.genId() + '_' + Date.now().toString(36);
  }

  // ===== FR-22: 注册 =====
  async function register(username, password) {
    username = (username || '').trim();
    if (username.length < 3 || username.length > 20) {
      return { ok: false, error: 'USERNAME_SHORT', message: '用户名需 3-20 个字符' };
    }
    if (password.length < 6) {
      return { ok: false, error: 'PASSWORD_SHORT', message: '密码至少 6 位' };
    }
    if (getUser(username)) {
      return { ok: false, error: 'USER_EXISTS', message: '用户名已存在' };
    }

    var hash = await sha256(password);
    var users = getUsers();
    users.push({ username: username, passwordHash: hash, createdAt: new Date().toISOString() });
    setUsers(users);

    // 自动登录 + 签发令牌
    var token = genToken();
    var now = Date.now();
    setState(username, {
      failedAttempts: 0,
      lockedUntil: 0,
      activeToken: token,
      tokenCreatedAt: now
    });
    Storage.set('currentToken', token);
    Storage.set('currentUsername', username);

    EventBus.emit('auth:login', { username: username });
    return { ok: true, token: token, user: { username: username } };
  }

  // ===== FR-23: 登录 + FR-25: 锁定（锁定检查在密码校验之前）=====
  async function login(username, password) {
    username = (username || '').trim();
    var user = getUser(username);
    var state = getState(username);

    if (!user) {
      return { ok: false, error: 'USER_NOT_FOUND', message: '用户不存在' };
    }

    // ★ 锁定检查在密码校验之前 —— 短路拒绝
    var now = Date.now();
    if (state.lockedUntil > now) {
      var remainingMs = state.lockedUntil - now;
      return {
        ok: false,
        error: 'ACCOUNT_LOCKED',
        message: '账户已锁定，请 ' + Math.ceil(remainingMs / 1000) + ' 秒后重试',
        lockedUntil: state.lockedUntil
      };
    }

    // 密码哈希校验
    var hash = await sha256(password);
    if (hash !== user.passwordHash) {
      state.failedAttempts = (state.failedAttempts || 0) + 1;

      if (state.failedAttempts >= MAX_ATTEMPTS) {
        state.lockedUntil = now + LOCK_MS;
        setState(username, state);
        return {
          ok: false,
          error: 'ACCOUNT_LOCKED',
          message: '密码错误次数过多，账户已锁定 5 分钟'
        };
      }

      setState(username, state);
      return {
        ok: false,
        error: 'WRONG_PASSWORD',
        message: '密码错误',
        remaining: MAX_ATTEMPTS - state.failedAttempts
      };
    }

    // 密码正确 —— 签发令牌 + 重置失败计数
    var token = genToken();
    state.failedAttempts = 0;
    state.lockedUntil = 0;
    state.activeToken = token;
    state.tokenCreatedAt = now;
    setState(username, state);

    Storage.set('currentToken', token);
    Storage.set('currentUsername', username);

    EventBus.emit('auth:login', { username: username });
    return { ok: true, token: token, user: { username: username } };
  }

  // ===== FR-24: 令牌校验（路由守卫）=====
  function validateCurrentSession() {
    var token = Storage.get('currentToken', null);
    var username = Storage.get('currentUsername', null);
    if (!token || !username) return null;

    var state = getState(username);
    if (state.activeToken !== token) return null;

    // 可选：令牌过期检查（24h）
    if (state.tokenCreatedAt && (Date.now() - state.tokenCreatedAt > TOKEN_TTL_MS)) {
      forceLogout();
      return null;
    }

    return { username: username, token: token };
  }

  // ===== FR-26: 登出 =====
  function logout() {
    var username = Storage.get('currentUsername', null);
    if (username) {
      var state = getState(username);
      state.activeToken = null;
      state.tokenCreatedAt = 0;
      setState(username, state);
    }
    Storage.remove('currentToken');
    Storage.remove('currentUsername');
    EventBus.emit('auth:logout', { username: username });
  }

  function forceLogout() {
    Storage.remove('currentToken');
    Storage.remove('currentUsername');
  }

  global.Auth = {
    MAX_ATTEMPTS: MAX_ATTEMPTS,
    LOCK_MS: LOCK_MS,
    register: register,
    login: login,
    validateCurrentSession: validateCurrentSession,
    logout: logout,
    forceLogout: forceLogout
  };
})(window);
