# Epics & Stories — FocusFlow v1

> 拆分自 `prd.md` FR-1 ~ FR-21，供开发阶段按 Epic 逐个实现。
> 每个 Epic 建议建独立 feature 分支开发 → 合并回 main，产生 merge commit 痕迹。

---

## Epic 1 — 项目骨架与基础设施

**目标**：搭建可运行的空壳应用骨架，使后续每个模块都能独立开发并即时验证。

### Story 1.1 — HTML 骨架 + CSS 主题 + 主入口

- **作为** 用户，我打开 `src/index.html` 能看到 FocusFlow 页面的基本布局
- **功能**：
  - 创建单页 HTML 骨架：左侧任务列表区 + 右侧番茄钟区 + 顶部统计栏 + 设置按钮
  - 引入 `style.css` 提供基础主题色（番茄红 #E86B5C、清新绿 #5CB85C、中性灰 #333）
  - 创建 `app.js` 作为 JS 主入口，DOMContentLoaded 后打印欢迎日志
  - 创建 `event-bus.js` 实现极简 on/emit/off
  - 创建 `storage.js` 实现 LocalStorage get/set/remove 封装（三个 key：`ff_tasks` / `ff_settings` / `ff_pomodoro_logs`）
  - 创建 `utils.js` 提供 `formatTime(seconds)`、`todayStr()` 等工具函数
- **验收**：
  - 浏览器打开 index.html 无控制台报错
  - `localStorage.setItem` 测试写入 `ff_test: hello` 成功

### Story 1.2 — 默认设置与首次访问初始化

- **对应 FR-21**
- **功能**：
  - `storage.js` 中声明默认 settings：`{focusMinutes:25, shortBreakMinutes:5, longBreakMinutes:15, longBreakEvery:4, soundEnabled:true}`
  - `settings.js` 提供 `getSettings()` / `saveSettings(partialSettings)` API
  - 首次打开检测 LocalStorage key 不存在时自动写入默认值
- **验收**：
  - 清缓存后首次打开，LocalStorage 出现三个 key 且值为默认值
  - 控制台不报错

---

## Epic 2 — 任务管理模块

**建议分支**：`feature/task-manager`
**对应 FR**：FR-1 ~ FR-5

### Story 2.1 — 创建任务（FR-1）

- **功能**：
  - 任务列表区顶部显示"添加任务"表单：标题输入框 + 描述输入框 + 优先级下拉 + "添加"按钮
  - 空标题时按钮 disabled
  - 提交后生成任务对象 `{id, title, description, priority, status:'todo', pomodoroCount:0, createdAt, completedAt:null}`
  - 任务写入 LocalStorage 并触发 `task:created` 事件
- **验收**：
  - 输入有效数据 → 任务卡片出现在列表顶部
  - 空标题 → 按钮 disabled 且无任务被创建
  - 刷新后任务仍在

### Story 2.2 — 任务列表渲染

- **功能**：
  - 任务卡片显示：优先级色条 + 标题 + 描述（折叠溢出） + 🍅 番茄数 + 完成状态
  - 已完成任务灰色文字显示并带删除线
  - 点击卡片整行可选中（联动番茄钟）
  - 支持状态筛选：全部 / 待办 / 已完成
- **验收**：
  - 3 条任务混合状态 → 筛选切换正确
  - 点击任务卡片右侧出现"当前选中"标记

### Story 2.3 — 编辑任务（FR-2）

- **功能**：
  - 任务卡片 hover 或有编辑按钮，点击进入 inline edit 模式
  - 保存按钮写回 LocalStorage
- **验收**：
  - 修改标题后刷新不丢失

### Story 2.4 — 删除任务（FR-3）

- **功能**：
  - 任务卡片删除按钮，点击后弹出 `confirm()` 二次确认
  - 正在计时的关联任务被删除时 → 解绑并进入 idle
- **验收**：
  - 确定删除 → 任务消失且 LocalStorage 移除该条
  - 取消删除 → 无变化

### Story 2.5 — 完成标记（FR-4）

- **功能**：
  - 任务卡片左侧完成勾选框，点击切换 status
  - 标记完成时设置 `completedAt = ISO timestamp`
- **验收**：
  - 勾选 → 任务灰化、移至列表底部、统计面板"已完成 +1"
  - 取消勾选 → 恢复状态

---

## Epic 3 — 番茄钟计时模块

**建议分支**：`feature/timer`
**对应 FR**：FR-6 ~ FR-10

### Story 3.1 — 计时器展示区与三种模式切换

