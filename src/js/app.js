/**
 * app.js — FocusFlow 主控制器（完整版）
 * 编排：任务管理 + 番茄钟 + 联动 + 统计 + 设置
 * 架构参考 architecture.md（分层 + EventBus 观察者模式）
 */
(function () {
  console.log('[FocusFlow] 启动中...');

  // ===== 运行时 state（AD-2：单一 state 对象）=====
  var state = {
    tasks: [],
    logs: [],
    settings: null,
    activeTaskId: null,
    continuousCount: 0,       // 今日连续完成番茄数
    currentFilter: 'all'
  };

  // 计时器实例
  var timer = new Timer();

  // ===== 初始化 =====
  function init() {
    Settings.ensureInitialized();
    state.tasks = Storage.get('tasks', []);
    state.settings = Settings.getSettings();
    state.logs = Storage.get('pomodoroLogs', []);

    bindDomEvents();
    bindBusEvents();
    updateContinuousCount();
    renderAll();

    console.log('[FocusFlow] ✅ 启动完成');
  }

  // ===== DOM 事件绑定 =====
  function bindDomEvents() {
    // 添加任务表单
    var form = document.getElementById('add-task-form');
    form.addEventListener('submit', onSubmitTask);

    // 任务列表（事件委托）
    document.getElementById('task-list').addEventListener('click', onTaskListClick);

    // 筛选标签
    document.querySelectorAll('.filter-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.filter-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        state.currentFilter = tab.dataset.filter;
        renderTaskList();
      });
    });

    // 番茄钟按钮
    document.getElementById('btn-start').addEventListener('click', onStartTimer);
    document.getElementById('btn-pause').addEventListener('click', onPauseResume);
    document.getElementById('btn-skip').addEventListener('click', onSkip);

    // 设置 Modal
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    document.getElementById('settings-cancel').addEventListener('click', closeSettings);
    document.getElementById('settings-save').addEventListener('click', saveSettingsModal);

    // 关闭 modal 点击外部
    document.getElementById('settings-modal').addEventListener('click', function (e) {
      if (e.target.id === 'settings-modal') closeSettings();
    });

    // Esc 关闭 modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSettings();
    });

    // 空标题禁用添加按钮
    var titleInput = document.getElementById('task-title');
    titleInput.addEventListener('input', function () {
      form.querySelector('button[type="submit"]').disabled = !titleInput.value.trim();
    });
    form.querySelector('button[type="submit"]').disabled = true;
  }

  // ===== EventBus 事件 =====
  function bindBusEvents() {
    EventBus.on('data:changed', renderAll);
    EventBus.on('settings:changed', function () {
      state.settings = Settings.getSettings();
      if (timer.state === 'idle') {
        renderIdleTimerDisplay();
      }
    });

    // 计时 tick → 数字更新
    EventBus.on('timer:tick', function (sec) {
      var timerEl = document.getElementById('timer-number');
      timerEl.textContent = Utils.formatTime(sec);
      updatePageTitle(sec);
    });

    // 计时开始 → 按钮切换
    EventBus.on('timer:started', function () {
      updateTimerButtons();
      updateSessionBadge();
    });

    // 计时暂停 / 恢复
    EventBus.on('timer:paused', function () { updateTimerButtons(); });
    EventBus.on('timer:resumed', function () { updateTimerButtons(); });

    // 计时结束 → 联动处理
    EventBus.on('timer:finished', onTimerFinished);
  }

  // ===== 任务管理交互 =====
  function onSubmitTask(e) {
    e.preventDefault();
    var title = document.getElementById('task-title').value;
    var desc = document.getElementById('task-desc').value;
    var priority = document.getElementById('task-priority').value;

    TaskManager.createTask(state, { title: title, description: desc, priority: priority });

    // 清空表单
    e.target.reset();
    document.getElementById('task-title').focus();
    e.target.querySelector('button[type="submit"]').disabled = true;
  }

  function onTaskListClick(e) {
    var card = e.target.closest('.task-card');
    if (!card) return;
    var taskId = card.dataset.id;

    // 删除按钮
    if (e.target.closest('.btn-delete')) {
      e.stopPropagation();
      if (confirm('确定删除这个任务吗？')) {
        TaskManager.deleteTask(state, taskId);
        // 联动：正在计时的任务被删除 → 解绑 + 回到 idle
        if (state.activeTaskId === taskId) {
          state.activeTaskId = null;
          // 如果当前有计时 → 跳过
          if (timer.state !== 'idle') timer.skip();
        }
      }
      return;
    }

    // 编辑按钮 → inline edit
    if (e.target.closest('.btn-edit')) {
      e.stopPropagation();
      inlineEditTask(card, taskId);
      return;
    }

    // 完成勾选
    if (e.target.closest('.task-checkbox')) {
      e.stopPropagation();
      TaskManager.toggleDone(state, taskId);
      return;
    }

    // 点击卡片 → 选中联动
    state.activeTaskId = state.activeTaskId === taskId ? null : taskId;
    renderTaskList();
    renderCurrentTask();
  }

  function inlineEditTask(card, taskId) {
    var t = state.tasks.find(function (x) { return x.id === taskId; });
    if (!t) return;

    var titleEl = card.querySelector('.task-title');
    var input = document.createElement('input');
    input.type = 'text';
    input.value = t.title;
    input.className = 'task-inline-edit';
    input.style.width = '100%';
    input.style.padding = '4px 8px';
    input.style.border = '1px solid var(--color-primary)';
    input.style.borderRadius = '4px';
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    function finish() {
      var newTitle = input.value.trim().slice(0, 80);
      if (newTitle) {
        TaskManager.updateTask(state, taskId, { title: newTitle });
      }
      renderTaskList();
    }
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.value = t.title; input.blur(); }
    });
  }

  // ===== 番茄钟交互 =====
  function onStartTimer() {
    var sec;
    var mode;

    if (timer.mode === 'focus' && timer.state !== 'idle') return;
    if (timer.state === 'shortBreak' || timer.state === 'longBreak') return;

    // 如果上一轮结束后应该进入休息 → 自动续上
    // 否则默认启动专注
    sec = state.settings.focusMinutes * 60;
    mode = 'focus';

    timer.start(mode, sec, {
      onComplete: onFocusComplete,
      onSkip: function () { /* 跳过不触发任何额外逻辑 */ }
    });
  }

  function onPauseResume() {
    if (timer.state.endsWith('-paused')) {
      timer.resume();
    } else if (timer.state !== 'idle') {
      timer.pause();
    }
  }

  function onSkip() {
    if (timer.state === 'idle') return;
    timer.skip();
  }

  function onFocusComplete() {
    // 完整结束专注番茄
    // 1. 触发提示音
    if (state.settings.soundEnabled) Utils.playTomatoDone();

    // 2. Good Job 动画
    var timerEl = document.getElementById('timer-number');
    timerEl.classList.add('goodjob');
    timerEl.classList.add('resting');
    timerEl.textContent = 'GOOD JOB ✨';
    setTimeout(function () {
      timerEl.classList.remove('goodjob');
    }, 1500);

    // 3. 联动 + 写 log + +1 番茄
    if (state.activeTaskId) {
      TaskManager.updateTask(state, state.activeTaskId, {
        pomodoroCount: (state.tasks.find(function (t) { return t.id === state.activeTaskId; }).pomodoroCount || 0) + 1
      });
    }
    state.logs.push({
      id: Utils.genId(),
      taskId: state.activeTaskId,
      finishedAt: new Date().toISOString(),
      durationSeconds: state.settings.focusMinutes * 60
    });
    Storage.set('pomodoroLogs', state.logs);
    EventBus.emit('data:changed');

    // 4. 连续计数 + 判断休息类型
    state.continuousCount += 1;
    Storage.set('continuousCount_' + Utils.todayStart(), state.continuousCount);
    updateContinuousCount();

    var needLongBreak = state.continuousCount % state.settings.longBreakEvery === 0;
    var breakMode = needLongBreak ? 'longBreak' : 'shortBreak';
    var breakSec = needLongBreak
      ? state.settings.longBreakMinutes * 60
      : state.settings.shortBreakMinutes * 60;

    // 5. 自动启动休息
    setTimeout(function () {
      timer.start(breakMode, breakSec, {
        onComplete: onBreakComplete,
        onSkip: function () { renderIdleTimerDisplay(); }
      });
    }, 1500);
  }

  function onBreakComplete() {
    if (state.settings.soundEnabled) Utils.playBreakDone();
    renderIdleTimerDisplay();
    updateSessionBadge();
  }

  function onTimerFinished(info) {
    // 跳过或手动结束的情况
    if (!info.completed) {
      renderIdleTimerDisplay();
    }
    updateTimerButtons();
    updateSessionBadge();
  }

  function updateContinuousCount() {
    // 从 LocalStorage 读取今日连续计数
    var todayKey = 'continuousCount_' + Utils.todayStart();
    state.continuousCount = parseInt(localStorage.getItem(todayKey) || '0', 10) || 0;
  }

  // ===== 设置 Modal =====
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
    updateContinuousCount();
    EventBus.emit('data:changed');
  }

  // ===== 渲染层 =====
  function renderAll() {
    renderTaskList();
    renderTimerButtons();
    renderIdleTimerDisplay();
    renderCurrentTask();
    renderStats();
  }

  function renderTaskList() {
    var container = document.getElementById('task-list');
    var empty = document.getElementById('empty-tasks');
    var tasks = TaskManager.filterTasks(state, state.currentFilter);

    if (tasks.length === 0) {
      container.innerHTML = '';
      empty.classList.remove('hidden');
      empty.querySelector('p').textContent =
        state.currentFilter === 'done' ? '🎉 还没有完成的任务'
        : state.currentFilter === 'todo' ? '✨ 没有待办任务，添加一个吧！'
        : '✨ 还没有任务，添加一个开始吧！';
      return;
    }
    empty.classList.add('hidden');

    // 待办在前，已完成在后
    var todo = tasks.filter(function (t) { return t.status !== 'done'; });
    var done = tasks.filter(function (t) { return t.status === 'done'; });
    var ordered = todo.concat(done);

    container.innerHTML = ordered.map(function (t) {
      return TaskManager.renderTaskCard(t, t.id === state.activeTaskId);
    }).join('');
  }

  function renderIdleTimerDisplay() {
    if (timer.state !== 'idle') return;
    var timerEl = document.getElementById('timer-number');
    timerEl.classList.remove('resting', 'goodjob');
    timerEl.textContent = Utils.formatTime(state.settings.focusMinutes * 60);
    updatePageTitle(state.settings.focusMinutes * 60);
    updateSessionBadge();
    updateTimerButtons();
    document.getElementById('pomodoro-total').textContent = state.tasks.reduce(function (sum, t) { return sum + t.pomodoroCount; }, 0);
    document.getElementById('continuous-count').textContent = state.continuousCount;
    document.getElementById('long-break-every').textContent = state.settings.longBreakEvery;
  }

  function updateSessionBadge() {
    var badge = document.getElementById('session-badge');
    badge.className = 'session-badge';
    if (timer.state === 'idle') {
      badge.textContent = '准备就绪';
    } else if (timer.state === 'focusing') {
      badge.textContent = '🔥 专注中';
      badge.classList.add('focusing');
    } else if (timer.state === 'focusing-paused') {
      badge.textContent = '⏸ 已暂停';
    } else if (timer.state === 'shortBreak') {
      badge.textContent = '☕ 短休息';
      badge.classList.add('shortBreak');
    } else if (timer.state === 'longBreak') {
      badge.textContent = '🌿 长休息';
      badge.classList.add('longBreak');
    } else if (timer.state === 'shortBreak-paused' || timer.state === 'longBreak-paused') {
      badge.textContent = '⏸ 休息暂停';
    }
  }

  function updateTimerButtons() {
    var start = document.getElementById('btn-start');
    var pause = document.getElementById('btn-pause');
    var skip = document.getElementById('btn-skip');

    var isIdle = timer.state === 'idle';
    var isPaused = timer.state.endsWith('-paused');

    start.disabled = !isIdle;
    pause.disabled = isIdle;
    skip.disabled = isIdle;

    // 休息阶段隐藏"开始专注"语义
    if (timer.state === 'shortBreak' || timer.state === 'longBreak') {
      start.disabled = true;
      pause.disabled = false;
      skip.disabled = false;
    } else if (timer.state === 'idle') {
      start.disabled = false;
    }

    pause.textContent = isPaused ? '▶ 恢复' : '⏸ 暂停';
  }

  function renderCurrentTask() {
    var valueEl = document.getElementById('ct-value');
    if (!state.activeTaskId) {
      valueEl.textContent = '未选择任务';
      valueEl.classList.add('empty');
      return;
    }
    var t = state.tasks.find(function (x) { return x.id === state.activeTaskId; });
    if (!t) {
      state.activeTaskId = null;
      valueEl.textContent = '未选择任务';
      valueEl.classList.add('empty');
      return;
    }
    valueEl.textContent = t.title;
    valueEl.classList.remove('empty');
  }

  function renderStats() {
    var done = Stats.todayDoneTaskCount(state.tasks);
    var pStats = Stats.todayPomodoroStats(state.logs);

    document.getElementById('stat-done-tasks').textContent = done;
    document.getElementById('stat-pomodoros').textContent = pStats.count;
    document.getElementById('stat-focus-time').textContent = Math.round(pStats.totalSeconds / 60);
  }

  function updatePageTitle(seconds) {
    document.title = Utils.formatTime(seconds) + ' — FocusFlow';
  }

  // ===== 启动 =====
  document.addEventListener('DOMContentLoaded', init);
})();
