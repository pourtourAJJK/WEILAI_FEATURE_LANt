/**
 * settings.js — 设置读写 + 默认值
 * 对应 FR-16 ~ FR-19, FR-21
 */
(function (global) {

  var DEFAULTS = {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    soundEnabled: true
  };

  function getSettings() {
    var saved = Storage.get('settings', null);
    return Object.assign({}, DEFAULTS, saved || {});
  }

  function saveSettings(partial) {
    var current = getSettings();
    var merged = Object.assign({}, current, partial);

    // 边界 clamp
    merged.focusMinutes = Utils.clamp(merged.focusMinutes, 5, 60);
    merged.shortBreakMinutes = Utils.clamp(merged.shortBreakMinutes, 1, 15);
    merged.longBreakMinutes = Utils.clamp(merged.longBreakMinutes, 10, 30);
    merged.longBreakEvery = Utils.clamp(merged.longBreakEvery, 2, 8);

    Storage.set('settings', merged);
    EventBus.emit('settings:changed', merged);
    return merged;
  }

  function ensureInitialized() {
    if (Storage.isFirstVisit()) {
      Storage.set('settings', DEFAULTS);
      Storage.set('tasks', []);
      Storage.set('pomodoroLogs', []);
    }
  }

  global.Settings = {
    DEFAULTS: DEFAULTS,
    getSettings: getSettings,
    saveSettings: saveSettings,
    ensureInitialized: ensureInitialized
  };
})(window);
