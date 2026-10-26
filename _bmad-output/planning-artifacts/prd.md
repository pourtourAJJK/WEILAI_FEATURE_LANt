---
title: FocusFlow — 智能待办清单与番茄钟专注计时工具
created: 2026-10-26
updated: 2026-10-26
---

# PRD: FocusFlow

## 0. Document Purpose

本 PRD 是产品简报 `product-brief.md` 的下游细化文档，面向开发者（本人）直接指导实现。文档按「愿景 → 用户旅程 → 术语表 → 功能需求 → 非目标 → MVP 范围 → 成功指标 → 假设索引」组织，所有功能需求 FR-N 编号全局稳定，供后续架构设计与任务拆分引用。

## 1. Vision

FocusFlow 让"添加一个任务 → 点开始 → 25 分钟后听到提示音 → 任务进度 +1 番茄"这条链路在一个页面内、不依赖任何后端的前提下完成。用户不需要学习，不需要注册，不需要联网，打开浏览器就能用。这是一款"够轻、够快、够专注"的个人效率工具。

## 2. Target User

### 2.1 Jobs To Be Done

- **功能性**：我需要管理多个学习任务，并且在每个任务上保持专注 25 分钟
- **情感性**：希望在完成一轮番茄后获得成就感，避免"任务多到看不到头"的焦虑
- **情境性**：我可能在图书馆 WiFi 差的地方使用，也可能在宿舍离线使用，数据不能丢
- **社交性**：暂无（v1 为个人工具，不含社交）

### 2.2 Non-Users (v1)

- 需要团队协作、共享任务列表的群组
- 习惯用手机 App 管理待办的用户（v1 仅桌面浏览器）
- 需要高精度时间追踪（分钟级）的自由职业者

### 2.3 Key User Journeys

- **UJ-1. 学生小林上午到图书馆，快速添加当天计划。**
  - **Persona + context**：大三学生，上午 9 点到图书馆，计划用 2 小时做数据结构作业
  - **Entry state**：浏览器打开 FocusFlow，LocalStorage 已有昨天的历史数据
  - **Path**：点击"添加任务"→ 输入"数据结构 P1-P5 题"→ 优先级选 "高"→ 任务出现在列表顶部
  - **Climax**：看到任务卡片出现在左侧待办列表中，右侧默认选中该任务的番茄钟显示就绪状态
  - **Resolution**：准备点击"开始专注"进入计时
  - **Edge case**：输入空标题时"添加"按钮应禁用

- **UJ-2. 小林启动番茄钟，专注 25 分钟后听到提示音。**
  - **Persona + context**：已进入学习状态，不想被频繁点击打断
  - **Entry state**：左侧任务列表已选中"数据结构 P1-P5 题"
  - **Path**：点击"开始专注"按钮 → 倒计时 24:59 → 全程无需操作 → 25 分钟到点
  - **Climax**：听到清脆的提示音 + 中央大数字归零 + 弹出"本轮专注完成！休息 5 分钟"的视觉提示 + 任务卡片上出现 1 个番茄图标
  - **Resolution**：自动切换到短休息模式，倒计时 5 分钟

- **UJ-3. 小林一天结束，查看今天的专注成果。**
  - **Persona + context**：晚上回宿舍前，想回顾今天学了多久
  - **Entry state**：番茄钟处于停止状态
  - **Path**：切换到"统计"标签
  - **Climax**：看到"今日完成 3 个番茄、专注 1 小时 15 分钟、2 个待办任务已完成"的数字汇总
  - **Resolution**：心中有数，满意离开

- **UJ-4. 小林觉得默认 25 分钟太短，改成 30 分钟。**
  - **Persona + context**：已经使用了一周，对默认时长不满意
  - **Path**：打开设置面板 → 将"专注时长"从 25 改为 30 → 保存
  - **Climax**：新计时立即生效，下次打开页面仍是 30
  - **Resolution**：个性化设置完成

## 3. Glossary

