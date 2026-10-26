# Test Report — FocusFlow v1

**日期**：2026-10-26  
**测试类型**：核心逻辑沙箱验证（Node.js VM + with(g) 作用域注入）  
**测试覆盖模块**：Utils / Storage / Settings / EventBus / Timer / TaskManager / Stats  
**总用例数**：34  
**通过率**：**34 / 34 (100%)**

---

## 测试环境

- Node.js v24.0.0
- 通过 `with(g) { <module_code> }` 让所有 IIFE 从共享的 `g` 对象查找跨模块依赖（Storage、EventBus、Utils 等）
- 模拟 localStorage：纯 JS 对象 `{ _d: {}, getItem, setItem, removeItem }`
- 不依赖浏览器 DOM / Web Audio API（后者通过 null stub 替换）

## 结果分模块

### Utils — 6/6 ✅
| # | 用例 | 预期 | 实际 |
|---|------|------|------|
| 1 | `formatTime(25*60)` | `"25:00"` | ✅ |
| 2 | `formatTime(0)` | `"00:00"` | ✅ |
| 3 | `formatDuration(900)` | `"15 分钟"` | ✅ |
| 4 | `clamp(100, 5, 60)` | `60` | ✅ |
| 5 | `clamp(3, 5, 60)` | `5` | ✅ |
| 6 | `genId()` | 非空字符串 | ✅ |

### Storage — 3/3 ✅
| # | 用例 | 预期 | 实际 |
|---|------|------|------|
| 1 | 首次访问 `get('tasks', [])` | `[]` | ✅ |
| 2 | `set('tasks', [...])` 后 `get` | 恢复写入值 | ✅ |
| 3 | `isFirstVisit()` | 清空后 true，写入后 false | ✅ |

### Settings — 5/5 ✅
| # | 用例 | 预期 | 实际 |
|---|------|------|------|
| 1 | 默认 focusMinutes | `25` | ✅ |
| 2 | 默认 shortBreakMinutes | `5` | ✅ |
| 3 | 默认 longBreakMinutes | `15` | ✅ |
| 4 | 默认 soundEnabled | `true` | ✅ |
| 5 | `saveSettings({focusMinutes: 70})` | clamp → `60` | ✅ |

### EventBus — 1/1 ✅
| # | 用例 | 预期 | 实际 |
|---|------|------|------|
| 1 | `emit('test', 'hello')` → `on` callback | 收到 payload | ✅ |

### Timer — 7/7 ✅
| # | 用例 | 预期 | 实际 |
|---|------|------|------|
| 1 | 初始 state | `'idle'` | ✅ |
| 2 | 初始 mode | `null` | ✅ |
| 3 | `start('focus', 5)` → state | `'focusing'` | ✅ |
| 4 | `start('focus', 5)` → mode | `'focus'` | ✅ |
| 5 | `pause()` → state | `'focusing-paused'` | ✅ |
| 6 | `resume()` → state | `'focusing'` | ✅ |
| 7 | `skip()` → state | `'idle'` | ✅ |

### TaskManager — 8/8 ✅
| # | 用例 | 预期 | 实际 |
|---|------|------|------|
| 1 | `createTask` 返回有效 task | `!== null` | ✅ |
| 2 | create 后 state.tasks.length | `1` | ✅ |
| 3 | priority 正确传递 | `'high'` | ✅ |
| 4 | pomodoroCount 初始 | `0` | ✅ |
| 5 | 空标题拒绝创建 | 返回 `null` | ✅ |
| 6 | `toggleDone` → status | `'done'` | ✅ |
| 7 | toggle 后有 completedAt | 非 null | ✅ |
| 8 | `deleteTask` → 空 | `length === 0` | ✅ |

### Stats — 5/5 ✅
| # | 用例 | 预期 | 实际 |
|---|------|------|------|
| 1 | 空任务列表 | `0` | ✅ |
| 2 | 空日志 count | `0` | ✅ |
| 3 | 空日志 seconds | `0` | ✅ |
| 4 | 今日完成 1 条 | 返回 `1` | ✅ |
| 5 | 昨天完成不计入今日 | 仍返回 `1` | ✅ |

## 已知未覆盖场景（人工测试需验证）

1. **Timer 自然倒计时到零触发完整结束** — 沙箱里没有真实等待 5 秒，只测了 start/pause/resume/skip 的状态转换；建议人工测试：启动一个 1 分钟番茄，等待自然归零
2. **Web Audio 提示音** — 需要真实浏览器环境验证（沙箱里 AudioContext 为 null）
3. **DOM 渲染与交互** — 所有 HTML 渲染函数（TaskManager.renderTaskCard）未做 DOM 级验证，只验证了数据层逻辑
4. **页面刷新后数据恢复** — 需要真实浏览器打开 → 添加任务 → 刷新 → 验证 LocalStorage 持久化
5. **长休息自动触发** — 需要连续完成 4 个番茄后验证是否自动切换到 15min 长休息

## 验证建议（人工端到端）

1. 打开 `src/index.html`
2. 添加任务 "测试1"、"测试2"、"测试3"
3. 选中 "测试1" → 开始专注 → 等待 25 秒结束 → 听到提示音
4. 检查 "测试1" 的 🍅 数是否 +1
5. 连续完成 4 个番茄 → 验证第 4 个结束后是否进入长休息
6. 打开设置 → 改成 30 分钟 → 保存 → 刷新 → 再次打开设置确认仍是 30
7. 切换"已完成"筛选 → 勾选任务1 为完成 → 验证任务移到底部
8. 刷新页面 → 所有数据完整恢复
