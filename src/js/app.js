﻿/**
 * app.js — LAN·FocusFlow 主控制器（带登录守卫）
 * 编排：认证 → 任务管理 → 番茄钟 → 联动 → 统计 → 设置
 */
(function () {
  console.log('[LAN·FocusFlow] 启动中...');

  var state = {
    tasks: [],
    logs: [],
    settings: null,
    activeTaskId: null,
    continuousCount: 0,
    currentFilter: 'all',
    currentUser: null
  };

  var timer = new Timer();

  // ===== 启动入口（带路由守卫）=====
  async function boot() {
    // 1) 初始化主题（防闪烁脚本已先行写入 data-theme）
    if (typeof Theme !== 'undefined') {
      Theme.init();
      updateThemeButtons();
    }

    var session = Auth.validateCurrentSession();
    if (!session) {
      showAuthPage();
      bindAuthEvents();
      console.log('[LAN·FocusFlow] 未登录，显示认证页');
      return;
    }

    // 已登录
    state.currentUser = session.username;
    showMainApp();
    await initMainApp();
  }

  function showAuthPage() {
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    document.title = 'LAN·FocusFlow — 登录';
  }

  function showMainApp() {
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('user-display').textContent = state.currentUser;
    syncUserAvatar();
  }

  function syncUserAvatar() {
    var src = typeof Auth !== 'undefined' && Auth.getAvatar ? Auth.getAvatar() : null;
    var el = document.getElementById('user-avatar');
    if (!el) return;
    if (src) {
      el.src = src;
      el.hidden = false;
    } else {
      el.removeAttribute('src');
      el.hidden = true;
    }
  }

  // ===== 认证页事件绑定 =====
  function bindAuthEvents() {
    // Tab 切换
    document.querySelectorAll('.auth-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.auth-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var which = tab.dataset.tab;
        document.getElementById('login-form').classList.toggle('hidden', which !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', which !== 'register');
        clearAuthErrors();
      });
    });

    // 登录
    document.getElementById('login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var username = document.getElementById('login-username').value;
      var password = document.getElementById('login-password').value;
      var btn = document.getElementById('login-btn');
      btn.disabled = true; btn.textContent = '登录中...';

      var res = await Auth.login(username, password);
      btn.disabled = false; btn.textContent = '登 录';

      if (res.ok) {
        state.currentUser = res.user.username;
        showMainApp();
        await initMainApp();
      } else {
        showAuthError('login-error', res.message || '登录失败');
        if (res.error === 'WRONG_PASSWORD' && typeof res.remaining === 'number') {
          showAuthError('login-error', '密码错误，还可尝试 ' + res.remaining + ' 次');
        }
      }
    });

    // 注册
    document.getElementById('register-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var username = document.getElementById('register-username').value;
      var password = document.getElementById('register-password').value;
      var password2 = document.getElementById('register-password2').value;
      var btn = document.getElementById('register-btn');

      if (password !== password2) {
        showAuthError('register-error', '两次密码不一致');
        return;
      }

      btn.disabled = true; btn.textContent = '注册中...';
      var res = await Auth.register(username, password);
      btn.disabled = false; btn.textContent = '注 册';

      if (res.ok) {
        state.currentUser = res.user.username;
        showMainApp();
        await initMainApp();
      } else {
        showAuthError('register-error', res.message || '注册失败');
      }
    });

    // 主题切换（登录页）
    var themeAuth = document.getElementById('btn-theme-auth');
    if (themeAuth) themeAuth.addEventListener('click', toggleTheme);
  }

  function showAuthError(id, msg) {
    var el = document.getElementById(id);
    el.textContent = msg;
    el.classList.add('show');
  }
  function clearAuthErrors() {
    document.getElementById('login-error').textContent = '';
    document.getElementById('login-error').classList.remove('show');
    document.getElementById('register-error').textContent = '';
    document.getElementById('register-error').classList.remove('show');
  }

  // ===== 主题切换辅助 =====
  function toggleTheme() {
    if (typeof Theme === 'undefined') return;
    Theme.toggle();
    updateThemeButtons();
  }
  function updateThemeButtons() {
    if (typeof Theme === 'undefined') return;
    var isDark = Theme.getCurrent() === 'dark';
    var icon = isDark ? '☀️' : '🌙';
    var els = ['btn-theme-auth', 'btn-theme-main'];
    els.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = icon;
    });
  }

  // ===== 主应用初始化 =====
  async function initMainApp() {
    Settings.ensureInitialized();
    state.tasks = Storage.get('tasks', []);
    state.settings = Settings.getSettings();
    state.logs = Storage.get('pomodoroLogs', []);

    bindMainDomEvents();
    bindBusEvents();
    updateContinuousCount();

    // 初始化日历组件
    var calEl = document.getElementById('calendar-container');
    if (calEl && typeof Calendar !== 'undefined') {
      Calendar.init(calEl);
    }

    renderAll();

    console.log('[LAN·FocusFlow] ✅ 启动完成, 用户:', state.currentUser);
  }

  // ===== 主应用 DOM 事件 =====
  function bindMainDomEvents() {
    // 登出
    document.getElementById('btn-logout').addEventListener('click', function () {
      if (confirm('确定要登出吗？')) {
        Auth.logout();
        state.currentUser = null;
        showAuthPage();
        bindAuthEvents();
      }
    });

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
      if (e.key === 'Escape') {
        // 关 profile modal 优先（如果开着）
        if (document.getElementById('profile-modal').classList.contains('show')) {
          closeProfileModal();
          return;
        }
        if (document.getElementById('settings-modal').classList.contains('show')) {
          closeSettings();
        }
      }
    });

    // ===== 个人中心 Profile Modal =====
    document.getElementById('btn-profile').addEventListener('click', openProfileModal);
    document.getElementById('profile-close').addEventListener('click', closeProfileModal);
    document.getElementById('profile-pwd-submit').addEventListener('click', handleChangePassword);
    document.getElementById('avatar-input').addEventListener('change', handleAvatarFile);
    // 点击 modal 遮罩关闭
    document.getElementById('profile-modal').addEventListener('click', function (e) {
      if (e.target.id === 'profile-modal') closeProfileModal();
    });

    // 空标题禁用添加按钮
    var titleInput = document.getElementById('task-title');
    titleInput.addEventListener('input', function () {
      form.querySelector('button[type="submit"]').disabled = !titleInput.value.trim();
    });
    form.querySelector('button[type="submit"]').disabled = true;

    // 主题切换（主应用 header）
    var themeMain = document.getElementById('btn-theme-main');
    if (themeMain) themeMain.addEventListener('click', toggleTheme);
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

    EventBus.on('timer:tick', function (sec) {
      var timerEl = document.getElementById('timer-number');
      timerEl.textContent = Utils.formatTime(sec);
      updatePageTitle(sec);
    });

    EventBus.on('timer:started', function () {
      updateTimerButtons();
      updateSessionBadge();
    });

    EventBus.on('timer:paused', function () { updateTimerButtons(); });
    EventBus.on('timer:resumed', function () { updateTimerButtons(); });
    EventBus.on('timer:finished', onTimerFinished);

    // 头像更新全局联动（Django / LS 两条路径都 emit）
    EventBus.on('auth:avatar-updated', function (info) {
      syncUserAvatar();
      var preview = document.getElementById('avatar-preview');
      var placeholder = document.getElementById('avatar-placeholder');
      if (preview && info && info.avatar) {
        preview.src = info.avatar;
        preview.hidden = false;
        if (placeholder) placeholder.hidden = true;
      }
    });
  }

  // ===== 任务管理交互 =====
  function onSubmitTask(e) {
    e.preventDefault();
    var title = document.getElementById('task-title').value;
    var desc = document.getElementById('task-desc').value;
    var priority = document.getElementById('task-priority').value;

    TaskManager.createTask(state, { title: title, description: desc, priority: priority });

    e.target.reset();
    document.getElementById('task-title').focus();
    e.target.querySelector('button[type="submit"]').disabled = true;
  }

  function onTaskListClick(e) {
    var card = e.target.closest('.task-card');
    if (!card) return;
    var taskId = card.dataset.id;

    if (e.target.closest('.btn-delete')) {
      e.stopPropagation();
      if (confirm('确定删除这个任务吗？')) {
        TaskManager.deleteTask(state, taskId);
        if (state.activeTaskId === taskId) {
          state.activeTaskId = null;
          if (timer.state !== 'idle') timer.skip();
        }
      }
      return;
    }

    if (e.target.closest('.btn-edit')) {
      e.stopPropagation();
      inlineEditTask(card, taskId);
      return;
    }

    if (e.target.closest('.task-checkbox')) {
      e.stopPropagation();
      TaskManager.toggleDone(state, taskId);
      return;
    }

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
      if (newTitle) TaskManager.updateTask(state, taskId, { title: newTitle });
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
    var sec, mode;
    if (timer.mode === 'focus' && timer.state !== 'idle') return;
    if (timer.state === 'shortBreak' || timer.state === 'longBreak') return;
    sec = state.settings.focusMinutes * 60;
    mode = 'focus';
    timer.start(mode, sec, {
      onComplete: onFocusComplete,
      onSkip: function () {}
    });
  }

  function onPauseResume() {
    if (timer.state.endsWith('-paused')) timer.resume();
    else if (timer.state !== 'idle') timer.pause();
  }

  function onSkip() {
    if (timer.state === 'idle') return;
    timer.skip();
  }

  function onFocusComplete() {
    if (state.settings.soundEnabled) Utils.playTomatoDone();

    var timerEl = document.getElementById('timer-number');
    timerEl.classList.add('goodjob');
    timerEl.classList.add('resting');
    timerEl.textContent = 'GOOD JOB ✨';
    setTimeout(function () { timerEl.classList.remove('goodjob'); }, 1500);

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

    state.continuousCount += 1;
    Storage.set('continuousCount_' + Utils.todayStart(), state.continuousCount);
    updateContinuousCount();

    var needLongBreak = state.continuousCount % state.settings.longBreakEvery === 0;
    var breakMode = needLongBreak ? 'longBreak' : 'shortBreak';
    var breakSec = needLongBreak
      ? state.settings.longBreakMinutes * 60
      : state.settings.shortBreakMinutes * 60;

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
    if (!info.completed) renderIdleTimerDisplay();
    updateTimerButtons();
    updateSessionBadge();
  }

  function updateContinuousCount() {
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

  // ===== 个人中心 Profile Modal =====
  function openProfileModal() {
    // 填充用户名
    var un = document.getElementById('user-display');
    var nameEl = document.getElementById('profile-username');
    if (un && nameEl) nameEl.textContent = un.textContent || '未登录';
    // 重置密码表单
    var oldP = document.getElementById('pwd-old');
    var newP = document.getElementById('pwd-new');
    var confP = document.getElementById('pwd-confirm');
    if (oldP) { oldP.value = ''; newP.value = ''; confP.value = ''; }
    // 重置消息
    document.getElementById('profile-avatar-msg').textContent = '';
    document.getElementById('profile-avatar-msg').className = 'profile-msg';
    document.getElementById('profile-pwd-msg').textContent = '';
    document.getElementById('profile-pwd-msg').className = 'profile-msg';
    // 同步头像预览
    refreshAvatarPreview();
    document.getElementById('profile-modal').classList.add('show');
  }

  function closeProfileModal() {
    document.getElementById('profile-modal').classList.remove('show');
  }

  function refreshAvatarPreview() {
    var src = typeof Auth !== 'undefined' && Auth.getAvatar ? Auth.getAvatar() : null;
    var preview = document.getElementById('avatar-preview');
    var placeholder = document.getElementById('avatar-placeholder');
    if (!preview) return;
    if (src) {
      preview.src = src;
      preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
    } else {
      preview.removeAttribute('src');
      preview.hidden = true;
      if (placeholder) placeholder.hidden = false;
    }
  }

  function handleAvatarFile(e) {
    var file = e.target.files && e.target.files[0];
    var msg = document.getElementById('profile-avatar-msg');
    if (!file) return;
    // 即时本地预览（base64，不等上传）
    var reader = new FileReader();
    reader.onload = function () {
      var preview = document.getElementById('avatar-preview');
      var placeholder = document.getElementById('avatar-placeholder');
      preview.src = reader.result;
      preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
    };
    reader.readAsDataURL(file);
    // 上传
    if (typeof Auth === 'undefined' || !Auth.uploadAvatar) {
      setProfileMsg(msg, '上传模块未就绪', 'error');
      return;
    }
    setProfileMsg(msg, '上传中…', '');
    Auth.uploadAvatar(file).then(function (res) {
      if (res.ok) {
        setProfileMsg(msg, '✅ 头像已更新', 'success');
      } else {
        setProfileMsg(msg, '❌ ' + (res.message || '上传失败'), 'error');
      }
    }).catch(function (err) {
      setProfileMsg(msg, '❌ 上传异常：' + (err.message || '未知'), 'error');
    });
  }

  function handleChangePassword() {
    var oldP = document.getElementById('pwd-old').value;
    var newP = document.getElementById('pwd-new').value;
    var confP = document.getElementById('pwd-confirm').value;
    var msg = document.getElementById('profile-pwd-msg');
    setProfileMsg(msg, '提交中…', '');
    if (typeof Auth === 'undefined' || !Auth.changePassword) {
      setProfileMsg(msg, '认证模块未就绪', 'error');
      return;
    }
    Auth.changePassword(oldP, newP).then(function (res) {
      if (res.ok) {
        setProfileMsg(msg, '✅ ' + (res.message || '密码已修改，请重新登录'), 'success');
        // 强制重新登录（Auth.logout 已由后端自动删 token，前端也要清）
        setTimeout(function () {
          if (typeof Auth !== 'undefined') Auth.forceLogout();
          location.reload();
        }, 800);
      } else {
        setProfileMsg(msg, '❌ ' + (res.message || '修改失败'), 'error');
      }
    }).catch(function (err) {
      setProfileMsg(msg, '❌ 提交异常：' + (err.message || '未知'), 'error');
    });
  }

  function setProfileMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = 'profile-msg' + (kind ? ' ' + kind : '');
  }

  // ===== 渲染 =====
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
    document.title = Utils.formatTime(seconds) + ' — LAN·FocusFlow';
  }

  // ===== 启动 =====
  document.addEventListener('DOMContentLoaded', boot);
})();
