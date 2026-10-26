/**
 * event-bus.js — 极简发布/订阅
 * 提供 on / emit / off 三个 API
 */
(function (global) {
  const listeners = {};

  function on(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
    return function () { off(event, handler); };
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach(function (fn) {
      try { fn(payload); } catch (e) { console.warn('[event-bus] handler error:', event, e); }
    });
  }

  function off(event, handler) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(function (fn) { return fn !== handler; });
  }

  global.EventBus = { on: on, emit: emit, off: off };
})(window);
