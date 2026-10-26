/**
 * calendar.js — 月视图日历 + 工作计划
 * 数据模型（LocalStorage key: ff_plans）：
 *   ff_plans = {
 *     "2026-10-26": [
 *       { id, title, startAt, endAt, type, note }
 *     ]
 *   }
 *   type: "normal" | "urgent" | "holiday" | "rest"
 */
(function (global) {

  var STORAGE_KEY = "ff_plans";
  // 颜色映射（匹配参考图的横向信息条样式）
  var TYPE_COLORS = {
    normal:  "#E86B5C",   // 番茄红 — 普通工作日
    urgent:  "#F0AD4E",   // 橙黄 — 紧急/重点
    holiday: "#5CB85C",   // 绿 — 节假日
    rest:    "#8B7355"    // 棕 — 休息日
  };
  var TYPE_LABELS = {
    normal:  "普通",
    urgent:  "紧急",
    holiday: "节假日",
    rest:    "休息"
  };

  // ===== 数据 =====
  function loadAll() { return Storage.get(STORAGE_KEY, {}); }
  function saveAll(data) { Storage.set(STORAGE_KEY, data); }

  function dateKey(y, m, d) {
    m = String(m + 1).padStart(2, "0");
    d = String(d).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  function todayKey() {
    var t = new Date();
    return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
  }

  function genPlanId() { return "p_" + Utils.genId(); }

  function createPlan(dateStr, plan) {
    var all = loadAll();
    if (!all[dateStr]) all[dateStr] = [];
    var item = Object.assign({ id: genPlanId(), title: "", startAt: "09:00", endAt: "10:00", type: "normal", note: "" }, plan);
    all[dateStr].push(item);
    saveAll(all);
    EventBus.emit("calendar:changed", { date: dateStr, action: "create", plan: item });
    return item;
  }

  function updatePlan(dateStr, planId, patch) {
    var all = loadAll();
    if (!all[dateStr]) return null;
    var item = all[dateStr].find(function (p) { return p.id === planId; });
    if (!item) return null;
    Object.assign(item, patch);
    saveAll(all);
    EventBus.emit("calendar:changed", { date: dateStr, action: "update", plan: item });
    return item;
  }

  function deletePlan(dateStr, planId) {
    var all = loadAll();
    if (!all[dateStr]) return false;
    var idx = all[dateStr].findIndex(function (p) { return p.id === planId; });
    if (idx === -1) return false;
    all[dateStr].splice(idx, 1);
    if (all[dateStr].length === 0) delete all[dateStr];
    saveAll(all);
    EventBus.emit("calendar:changed", { date: dateStr, action: "delete", planId: planId });
    return true;
  }

  function getPlans(dateStr) {
    var all = loadAll();
    return all[dateStr] || [];
  }

  // ===== 日历渲染 =====
  var calState = { year: 0, month: 0, selectedDate: null };

  function init(container) {
    var now = new Date();
    calState.year = now.getFullYear();
    calState.month = now.getMonth();
    calState.selectedDate = dateKey(now.getFullYear(), now.getMonth(), now.getDate());

    render(container);
    EventBus.on("calendar:changed", function () { render(container); });
  }

  function prevMonth(container) {
    calState.month--;
    if (calState.month < 0) { calState.month = 11; calState.year--; }
    render(container);
  }

  function nextMonth(container) {
    calState.month++;
    if (calState.month > 11) { calState.month = 0; calState.year++; }
    render(container);
  }

  function goToday(container) {
    var now = new Date();
    calState.year = now.getFullYear();
    calState.month = now.getMonth();
    calState.selectedDate = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
    render(container);
  }

  function render(container) {
    container = typeof container === "string" ? document.getElementById(container) : container;
    if (!container) return;

    var y = calState.year;
    var m = calState.month;
    var firstDay = new Date(y, m, 1);
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var firstWeekday = firstDay.getDay(); // 0=Sun
    var today = new Date();
    var todayK = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

    // 上月尾部日期
    var prevMonthDays = new Date(y, m, 0).getDate();
    var leadingBlanks = [];
    for (var i = firstWeekday - 1; i >= 0; i--) {
      leadingBlanks.push({
        day: prevMonthDays - i,
        key: dateKey(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, prevMonthDays - i),
        isOtherMonth: true,
      });
    }

    // 本月日期
    var cells = leadingBlanks.slice();
    for (var d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, key: dateKey(y, m, d), isOtherMonth: false });
    }

    // 下月头部
    var trailing = (7 - (cells.length % 7)) % 7;
    for (var j = 1; j <= trailing; j++) {
      cells.push({
        day: j,
        key: dateKey(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, j),
        isOtherMonth: true,
      });
    }

    // 渲染
    var html = "";
    html += '<div class="cal-toolbar">';
    html += '  <button class="cal-nav" data-act="prev">◀</button>';
    html += '  <div class="cal-title">' + y + '年 ' + (m + 1) + '月</div>';
    html += '  <button class="cal-nav" data-act="next">▶</button>';
    html += '  <button class="cal-today" data-act="today">今天</button>';
    html += '  <button class="cal-add" data-act="add-day">+ 选中日工作计划</button>';
    html += '</div>';

    html += '<div class="cal-weekdays">';
    ["一", "二", "三", "四", "五", "六", "日"].forEach(function (w, idx) {
      var cls = (idx === 5 || idx === 6) ? "cal-wd weekend" : "cal-wd";
      html += '<div class="' + cls + '">' + w + '</div>';
    });
    html += '</div>';

    html += '<div class="cal-grid">';
    cells.forEach(function (cell, idx) {
      var weekday = idx % 7;
      var isWeekend = (weekday === 5 || weekday === 6);
      var plans = getPlans(cell.key);
      var isToday = cell.key === todayK && !cell.isOtherMonth;
      var isSelected = cell.key === calState.selectedDate;

      var cls = "cal-cell";
      if (cell.isOtherMonth) cls += " other";
      if (isWeekend && !cell.isOtherMonth) cls += " weekend";
      if (isToday) cls += " today";
      if (isSelected) cls += " selected";

      html += '<div class="' + cls + '" data-date="' + cell.key + '">';
      html += '<div class="cal-day-num">' + cell.day + '</div>';

      // 工作计划条（堆叠显示，参考图样式）
      html += '<div class="cal-plans">';
      plans.forEach(function (p) {
        var color = TYPE_COLORS[p.type] || TYPE_COLORS.normal;
        html += '<div class="cal-plan-bar" data-plan-id="' + p.id + '" style="background:' + color + ';" title="' + (p.title || "") + '">';
        html += '<span class="cal-plan-time">' + (p.startAt || "") + '</span> ';
        html += '<span class="cal-plan-title">' + (p.title || "未命名") + '</span>';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';

      // 换行
      if ((idx + 1) % 7 === 0) html += '';
    });
    html += '</div>';

    container.innerHTML = html;

    // 事件绑定（委托到 container）
    container.onclick = function (e) {
      var nav = e.target.closest(".cal-nav");
      if (nav) {
        if (nav.dataset.act === "prev") prevMonth(container);
        else nextMonth(container);
        return;
      }
      var todayBtn = e.target.closest(".cal-today");
      if (todayBtn) { goToday(container); return; }

      var addBtn = e.target.closest(".cal-add");
      if (addBtn) {
        editPlan(calState.selectedDate || todayKey(), null);
        return;
      }

      // 选中日期格子
      var cell = e.target.closest(".cal-cell");
      if (cell) {
        calState.selectedDate = cell.dataset.date;
        render(container);
      }
    };

    // 双击编辑计划条目
    container.ondblclick = function (e) {
      var bar = e.target.closest(".cal-plan-bar");
      if (bar) {
        var cell = e.target.closest(".cal-cell");
        var dateStr = cell ? cell.dataset.date : calState.selectedDate;
        editPlan(dateStr, bar.dataset.planId);
        return;
      }
    };
  }

  // ===== 编辑弹窗 =====
  function editPlan(dateStr, planId) {
    var existing = planId ? getPlans(dateStr).find(function (p) { return p.id === planId; }) : null;
    var title = existing ? (existing.title || "") : "";
    var startAt = existing ? (existing.startAt || "09:00") : "09:00";
    var endAt = existing ? (existing.endAt || "10:00") : "10:00";
    var type = existing ? (existing.type || "normal") : "normal";
    var note = existing ? (existing.note || "") : "";

    var html = "";
    html += '<div class="modal" id="plan-modal" style="display:flex">';
    html += '  <div class="modal-content plan-modal">';
    html += '    <h3>' + (existing ? "编辑" : "新增") + '工作计划 · ' + dateStr + '</h3>';
    html += '    <div class="plan-form">';
    html += '      <label>标题<input type="text" id="plan-title" value="' + title.replace(/"/g, "&quot;") + '" placeholder="工作事项" maxlength="40" /></label>';
    html += '      <div class="plan-row">';
    html += '        <label>开始<input type="time" id="plan-start" value="' + startAt + '" /></label>';
    html += '        <label>结束<input type="time" id="plan-end" value="' + endAt + '" /></label>';
    html += '      </div>';
    html += '      <label>类型<select id="plan-type">';
    Object.keys(TYPE_LABELS).forEach(function (t) {
      html += '<option value="' + t + '"' + (t === type ? " selected" : "") + '>' + TYPE_LABELS[t] + '</option>';
    });
    html += '      </select></label>';
    html += '      <label>备注<textarea id="plan-note" rows="2" placeholder="可选" maxlength="120">' + note + '</textarea></label>';
    html += '    </div>';
    html += '    <div class="modal-actions">';
    if (existing) html += '      <button class="btn btn-danger" id="plan-delete">删除</button>';
    html += '      <button class="btn btn-secondary" id="plan-cancel">取消</button>';
    html += '      <button class="btn btn-primary" id="plan-save">保存</button>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    // 移除旧 modal（防止重复）
    var old = document.getElementById("plan-modal");
    if (old) old.remove();

    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);

    var modal = document.getElementById("plan-modal");
    modal.style.display = "flex";

    modal.querySelector("#plan-cancel").onclick = function () { modal.remove(); };
    modal.onclick = function (e) { if (e.target === modal) modal.remove(); };

    modal.querySelector("#plan-save").onclick = function () {
      var t = modal.querySelector("#plan-title").value.trim();
      var s = modal.querySelector("#plan-start").value;
      var en = modal.querySelector("#plan-end").value;
      var tp = modal.querySelector("#plan-type").value;
      var n = modal.querySelector("#plan-note").value.trim();
      if (!t) { alert("标题不能为空"); return; }

      if (existing) {
        updatePlan(dateStr, existing.id, { title: t, startAt: s, endAt: en, type: tp, note: n });
      } else {
        createPlan(dateStr, { title: t, startAt: s, endAt: en, type: tp, note: n });
      }
      modal.remove();
    };

    var delBtn = modal.querySelector("#plan-delete");
    if (delBtn) {
      delBtn.onclick = function () {
        if (confirm("确定删除这条工作计划吗？")) {
          deletePlan(dateStr, existing.id);
          modal.remove();
        }
      };
    }
  }

  global.Calendar = {
    TYPE_COLORS: TYPE_COLORS,
    TYPE_LABELS: TYPE_LABELS,
    init: init,
    render: render,
    getPlans: getPlans,
    createPlan: createPlan,
    updatePlan: updatePlan,
    deletePlan: deletePlan,
    editPlan: editPlan,
    todayKey: todayKey,
  };
})(window);
