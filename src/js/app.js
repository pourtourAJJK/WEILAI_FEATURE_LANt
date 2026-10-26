/**
 * app.js — FocusFlow 主控制器
 * Epic 1 版本：仅初始化 + 框架搭建
 */
(function () {
  console.log('[FocusFlow] 启动中...');

  // 运行时 state（AD-2：单一 state 对象）
  var state = {
    tasks: [],
    activeTaskId: null,
    sessionState: 'idle',       // idle | focusing | shortBreak | longBreak
    remainingSeconds: 0,
    continuousCount: 0,         // 今日连续完成番茄数
    currentMode: null           // 'focus' | 'shortBreak' | 'longBreak'
  };

  // 初始化
  function init() {
    Settings.ensureInitialized();

    state.tasks = Storage.get('tasks', []);
    state.settings = Settings.getSettings();
    state.logs = Storage.get('pomodoroLogs', []);

    console.log('[FocusFlow] 初始化完成，任务数:', state.tasks.length);
    console.log('[FocusFlow] 所有模块就绪，等待后续 Epic 实现');

    // 暂时只显示一个简单的欢迎提示
    var timer = document.getElementById('timer-number');
    if (timer) timer.textContent = Utils.formatTime(state.settings.focusMinutes * 60);

    // 设置按钮
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    document.getElementById('settings-cancel').addEventListener('click', closeSettings);
    document.getElementById('settings-save').addEventListener('click', saveSettingsModal);
  }

  function openSettings() {
    var modal = document.getElementById('settings-modal');
    var s = state.settings;
    document.getElementById('set-focus').value = s.focusMinutes;
    document.getElementById('set-short').value = s.shortBreakMinutes;
    document.getElementById('set-long').value = s.longBreakMinutes;
    document.getElementById('set-long-every').value = s.longBreakEvery;
    document.getElementById('set-sound').checked = s.soundEnabled;
    document.getElementById('long-break-every').textContent = s.longBreakEvery;
    modal.classList.add('show');
  }
  function closeSettings() {
    document.getElementById('settings-modal').classList.remove('show');
  }
  function saveSettingsModal() {
    var s = Settings.saveSettings({
      focusMinutes: parseInt(document.getElementById('set-focus').value, 10),
      shortBreakMinutes: parseInt(document.getElementById('set-short').value, 10),
      longBreakMinutes: parseInt(document.getElementById('set-long').value, 10),
      longBreakEvery: parseInt(document.getElementById('set-long-every').value, 10),
      soundEnabled: document.getElementById('set-sound').checked
    });
    state.settings = s;
    closeSettings();
    EventBus.emit('data:changed');
  }

  // 暴露给后续模块
  window.FocusFlowState = state;

  document.addEventListener('DOMContentLoaded', init);
})();
