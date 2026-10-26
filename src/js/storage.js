/**
 * storage.js — LocalStorage 唯一入口
 * AD-1: 所有持久化必须经过此模块
 */
(function (global) {
  // Key 常量 — 集中声明避免多处手写
  var KEYS = {
    tasks: 'ff_tasks',
    settings: 'ff_settings',
    pomodoroLogs: 'ff_pomodoro_logs',
    users: 'ff_users',
    authState: 'ff_auth_state',
    currentToken: 'ff_current_token',
    currentUsername: 'ff_current_username'
  };

  // 从 globalThis / global / window 获取 localStorage（跨环境兼容）
  var _ls = (typeof globalThis !== 'undefined' && globalThis.localStorage)
         || (typeof global !== 'undefined' && global.localStorage)
         || (typeof window !== 'undefined' && window.localStorage);

  function safeParse(str, fallback) {
    try { return JSON.parse(str); } catch (e) { return fallback; }
  }

  function get(key, fallback) {
    var raw = _ls.getItem(KEYS[key]);
    return raw === null ? fallback : safeParse(raw, fallback);
  }

  function set(key, value) {
    _ls.setItem(KEYS[key], JSON.stringify(value));
  }

  function remove(key) {
    _ls.removeItem(KEYS[key]);
  }

  // 是否首次访问（无任何 key）
  function isFirstVisit() {
    return !_ls.getItem(KEYS.tasks)
        && !_ls.getItem(KEYS.settings);
  }

  global.Storage = {
    KEYS: KEYS,
    get: get,
    set: set,
    remove: remove,
    isFirstVisit: isFirstVisit
  };
})(window);
