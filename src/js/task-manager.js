/**
 * task-manager.js — 任务 CRUD 逻辑
 * 对应 FR-1 ~ FR-5
 * AD-2 / AD-5：不直接操作 DOM，通过 EventBus 通知重绘
 */
(function (global) {

  function createTask(state, formData) {
    if (!formData.title || !formData.title.trim()) return null;
    var task = {
      id: Utils.genId(),
      title: formData.title.trim().slice(0, 80),
      description: (formData.description || '').trim().slice(0, 200),
      priority: formData.priority || 'medium',
      status: 'todo',
      pomodoroCount: 0,
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    state.tasks.unshift(task);
    Storage.set('tasks', state.tasks);
    EventBus.emit('task:created', task);
    EventBus.emit('data:changed');
    return task;
  }

  function updateTask(state, taskId, patch) {
    var t = state.tasks.find(function (x) { return x.id === taskId; });
    if (!t) return null;
    Object.assign(t, patch);
    Storage.set('tasks', state.tasks);
    EventBus.emit('task:updated', t);
    EventBus.emit('data:changed');
    return t;
  }

  function deleteTask(state, taskId) {
    var idx = state.tasks.findIndex(function (x) { return x.id === taskId; });
    if (idx === -1) return false;
    var removed = state.tasks.splice(idx, 1)[0];
    Storage.set('tasks', state.tasks);
    EventBus.emit('task:deleted', removed);
    EventBus.emit('data:changed');
    // 正在计时的任务被删除 → 联动层负责解绑（app.js 中）
    return true;
  }

  function toggleDone(state, taskId) {
    var t = state.tasks.find(function (x) { return x.id === taskId; });
    if (!t) return null;
    if (t.status === 'done') {
      t.status = 'todo';
      t.completedAt = null;
    } else {
      t.status = 'done';
      t.completedAt = new Date().toISOString();
    }
    Storage.set('tasks', state.tasks);
    EventBus.emit('task:toggled', t);
    EventBus.emit('data:changed');
    return t;
  }

  function filterTasks(state, filter) {
    if (filter === 'done') return state.tasks.filter(function (t) { return t.status === 'done'; });
    if (filter === 'todo') return state.tasks.filter(function (t) { return t.status !== 'done'; });
    return state.tasks;
  }

  function renderTaskCard(task, isSelected) {
    var cls = 'task-card priority-' + task.priority;
    if (task.status === 'done') cls += ' done';
    if (isSelected) cls += ' selected';

    return '<div class="' + cls + '" data-id="' + task.id + '">'
      + '<input type="checkbox" class="task-checkbox" ' + (task.status === 'done' ? 'checked' : '') + ' />'
      + '<div class="task-body">'
      + '<div class="task-title">' + escapeHtml(task.title) + '</div>'
      + (task.description ? '<div class="task-desc">' + escapeHtml(task.description) + '</div>' : '')
      + '<div class="task-meta">'
      + '<span>🍅 ' + task.pomodoroCount + '</span>'
      + '<span>📅 ' + task.createdAt.slice(0, 10) + '</span>'
      + '</div>'
      + '</div>'
      + '<div class="task-actions">'
      + '<button class="btn-edit" title="编辑">✏️</button>'
      + '<button class="btn-delete" title="删除">🗑️</button>'
      + '</div>'
      + '</div>';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  global.TaskManager = {
    createTask: createTask,
    updateTask: updateTask,
    deleteTask: deleteTask,
    toggleDone: toggleDone,
    filterTasks: filterTasks,
    renderTaskCard: renderTaskCard
  };
})(window);
