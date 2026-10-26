/**
 * theme.js — 日间 / 夜间模式驱动
 * 状态源：document.documentElement.dataset.theme  ("light" | "dark")
 * 持久化：localStorage "ff_theme"
 * 系统偏好：matchMedia("(prefers-color-scheme: dark)") 兜底
 */
(function (global) {

  var STORAGE_KEY = "ff_theme";
  var ATTR = "data-theme";

  function readStored() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) { return null; }
  }

  function writeStored(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) {}
  }

  function systemPrefersDark() {
    try {
      return global.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) { return false; }
  }

  function getCurrent() {
    return document.documentElement.getAttribute(ATTR) || "light";
  }

  function apply(theme) {
    document.documentElement.setAttribute(ATTR, theme);
  }

  function init() {
    // 防闪烁内联脚本可能已经先行写入 data-theme 了
    var existing = document.documentElement.getAttribute(ATTR);
    if (existing) {
      writeStored(existing);
      emitChanged(existing);
      return existing;
    }

    var saved = readStored();
    var theme;
    if (saved === "light" || saved === "dark") {
      theme = saved;
    } else {
      theme = systemPrefersDark() ? "dark" : "light";
      writeStored(theme);
    }
    apply(theme);
    emitChanged(theme);
    return theme;
  }

  function toggle() {
    var next = getCurrent() === "dark" ? "light" : "dark";
    writeStored(next);
    apply(next);
    emitChanged(next);
    return next;
  }

  function setTheme(theme) {
    if (theme !== "light" && theme !== "dark") return null;
    writeStored(theme);
    apply(theme);
    emitChanged(theme);
    return theme;
  }

  function emitChanged(theme) {
    try {
      if (typeof EventBus !== "undefined" && EventBus && EventBus.emit) {
        EventBus.emit("theme:changed", { theme: theme });
      }
    } catch (e) {}
  }

  global.Theme = {
    init: init,
    toggle: toggle,
    setTheme: setTheme,
    getCurrent: getCurrent
  };
})(window);
