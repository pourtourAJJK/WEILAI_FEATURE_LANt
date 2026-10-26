# FocusFlow — 智能待办清单与番茄钟专注计时工具

> 课程大作业 · 《未来技术》· 兰天霖

## 项目简介

FocusFlow 是一款面向学生群体的**轻量化、免安装、纯前端** Web 工具，将**待办任务管理**与**番茄钟专注计时**深度联动。所有数据通过浏览器 LocalStorage 本地持久化，打开即用，刷新不丢失，零广告，无后端依赖。

核心流程：**打开 → 添加任务 → 选中任务 → 开始番茄钟 → 专注 25 分钟 → 听到提示音 → 任务 +1 番茄 → 自动进入休息 → 查看统计**

## 功能清单

| 模块 | 功能 |
|------|------|
| 📋 **任务管理** | 新增、编辑、删除、完成标记、优先级、状态筛选 |
| 🍅 **番茄计时** | 专注（25min）/ 短休息（5min）/ 长休息（15min）、倒计时、暂停/恢复/跳过、结束提示音 |
| 🔗 **任务联动** | 选中任务启动计时、番茄数自动回写到任务卡片 |
| 📊 **数据统计** | 今日完成任务数、今日专注时长、今日番茄完成数、连续番茄计数 |
| ⚙️ **自定义设置** | 专注/短休息/长休息时长、长休息间隔（2-8）、提示音开关 |

## 技术栈

- **HTML5** + **CSS3**（原生，无框架）
- **JavaScript ES6+**（原生，无框架、无 npm 依赖）
- **LocalStorage**（数据持久化）
- **Web Audio API**（提示音合成）
- **setInterval**（番茄钟倒计时驱动）

## 快速启动

FocusFlow 是**纯静态应用**，无需编译、无需安装依赖：

```bash
# 方式 1：直接双击打开
open src/index.html    # macOS
# 或在文件管理器里双击 src/index.html

# 方式 2：启动本地 HTTP 服务器
python -m http.server 8080 --directory src/
# 然后浏览器访问 http://localhost:8080
```

## 项目结构

```
.
├── AGENTS.md                          # 大作业规则文档
├── _bmad-output/
│   ├── planning-artifacts/            # BMAD 阶段一、二产物
│   │   ├── product-brief.md           # 产品简报
│   │   ├── prd.md                     # 需求规格（FR-1 ~ FR-21）
│   │   ├── architecture.md            # 技术架构（分层 + EventBus）
│   │   └── epics-and-stories.md       # 任务拆分（Epic 1 ~ 7）
│   └── implementation-artifacts/      # BMAD 阶段三、四产物
│       ├── iteration-1.md             # 迭代记录
│       ├── build-report.md            # 构建报告
│       └── test-report.md             # 测试报告（34/34 PASS）
├── src/
│   ├── index.html                     # 主页面
│   ├── css/style.css                  # 全部样式
│   └── js/
│       ├── app.js                     # 主控制器
│       ├── event-bus.js               # 极简发布/订阅
│       ├── storage.js                 # LocalStorage 封装
│       ├── utils.js                   # 工具函数（时间/提示音）
│       ├── settings.js                # 设置读写
│       ├── task-manager.js            # 任务 CRUD
│       ├── timer.js                   # 番茄钟引擎
│       └── stats.js                   # 统计聚合
├── .gitignore
└── README.md
```

## BMAD-Method 工作流产物

| 阶段 | 产物 | 提交信息 | Commit Hash |
|------|------|----------|-------------|
| 初始化 | AGENTS.md + .gitignore | `chore: 初始化仓库结构与大作业规则文档` | `be34483` |
| 需求分析 | product-brief.md + prd.md | `docs: 完成产品简报与需求规格` | `3045f21` |
| 规划与设计 | architecture.md + epics-and-stories.md | `docs: 完成技术架构与任务拆分` | `411b650` |
| 开发实现 | 全部功能代码 | `feat: 完成完整实现` | `1bb385f` |
| 验证改进 | iteration-1.md + build-report.md + test-report.md | `test: 核心逻辑验证 34/34 PASS` | （待提交） |

## Git 分支与合并痕迹

```
*   Merge branch 'feature/full-implementation' into main  (76dd259)
|\
| * feat: 完成完整实现（任务管理+番茄钟+联动+统计+设置）    (1bb385f)
|/
* feat: 完成 Epic1 项目骨架（HTML+CSS+基础JS模块）          (254c121)
* docs: 完成技术架构与任务拆分                               (411b650)
* docs: 完成产品简报与需求规格                               (3045f21)
* chore: 初始化仓库结构与大作业规则文档                      (be34483)
```

## 测试结果

| 项 | 结果 |
|----|------|
| 8 个 JS 文件语法检查 | **8/8 PASS** |
| HTTP 服务 | **200 OK** |
| 核心逻辑单元测试 | **34/34 PASS** |
| 覆盖模块 | Utils / Storage / Settings / EventBus / Timer / TaskManager / Stats |

## 核心演示流程（可当场跑通）

1. 打开 FocusFlow 页面
2. 输入任务 "数据结构 P1-P5" → 点添加
3. 点击任务卡片选中（任务标题出现在右侧"当前任务"）
4. 点 **▶ 开始专注** → 倒计时 25:00 开始
5. （快进到 0 或手动测逻辑）→ 归零后听到 🎵 提示音 + "GOOD JOB ✨"
6. 任务卡片 🍅 数 +1
7. 自动进入休息 5 分钟
8. 顶部统计栏数字实时更新
9. 打开设置 → 改 30 分钟 → 保存 → 刷新 → 设置保留

## 后续计划（v2）

- 深色模式（CSS 变量扩展）
- 数据导出（CSV / JSON）
- 任务拖拽排序
- 键盘快捷键
- PWA 离线安装