- **功能**：
  - 右侧大数字倒计时显示（默认 25:00）
  - 顶部标签显示当前模式："专注中" / "短休息" / "长休息"
  - 自动根据 sessionState 切换
  - 页面标题实时更新为剩余时间（`24:59 - FocusFlow`）
- **验收**：
  - 初始 idle 状态显示默认专注时长

### Story 3.2 — 启动 / 暂停 / 恢复（FR-6, FR-7）

- **功能**：
  - "开始专注"大按钮，点击后 setInterval(fn, 1000) 启动
  - "暂停"按钮清除 interval，"恢复"按钮重建 interval
  - 跳过按钮（FR-10）
- **验收**：
  - 25 秒后剩 24:35
  - 暂停后时间静止，恢复后继续

### Story 3.3 — 番茄结束提醒（FR-8）

- **功能**：
  - 倒计时归零时：
    1. `sessionState` 重置为 `idle`（专注）或切换到休息
    2. 播放 Web Audio API 提示音（两声短 beep）
    3. 数字区显示 "GOOD JOB ✨" 文字动画
    4. 关联任务 `pomodoroCount +1`
    5. 记录 pomodoro log（`{taskId, finishedAt, durationSeconds:1500}`）
    6. 连续计数 +1，达到 longBreakEvery 时进入长休息，否则短休息
- **验收**：
  - 手动点击跳过 → 不触发番茄+1、不记录 log、连续计数不增加
  - 完成 4 个后第 5 个番茄结束自动进入长休息 15 分钟

### Story 3.4 — 休息计时（FR-9）

- **功能**：
  - 休息阶段显示绿色主题
  - 倒计时结束 → 提示"休息结束，可以开始下一个番茄" → 回到 idle
- **验收**：
  - 休息倒计时到点后自动归零并等待下一次开始

---

## Epic 4 — 任务-计时联动

**建议分支**：`feature/task-timer-linkage`
**对应 FR**：FR-11, FR-12

### Story 4.1 — 选中任务自动关联

- **功能**：
  - 点击任务卡片 → `_activeTaskId = task.id`
  - 番茄钟区"当前任务"显示该任务标题
  - 未选中时显示"未选择任务"灰色占位
- **验收**：
  - 切换选中 → 番茄钟区文字同步更新

### Story 4.2 — 番茄数回写到任务

- **功能**：
  - 仅在完整结束的专注番茄触发
  - 写入 `task.pomodoroCount += 1`
  - 同时写入 pomodoro_logs
- **验收**：
  - 完成 3 个番茄 → 任务卡片显示 🍅 x3
  - 跳过不影响计数

---

## Epic 5 — 数据统计模块

**建议分支**：`feature/stats`
**对应 FR**：FR-13 ~ FR-15

### Story 5.1 — 今日统计面板

- **功能**：
  - 顶部统计栏三张卡片：
    - 今日完成任务数（`completedAt` 在今日 0:00 之后）
    - 今日专注时长（今日 pomodoro_logs 累加 durationSeconds）
    - 今日番茄完成数（今日 pomodoro_logs 条数）
  - 数据变更时即时刷新（监听 `data:changed` 事件）
- **验收**：
  - 完成一个番茄 → 三个卡片数字即时 +1 / 时长增加
  - 刷新后统计保留

---

## Epic 6 — 设置面板

**建议分支**：`feature/settings`
**对应 FR**：FR-16 ~ FR-19

### Story 6.1 — 设置 UI 与保存

- **功能**：
  - 齿轮图标或"设置"按钮，点击打开 modal
  - 四个数字输入：专注时长 / 短休息 / 长休息 / 长休息间隔
  - 提示音开关（checkbox）
  - 保存按钮 → 写 LocalStorage → 立即生效
  - 取消按钮 → 不保存
- **验收**：
  - 改成 30 分钟后，下一次开始专注显示 30:00
  - 刷新后仍是 30

---

## Epic 7 — 集成验证与修复

**建议分支**：`feature/integration-test`
**目标**：端到端跑通核心流程、修复联调问题、验证所有 FR。

### Story 7.1 — 完整流程走通

- 打开 → 添加任务 → 选中任务 → 开始番茄 → 完成 → 统计正确更新 → 设置修改 → 下次启动生效

### Story 7.2 — 边界测试与修复

- 连续 5 个番茄后是否正确触发长休息
- 暂停后页面关闭再打开 → 当前计时如何处理（v1 暂不恢复计时，回到 idle）
- 删除正在关联的任务 → 自动解绑
- 设置最小值/最大值是否正确 clamp

### Story 7.3 — Responsive 适配

- 宽度 < 768px 时左右布局切换为上下布局
- 番茄钟大数字不溢出
