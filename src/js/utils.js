/**
 * utils.js — 工具函数
 */
(function (global) {

  /** 秒数 → "MM:SS" 格式 */
  function formatTime(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  /** 秒数 → "X 小时 Y 分钟"  */
  function formatDuration(totalSeconds) {
    var mins = Math.floor(totalSeconds / 60);
    if (mins < 60) return mins + ' 分钟';
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return h + ' 小时 ' + m + ' 分钟';
  }

  /** 今日开始时刻的 ISO 字符串 */
  function todayStart() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  /** 给定 ISO 字符串是否属于今日 */
  function isToday(isoStr) {
    if (!isoStr) return false;
    var d = new Date(isoStr);
    var now = new Date();
    return d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
  }

  /** 生成短 ID */
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /** clamp 工具 */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /**
   * 合成提示音 — Web Audio API
   * AD-1 相关：提示音开关由 Settings 控制
   */
  var audioCtx = null;
  function beep(durationMs, freq) {
    if (!freq) freq = 880;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('[utils] beep failed:', e);
    }
  }

  /** 番茄结束双响提示 */
  function playTomatoDone() {
    beep(200, 880);
    setTimeout(function () { beep(300, 1046); }, 250);
  }

  /** 休息结束提示（单响稍低） */
  function playBreakDone() {
    beep(400, 659);
  }

  global.Utils = {
    formatTime: formatTime,
    formatDuration: formatDuration,
    todayStart: todayStart,
    isToday: isToday,
    genId: genId,
    clamp: clamp,
    playTomatoDone: playTomatoDone,
    playBreakDone: playBreakDone
  };
})(window);
