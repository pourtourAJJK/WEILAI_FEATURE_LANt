/**
 * stats.js — 统计数据聚合
 * 对应 FR-13 ~ FR-15
 */
(function (global) {

  /** 今日完成任务数 */
  function todayDoneTaskCount(tasks) {
    return tasks.filter(function (t) {
      return t.status === 'done' && Utils.isToday(t.completedAt);
    }).length;
  }

  /** 今日番茄数 + 专注时长（秒） */
  function todayPomodoroStats(logs) {
    var count = 0;
    var seconds = 0;
    logs.forEach(function (log) {
      if (Utils.isToday(log.finishedAt)) {
        count += 1;
        seconds += log.durationSeconds;
      }
    });
    return { count: count, totalSeconds: seconds };
  }

  global.Stats = {
    todayDoneTaskCount: todayDoneTaskCount,
    todayPomodoroStats: todayPomodoroStats
  };
})(window);