- **任务 (Task)** — 用户创建的待办事项，包含标题、描述、优先级、状态、累计番茄数、创建时间等属性
- **番茄 (Pomodoro)** — 一次完整的专注计时周期，默认 25 分钟，可自定义
- **短休息 (Short Break)** — 两个番茄之间的短休息，默认 5 分钟
- **长休息 (Long Break)** — 连续完成若干番茄后触发的长休息，默认 15 分钟
- **番茄状态 (Session State)** — 计时当前所处阶段：`idle` / `focusing` / `shortBreak` / `longBreak`
- **联动 (Linkage)** — 用户选中某个任务时，该任务自动与当前番茄钟绑定，番茄结束后该任务的"累计番茄数"+1
- **LocalStorage** — 浏览器提供的本地键值存储机制，用于持久化 FocusFlow 的所有数据
- **设置 (Settings)** — 用户可自定义的时长参数集合，存储于 LocalStorage

## 4. Features

### 4.1 任务管理

**Description**: 用户可以创建、编辑、删除和标记完成任务。支持按状态筛选。任务作为番茄钟的"驱动锚点"，选中一个任务后启动的番茄会自动关联到该任务。

**Functional Requirements:**

#### FR-1: 创建任务
用户可以输入标题、可选描述、选择优先级（低/中/高）创建一个新任务。创建后任务立即显示在待办列表顶部。空标题时禁止提交。[ASSUMPTION: 每个用户的任务量 < 100 条，无需分页]

**Consequences (testable):**
- 任务出现在 `_tasks` 数组中，`status = 'todo'`，`pomodoroCount = 0`
- 标题为空时"添加任务"按钮 disabled

#### FR-2: 编辑任务
用户可以点击任务卡片进入编辑模式，修改标题、描述、优先级。保存后列表立即刷新。

**Consequences (testable):**
- 更新后任务数据写回 LocalStorage
- 正在计时时编辑已关联任务，不影响当前计时进度

#### FR-3: 删除任务
用户可以删除一个任务，二次确认后从列表中彻底移除。

**Consequences (testable):**
- 删除的任务不再显示
- 正在计时的关联任务被删除时，当前番茄钟应自动解绑并进入 `idle` 状态

#### FR-4: 完成标记
用户可以将一个任务标记为"已完成"，已完成任务移至列表底部或折叠区。

**Consequences (testable):**
- 任务 `status` 变为 `done`
- 统计面板的"已完成任务数"即时 +1

#### FR-5: 状态筛选
用户可以按 "全部 / 待办 / 已完成" 筛选任务列表。

**Consequences (testable):**
- 切换筛选标签后列表即时过滤
- 刷新页面后筛选状态重置为"全部" [ASSUMPTION: 筛选状态无需持久化]

### 4.2 番茄钟计时

**Description**: 提供三种计时模式：专注（默认 25min）、短休息（5min）、长休息（15min）。倒计时显示为大号数字，结束有声音 + 视觉提醒。支持暂停 / 恢复 / 跳过。

**Functional Requirements:**

#### FR-6: 启动专注计时
用户可以点击"开始专注"按钮启动当前番茄钟。若已选中任务，则自动与该任务联动。

**Consequences (testable):**
- `sessionState` 变为 `focusing`
- 倒计时从设置的专注时长开始递减
- 页面标题实时更新为剩余时间（如 `24:59 - FocusFlow`）

#### FR-7: 暂停 / 恢复
用户可以暂停当前计时，恢复后从暂停时刻继续。

**Consequences (testable):**
- 暂停时倒计时停止，`sessionState` 标记为 `focusing-paused`
- 恢复后继续倒计时

#### FR-8: 番茄结束提醒
倒计时归零时，触发以下事件：
1. 播放提示音（Web Audio API 生成）
2. 中央数字变为 "GOOD JOB" 文字
3. 已关联任务的 `pomodoroCount` +1
4. 自动切换到短休息模式（连续完成 N 个番茄后切换长休息）

**Consequences (testable):**
- 提示音播放可被用户听到
- 关联任务卡片出现新的番茄图标
- 连续完成计数正确，达到阈值时进入长休息

#### FR-9: 休息计时
休息阶段倒计时，结束后提示用户开始下一个番茄。

**Consequences (testable):**
- `sessionState` 根据类型变为 `shortBreak` 或 `longBreak`
- 休息计时结束后自动回到 `idle` 等待用户下一次开始

