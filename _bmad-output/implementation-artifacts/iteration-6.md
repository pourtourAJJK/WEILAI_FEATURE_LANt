# Iteration 6 — 日历容器内任务横向条

**日期**: 2026-10-26
**分支**: `feature/calendar-task-strip` → merge `b6b16ff3629`
**需求来源**: 用户"将新增的任务项添加到日历容器组件内部，采用横向布局方式进行展示"

---

## 一、改动说明

本轮在日历容器内部新增一条**横向滚动的任务卡片带**，把左侧任务区的 `tasks`（待办任务）以横排卡片形式嵌在 calendar-container 里：

| 文件 | 内容 |
|------|------|
| `calendar.js` | render() 里读 `Storage.get("tasks",[])` 过滤 status!=="done" 的任务，在 toolbar 与 weekdays 之间生成 `.cal-task-strip` HTML；init() 新增 `EventBus.on("data:changed")` 监听，任务 CRUD 自动重绘日历 |
| `calendar.css` | `.cal-task-strip` flex-direction:row + gap:8px + overflow-x:auto；`.cal-task-item` flex-shrink:0（**关键**，让父容器触发横向滚动）+ 优先级左边框（pri-high/medium/low）+ hover 微动效 |

## 二、技术决策

### 2.1 任务数据来源：calendar.js 直接读 Storage
- **不依赖 app.js state.tasks**：calendar.js 是自包含 IIFE，跨模块 import state 会打破边界
- Storage 是单一数据源，task-manager.js 的 createTask → Storage.set → data:changed 事件 → calendar.js data:changed 监听 → render() 刷新 → strip 里出现新任务
- **教训**（经验 1831078）：要锁定"哪个容器是真正的 flex items 父节点"——这里就是 render() 里动态生成的 `.cal-task-strip`，而非 `.cal-grid`

### 2.2 flex 横排 + 横向滚动
```css
.cal-task-strip { display:flex; flex-direction:row; gap:8px; overflow-x:auto; }
.cal-task-item  { flex-shrink:0; /* 关键：不压缩，让 strip 产生横向滚动 */ }
```
- **教训**（经验 1831078 Failure #1）：如果忘了 `flex-shrink:0`，item 会被压缩成一列或溢出容器，strip 不会出现真正的横向滚动
- scrollbar 用自定义样式（6px 高度 + var(--color-border) thumb），适配夜间模式

### 2.3 DOM 位置
```
.calendar-container
  ├── .cal-toolbar
  ├── .cal-task-strip    ← 新插入（toolbar 和 weekdays 之间）
  ├── .cal-weekdays
  └── .cal-grid
```
- strip 是 `.cal-grid` 的**兄弟节点**，**不继承 7 列 grid-template-columns**
- strip 不进入任何 existing grid 容器，避免 layout 污染

### 2.4 为什么要加 `EventBus.on("data:changed")`
- 原 calendar.js init() 只监听 `calendar:changed`（工作计划 CRUD 触发）
- 新增任务横向条后，**tasks CRUD 也要驱动日历重绘**
- EventBus.on("data:changed") 是全局事件，TaskManager 的所有 CRUD 都会 emit → 日历自动刷新 strip

## 三、构建 / 验证结果

| 检查项 | 结果 |
|--------|------|
| calendar.js 语法 | ✅ PASS |
| `cal-task-strip` 在 render() 里生成 | ✅ line 169 |
| `EventBus.on("data:changed")` 监听 | ✅ line 94 |
| calendar.js HTTP 200 | ✅ |
| index.html HTTP 200 | ✅ |
| `cal-task-item` flex-shrink:0 | ✅ 关键行存在 |
| Git merge --no-ff | ✅ `b6b16ff3629` |

## 四、已知局限

1. **任务卡点击不联动选中**：点击 `.cal-task-item` 没有联动 app.js 的 `state.activeTaskId`，只是展示用途；可加 EventBus.emit("task:selected", ...) 实现跨模块联动
2. **已完成任务不显示**：当前 strip 过滤掉 `status==="done"` 的任务，避免干扰；如需回顾，可加个"显示已完成"切换
3. **任务卡与任务区重复展示**：左侧 task-list 和 strip 都显示同一批待办，信息冗余；长期可考虑"strip 只显示高优先级"或"可折叠"
4. **横向滚动在触屏上是原生行为**：桌面端需要鼠标滚轮（默认竖向）→ 可加 shift+wheel 横向滚动的 JS 监听（非必需）
