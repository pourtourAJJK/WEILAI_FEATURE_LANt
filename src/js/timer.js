/**
 * timer.js — 番茄钟计时引擎
 * 对应 FR-6 ~ FR-10
 * AD-3: setInterval 每秒驱动，防止浏览器节流
 * AD-4: 番茄数仅在完整结束时累加（由联动层 app.js 负责）
 * AD-5: Timer 模块只维护状态和秒数，不关心"关联哪个任务"
 */
(function (global) {

  function Timer() {
    this.state = 'idle';           // idle | focusing | shortBreak | longBreak | focusing-paused | ...
    this.mode = null;              // 'focus' | 'shortBreak' | 'longBreak'
    this.totalSeconds = 0;         // 当前模式的总秒数
    this.remainingSeconds = 0;     // 剩余秒数
    this.intervalId = null;
    this.wasPaused = false;        // 是否曾经暂停过（AD-4 用来判断是否完整结束）
    this.onTick = null;            // 每秒回调
    this.onComplete = null;        // 完整结束回调（非跳过）
    this.onSkip = null;            // 跳过回调
  }

  Timer.prototype.start = function (mode, seconds, callbacks) {
    var self = this;
    this.stop();

    this.mode = mode;
    this.totalSeconds = seconds;
    this.remainingSeconds = seconds;
    this.wasPaused = false;
    this.onTick = callbacks && callbacks.onTick;
    this.onComplete = callbacks && callbacks.onComplete;
    this.onSkip = callbacks && callbacks.onSkip;

    if (mode === 'focus') this.state = 'focusing';
    else if (mode === 'shortBreak') this.state = 'shortBreak';
    else this.state = 'longBreak';

    this._tick();
    this.intervalId = setInterval(function () { self._tick(); }, 1000);

    EventBus.emit('timer:started', { mode: mode, seconds: seconds });
  };

  Timer.prototype._tick = function () {
    if (this.remainingSeconds <= 0) {
      // 完整结束
      this._finish(true);
      return;
    }
    this.remainingSeconds -= 1;
    if (this.onTick) this.onTick(this.remainingSeconds);
    EventBus.emit('timer:tick', this.remainingSeconds);
  };

  Timer.prototype._finish = function (completed) {
    this.stop();
    this.remainingSeconds = 0;
    this.state = 'idle';
    EventBus.emit('timer:finished', { mode: this.mode, completed: completed, wasPaused: this.wasPaused });
    if (completed && this.onComplete) this.onComplete();
  };

  Timer.prototype.pause = function () {
    if (this.state === 'idle' || this.state === 'focusing-paused') return;
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.wasPaused = true;
    this.state = this.state + '-paused';
    EventBus.emit('timer:paused');
  };

  Timer.prototype.resume = function () {
    if (this.state !== 'focusing-paused' && this.state !== 'shortBreak-paused' && this.state !== 'longBreak-paused') return;
    var self = this;
    this.state = this.state.replace('-paused', '');
    this.intervalId = setInterval(function () { self._tick(); }, 1000);
    EventBus.emit('timer:resumed');
  };

  Timer.prototype.skip = function () {
    if (this.state === 'idle') return;
    this._finish(false); // 跳过 → completed=false
    if (this.onSkip) this.onSkip();
  };

  Timer.prototype.stop = function () {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  };

  global.Timer = Timer;
})(window);