#### FR-10: 跳过计时
用户可以跳过当前计时阶段（专注或休息）。

**Consequences (testable):**
- 跳过专注时不计入番茄数
- 跳过休息时直接回到 `idle`

### 4.3 任务-计时联动

**Description**: 选中任务与番茄钟绑定。番茄完成自动累加该任务的番茄数；任务卡片显示已累计的番茄数量（🍅 x N）。

**Functional Requirements:**

#### FR-11: 选中即关联
用户在任务列表点击一个任务卡片后，右侧番茄钟的"当前任务"显示区更新为该任务标题。

**Consequences (testable):**
- `_activeTaskId` 被更新为该任务 id
- 未选中任何任务时，番茄钟可独立运行但不计入任务

#### FR-12: 番茄数回写
当且仅当一次专注计时**完整结束**（非跳过、非中途放弃）时，关联任务的 `pomodoroCount` +1。

**Consequences (testable):**
- 暂停后恢复并完整结束 → +1
- 点击跳过 → +0
- 关闭浏览器后重开（计时丢失）→ +0

### 4.4 数据统计

**Description**: 顶部或独立标签页展示今日专注数据。

**Functional Requirements:**

#### FR-13: 今日完成任务数
统计 `status = 'done'` 且 `completedAt` 为今日的任务数量。

#### FR-14: 今日专注时长
累加今日所有完整结束的番茄时长（秒），转换为 "X 小时 Y 分钟" 格式显示。

#### FR-15: 今日番茄完成数
统计今日完整结束的番茄总数。

**Feature-specific NFRs:**
- 统计计算在数据变更时**即时响应**（< 100ms），不使用防抖

### 4.5 设置面板

**Functional Requirements:**

#### FR-16: 自定义专注时长
用户可设置 5-60 分钟之间的专注时长，整数。保存后立即生效并持久化。

#### FR-17: 自定义休息时长
短休息 1-15 分钟、长休息 10-30 分钟，均可自定义。

#### FR-18: 长休息间隔
连续完成多少个番茄后触发长休息，默认 4，可设置 2-8。

#### FR-19: 提示音开关
用户可开启 / 关闭番茄结束时的声音提醒。

### 4.6 数据持久化

#### FR-20: LocalStorage 自动保存
所有任务数据、计时设置、统计数据在每次变更时自动写入 LocalStorage。[ASSUMPTION: LocalStorage 配额 5MB 足够 v1 规模使用]

**Consequences (testable):**
- 刷新页面后所有设置、任务、统计完整恢复
- `localStorage.setItem` 在每次写操作后被调用

#### FR-21: 数据初始化
首次访问时，自动创建 LocalStorage 的三个 key：`_tasks`（空数组）、`_settings`（默认值）、`_stats`（空对象）。

### 4.7 用户注册与登录（v1 新增）

**Description**: 支持账户注册与登录，校验自建账户身份，登录成功后签发本地令牌，页面刷新通过令牌自动恢复登录状态。连续输错密码 5 次后账户自动锁定 5 分钟，锁定期间即使密码正确也无法登录。

#### FR-22: 用户注册
用户可以输入用户名（3-20 字符）和密码（至少 6 位）创建账户。用户名唯一。密码使用 SubtleCrypto SHA-256 哈希后存 LocalStorage（不存明文）。注册成功后自动登录。

**Consequences (testable):**
- 重复用户名 → 返回 `{ok:false, error:'USER_EXISTS'}`
- 用户名过短 → 返回 `{ok:false, error:'USERNAME_SHORT'}`
- 密码过短 → 返回 `{ok:false, error:'PASSWORD_SHORT'}`
- 成功 → 返回 `{ok:true, token, user: {username}}`

#### FR-23: 用户登录（含令牌签发）
用户输入用户名密码 → 校验密码哈希 → 成功则签发一个随机 token（UUID 格式）存 LocalStorage `ff_current_token`，同时把 token 写入 `ff_auth_state[username].activeToken`。

