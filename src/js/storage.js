/**
 * storage.js — LocalStorage 唯一入口
 * AD-1: 所有持久化必须经过此模块
 */
(function (global) {
  // Key 常量 — 集中声明避免多处手写
  const KEYS = {
    tasks: 'ff_tasks',
    settings: 'ff_settings',
    pomodoroLogs: 'ff_pomodoro_logs'
  };

  function safeParse(str, fallback) {
    try { return JSON.parse(str); } catch (e) { return fallback; }
  }

  function get(key, fallback) {
    const raw = localStorage.getItem(KEYS[key]);
    return raw === null ? fallback : safeParse(raw, fallback);
  }

  function set(key, value) {
    localStorage.setItem(KEYS[key], JSON.stringify(value));
  }

  function remove(key) {
    localStorage.removeItem(KEYS[key]);
  }

  // 是否首次访问（无任何 key）
  function isFirstVisit() {
    return !localStorage.getItem(KEYS.tasks)
        && !localStorage.getItem(KEYS.settings);
  }

  global.Storage = {
    KEYS: KEYS,
    get: get,
    set: set,
    remove: remove,
    isFirstVisit: isFirstVisit
  };
})(window);
