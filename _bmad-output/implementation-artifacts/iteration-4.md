# Iteration 4 — 月日历 + 工作计划管理

**日期**: 2026-10-26
**分支**: `feature/calendar` → merge `aa02593`
**关联 Epic/Story**: Epic5（日历与工作计划）— STORY-5.1 ~ STORY-5.4

---

## 一、改动说明

本轮新增「月视图日历 + 工作计划」模块，围绕"每日工作计划可视化管理"场景补齐产品核心流程：

| Story | 实现内容 | 对应文件 |
|-------|---------|---------|
| STORY-5.1 月网格展示 | 7列日历布局、prev/next/today 导航、周末/今天高亮、其他月份淡化 | `calendar.js` render() + `calendar.css` |
| STORY-5.2 日期选中 | 单击格子选中当日、选中态高亮边框、selectedDate 状态管理 | `calendar.js` 事件委托 |
| STORY-5.3 工作计划 CRUD | 新增/修改/删除弹窗、时间/类型/标题/备注字段、LocalStorage 持久化 | `calendar.js` createPlan/updatePlan/deletePlan |
| STORY-5.4 信息条渲染 | 横向彩色条堆叠在格子内、类型颜色映射（normal/urgent/holiday/rest）、hover 反馈 | `calendar.css` .cal-plan-bar |

## 二、技术决策

### 2.1 数据模型
```js
// LocalStorage key: ff_plans
{
  "YYYY-MM-DD": [
    { id, title, startAt, endAt, type, note }
  ]
}
```
**理由**：以日期字符串为 key，天然适配日历的"按天查询"；同日多条计划用数组堆叠，避免单日多 key 查找。

### 2.2 事件委托 vs 逐项绑定
- 日历容器 `.onclick` + `.ondblclick` 统一处理 prev/next/today/选中格子/编辑计划等所有交互
- **优点**：日历每月重渲染，但事件处理器始终只挂在容器上一次，零内存泄漏
- **教训**（来自经验 1855924）：动态列表不要逐项绑事件

### 2.3 EventBus 联动
- CRUD 后 emit `calendar:changed` → render() 统一重绘
- 遵循项目已有"数据变更 → EventBus → 渲染"链路，避免跨模块直接调用

### 2.4 样式匹配参考图
- 7 列 grid 等宽 + gap:6px
- 周末背景 `#FFF9F8`、今天 2px 边框 + 圆形日期数字
- 信息条 `11px` 字号 + 类型彩色背景 + `text-overflow:ellipsis`
- 响应式断点 `768px`（缩小 gap/font）、`480px`（隐藏时间标签）

## 三、构建 / 验证结果

| 检查项 | 结果 | 方法 |
|--------|------|------|
| calendar.js 语法 | ✅ PASS | `new Function(fs.readFileSync('calendar.js'))` |
| app.js 语法 | ✅ PASS | 同上 |
| index.html HTTP 200 | ✅ PASS | `curl -I http://localhost:8765/index.html` |
| calendar.js/css 资源加载 | ✅ PASS | HTTP server access log 全部 200 |
| HTML 三处引用到位 | ✅ PASS | `grep -E 'calendar\.js|calendar\.css|calendar-container' index.html` |
| Git merge 痕迹 | ✅ PASS | `aa02593 Merge branch 'feature/calendar' into main` |
| Conventional commit | ✅ PASS | `feat: 月日历组件 + 工作计划增删改` |

## 四、已知局限

1. **同日 3+ 条计划无省略号提示**：当前直接堆叠所有条，可能把日期格子撑满；后续可加 "+N more" 截断（参考经验 1722811 教训）
2. **工作计划与任务管理未联动**：任务的 deadline 字段尚未映射到日历；后续迭代可加"从任务生成计划"快捷入口
3. **编辑弹窗标题未做 HTML 转义**：虽然 `value` 属性用了 `"` 替换，textarea 的换行符可能破坏结构；后续统一用 textContent 替代 innerHTML
4. **无计划排序**：同日多条按创建时间显示，未按 startAt 排序；可在 getPlans 里加 `.sort((a,b)=>a.startAt.localeCompare(b.startAt))`

## 五、集成点一览

```
src/index.html              ← +link calendar.css / +script calendar.js / +calendar-container div
src/js/app.js : initMainApp ← +Calendar.init(calEl) 放在 renderAll 之前
src/js/calendar.js          ← 新建，331 行 IIFE 模块
src/css/calendar.css        ← 新建，223 行含响应式
```

**External 依赖**（全部项目已有，无新增）：
- `Storage` — LocalStorage 读写
- `Utils` — genId、todayStart
- `EventBus` — calendar:changed 事件
