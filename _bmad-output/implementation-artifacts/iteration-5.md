# Iteration 5 — 日间 / 夜间模式主题切换

**日期**: 2026-10-26
**分支**: `feature/theme-toggle` → merge (pending)
**需求来源**: 用户 "添加一个修改页面，日间和夜间模式的"

---

## 一、改动说明

本轮新增全站日间/夜间主题切换能力，遵循"单一状态源 + CSS 变量覆写 + 防闪烁"三板斧：

| 文件 | 动作 | 内容 |
|------|------|------|
| `src/js/theme.js` | **新建** | Theme.init/toggle/setTheme/getCurrent，读写 localStorage `ff_theme`，系统偏好 `matchMedia` 兜底 |
| `src/css/style.css` | **修改** | ① :root 新增 11 个语义色变量（--color-bg-primary-soft / --color-bg-success-soft / --color-modal-mask ...） ② 底部新增 `:root[data-theme="dark"]` 覆写块 ③ 所有硬编码 `#FFF5F4 / #F0FFF0 / rgba(0,0,0,0.4) / linear-gradient` 替换为变量引用 ④ 新增 `.theme-toggle` 按钮样式 ⑤ `.auth-card` 加 `position:relative` 支撑角标按钮 |
| `src/css/calendar.css` | **修改** | 所有硬编码色（#F6F6F6 / #FFF9F8 / #FFF5F4 / rgba outline）替换为 var(--color-*) |
| `src/index.html` | **修改** | ① `<head>` 内联防闪烁脚本：读 localStorage → 写 `data-theme`（在 CSS 加载前执行） ② 登录页新增 `#btn-theme-auth` 角标按钮 ③ 主应用 header 新增 `#btn-theme-main` 按钮 ④ 引入 theme.js（在 calendar.js 之前） |
| `src/js/app.js` | **修改** | boot() 里 Theme.init + updateThemeButtons；新增 toggleTheme/updateThemeButtons 辅助函数；bindAuthEvents 绑登录页按钮；bindMainDomEvents 绑主应用按钮 |

## 二、技术决策

### 2.1 状态源：`document.documentElement.dataset.theme`
- 唯一状态源，读写 `html[data-theme="dark"]` 触发 CSS 选择器匹配
- 比 `body.classList.toggle` 更干净，根节点覆写范围最全
- **教训**（经验 1919363）：状态源分裂会导致某些组件不跟随变化

### 2.2 防闪烁内联脚本（在 `<head>` 里、CSS link 前）
```html
<script>
  try {
    var t = localStorage.getItem('ff_theme');
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (!t && matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch(e) {}
</script>
```
- 浏览器解析 head 时**同步**执行，写 `data-theme` 在 CSS 下载 + 应用之前完成 → 首屏无闪白/闪黑
- try/catch 防隐私模式下 localStorage 抛异常阻断渲染
- **教训**（经验 1992384）：这个脚本必须在所有外部资源之前

### 2.3 硬编码色 → 语义变量映射
| 原硬编码 | 新变量 | 昼值 | 夜值 |
|---------|--------|------|------|
| `#FFF5F4`（选中/番茄badge） | `--color-bg-primary-soft` | `#FFF5F4` | `rgba(232,107,92,0.22)` |
| `#F0FFF0`（休息badge） | `--color-bg-success-soft` | `#F0FFF0` | `rgba(92,184,92,0.18)` |
| `#FFECEC`（错误提示） | `--color-bg-danger-soft` | `#FFECEC` | `rgba(217,83,79,0.22)` |
| `#F6F6F6`（日历他月） | `--color-bg-other-month` | `#F6F6F6` | `#16162a` |
| `#FFF9F8`（日历周末） | `--color-bg-weekend` | `#FFF9F8` | `#1a1a30` |
| `rgba(0,0,0,0.4)`（遮罩） | `--color-modal-mask` | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.65)` |
| `linear-gradient`（登录页） | `--color-auth-gradient-start/end` | 橙+绿淡 | 深蓝渐变 |

**不改动**：按钮彩色背景上的 `#fff` 白字（昼夜通用）、品牌色 `#E86B5C` 番茄红（保持产品识别色）。

### 2.4 变量覆写顺序
- 品牌色（primary/success/warning/danger/high/medium/low）昼夜共用，只写在 `:root`
- 底色/文本/边框/阴影全部在 `:root[data-theme="dark"]` 覆写
- 阴影在夜间加深（`0 1px 2px rgba(0,0,0,0.35)`），让卡片在深底仍有层次感

## 三、构建 / 验证结果

| 检查项 | 结果 |
|--------|------|
| theme.js 语法 | ✅ PASS `new Function(fs.readFileSync)` |
| app.js 语法 | ✅ PASS |
| style.css 硬编码数 | ✅ 全部抽出到变量（42 处 grep 仅剩变量定义 + `#fff` 白字） |
| calendar.css 硬编码数 | ✅ 剩余仅 `.cal-add color:#fff`（彩色按钮上的白字，合法） |
| HTTP index.html 200 | ✅ len=8930 |
| theme.js 200 | ✅ len=2092 |
| 关键 DOM 元素存在 | ✅ `ff_theme` / `data-theme` / `btn-theme-main` / `theme.js` / `calendar-container` 全部 True |

## 四、已知局限

1. **`<input type="time">` / `<select>` 下拉箭头**：原生控件样式由浏览器控制，夜间模式下下拉面板可能仍是浅色底（Webkit 系更明显）；可通过 `appearance:none` + 自定义控件解决，但当前体量暂不动
2. **Emoji 按钮兼容性**：极老浏览器可能不识别 🌙☀️；可回退为文本 icon（"🌙" → "夜"），暂保持 emoji 体验
3. **系统偏好监听**：theme.js 初始化时读了一次 `prefers-color-scheme`，但没注册 `addEventListener('change', ...)`；如果用户在 OS 里手动切换主题、且没有显式点过按钮，页面不会跟随 OS 变化。可加一行 `matchMedia(...).addEventListener('change', () => { if (Theme.getCurrent() === Theme.systemValue) apply(...) })`

## 五、集成点一览

```
src/index.html : 防闪烁脚本 + btn-theme-auth (登录页) + btn-theme-main (主应用) + theme.js 引入
src/js/theme.js: 新建 Theme.init/toggle/setTheme/getCurrent，事件总线 emit theme:changed
src/js/app.js  : boot() → Theme.init → updateThemeButtons；toggleTheme / updateThemeButtons
src/css/style.css : 11 个新语义变量 + [data-theme=dark] 覆写块 + .theme-toggle 按钮样式
src/css/calendar.css : 7 处硬编码替换为 var(--color-*)
```

**External 依赖**：EventBus（emit theme:changed）、localStorage（持久化）、matchMedia（系统偏好兜底）。