**Consequences (testable):**
- 密码正确 + 未锁定 → `{ok:true, token}`
- 密码错误 → `{ok:false, error:'WRONG_PASSWORD', remaining: N}` N 是剩余尝试次数
- 账户不存在 → `{ok:false, error:'USER_NOT_FOUND'}`
- 锁定期间 → `{ok:false, error:'ACCOUNT_LOCKED', lockedUntil: timestamp}`

#### FR-24: 身份令牌校验（路由守卫）
每次页面初始化时读取 `ff_current_token`，校验是否在 `ff_auth_state[username].activeToken` 中匹配；未登录或令牌无效 → 显示登录页；有效 → 直接进入主应用。

**Consequences (testable):**
- 浏览器刷新后保持登录状态
- 手动篡改 LocalStorage token → 校验失败 → 被踢回登录页

#### FR-25: 登录失败锁定机制
连续 5 次登录失败后，该账户的 `authState.lockedUntil = Date.now() + 300000`（5 分钟后自动解锁）。锁定期间**在密码校验之前**就短路拒绝。

**Consequences (testable):**
- 失败计数在成功登录后归零
- 锁定期间即使输入正确密码也返回 `ACCOUNT_LOCKED`
- 5 分钟后自动解锁，无需手动干预
- 锁定逻辑在密码哈希校验**之前**执行，避免被正确密码绕过

#### FR-26: 用户登出
点击顶部"登出"按钮 → 清除 LocalStorage 的 `ff_current_token` → 刷新回到登录页。

## 5. Non-Goals (Explicit)

- 不做后端服务器，不做 API（认证逻辑全部在前端 LocalStorage）
- 不做移动端原生 App
- 不做任务拖拽排序（v1 按创建时间排序）
- 不做任务标签 / 分类 / 筛选除状态外的维度
- 不做深色模式（v2）
- 不做键盘快捷键（v2 考虑）
- 不做番茄数可视化图表（仅数字显示）
- 不做找回密码 / 邮箱验证
- 不做多角色权限（管理员 / 普通用户）

## 6. MVP Scope

### 6.1 In Scope
- 用户注册 + 登录 + 令牌 + 登出（FR-22 ~ FR-26）
- 登录失败 5 次锁定 5 分钟
- 任务 CRUD + 完成标记 + 状态筛选
- 番茄钟三种模式 + 暂停恢复 + 跳过 + 结束提醒
- 任务与计时的关联联动
- 顶部三个统计数字（今日完成任务数 / 专注时长 / 番茄数）
- 设置面板（专注 / 短休息 / 长休息时长 + 长休息间隔 + 提示音开关）
- LocalStorage 持久化

### 6.2 Out of Scope for MVP
- 深色模式 → v2
- 数据导出 (CSV / JSON) → v2
- 拖拽排序任务 → v2
- 键盘快捷键 → v2
- PWA 离线安装 → v3

## 7. Success Metrics

**Primary**
- **SM-1**: 用户添加任务到启动一次番茄的时间 ≤ 30 秒。验证 FR-1, FR-6, FR-11
- **SM-2**: 番茄结束提醒被听到（声音正常）。验证 FR-8, FR-19

**Secondary**
- **SM-3**: 刷新页面后所有 LocalStorage 数据完整恢复。验证 FR-20, FR-21
- **SM-4**: 连续完成 4 个番茄后正确触发长休息。验证 FR-8, FR-18

**Counter-metrics (do not optimize)**
- **SM-C1**: 不要优化"单次渲染延迟 < 100ms"这种过度性能指标，v1 规模下无意义

## 8. Open Questions

1. 提示音是用 Web Audio API 合成还是播放预先录制的 MP3 文件？→ v1 采用 Web Audio API 合成，避免额外静态资源
2. 连续番茄计数是"今日内连续"还是"跨日延续"？→ v1 仅今日内计数，午夜重置
3. 是否需要"取消当前番茄"按钮？→ v1 需要（等同于"跳过专注"），但不计数

## 9. Assumptions Index

- §4.1 FR-1：每个用户的任务量 < 100 条，无需分页
- §4.1 FR-5：筛选状态无需持久化，刷新重置为"全部"
- §4.6 FR-20：LocalStorage 配额 5MB 足够 v1 规模使用
