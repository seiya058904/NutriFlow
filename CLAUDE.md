# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

纯前端单页应用，零依赖、零构建步骤。用户直接在浏览器中打开 HTML 文件即可使用。UI 语言为中文 (zh-CN)，应用名"每日饮食记录"。品牌名 NutriFlow。

## Running

双击 `.cmd` 文件或直接在浏览器中打开 HTML：
- `index.html` — 含种子数据（85 条历史记录，2026-02-12 至 2026-05-08），通过 `打开每日饮食记录.cmd` 启动
- `NutriFlow.html` — 不含种子数据的版本，通过 `open NutriFlow.cmd` 启动

无构建、无测试、无 lint 工具链。

## Architecture

整个项目为 4 个文件的扁平目录，无子文件夹：

| 文件 | 说明 |
|---|---|
| `index.html` (~2500 行) | 主版本，含 CSS、SVG 图表、JS 逻辑，内嵌种子数据 |
| `NutriFlow.html` (~2400 行) | 简化版本，仅少了种子数据相关代码 |
| `打开每日饮食记录.cmd` | Windows 批处理，启动 index.html |
| `open NutriFlow.cmd` | Windows 批处理，启动 NutriFlow.html |

两个 HTML 文件结构一致：`<style>` CSS → `<body>` HTML → `<script>` JS。CSS 和 JS 全部内联，无模块系统，不引用任何外部资源。

### CSS 自定义属性 (`:root`)

主要颜色：
- `--blue` / `--blue-deep` — 主色调（按钮、高亮）
- `--green` — 体重相关
- `--orange` — 蛋白质相关
- `--red` — 错误/不足提示
- `--bg` / `--panel` — 背景色（毛玻璃效果）
- `--text` / `--muted` / `--soft` — 文字层级
- `--line` — 分割线
- `--radius` (24px) — 默认圆角
- `--shadow` / `--shadow-soft` — 阴影
- `--violet` / `--glass` — 已定义但未使用

### 数据流

初始化顺序：`loadTargets()` → `loadRecords()` → `importInitialRecords()`（仅 index.html）→ `fillForm(today)` → `render()`

### localStorage 存储

- `dailyDietRecordsV1` — 记录数组（每日热量/体重/蛋白质）
- `dailyDietTargetsV1` — 用户目标 `{intake, protein}`
- `dailyDietSeed20260212To20260508` — 种子数据一次性导入标记（仅 index.html）

### 响应式断点

CSS 使用 3 个断点：880px、620px、390px。

### HTML 容器结构

```
.app > .topbar
  ├── #todayText (今日日期)
  └── #todaySummary (当日摘要卡片)

.app > .grid > .stack (左栏)
  ├── #recordForm — 记录表单
  │   ├── #dateInput / #intakeInput / #weightInput / #proteinInput
  │   └── #targetIntakeInput / #targetProteinInput — 目标设置
  ├── #importText — 批量导入
  └── #calendar — 月历 + #reviewBox 选中日回顾

.app > .grid > .stack (右栏)
  ├── #stats — 统计卡片
  ├── #charts — SVG 图表
  └── #records — 记录列表

.diet-pet (右下角浮动)
  ├── #petButton — 狐狸按钮
  └── #petSpeech — 语录气泡
```

### SVG 图表

- viewBox: `0 0 760 250`
- 核心函数: `makeCompactChart(records, values, averageValues, color, averageColor, unit)`
- 热量图表含 7 日移动平均线 (`movingAverage(values, 7)`)
- hover 交互由 `makeHoverPoints` 生成

## JS 函数速查

共 52 个函数（NutriFlow.html 为 51 个，缺少 `importInitialRecords`）。

**数据持久化：** `loadRecords` / `saveRecords` / `loadTargets` / `saveTargets`

**日期/数字工具：** `toDateString` / `formatDateText` / `readNumber` / `setMessage` / `roundValue` / `formatSignedValue` / `daysBetween` / `isValidDate` / `normalizeDate`

**表单：** `recordFromInputs` / `fillForm` / `clearFormForDate` / `clearImportPreview`

**渲染（`render()` 为总入口）：** `renderTodaySummary` / `renderStats` / `renderCharts` / `renderCalendar` / `renderReview` / `renderTargetProgress` / `renderRecords`

**统计：** `statCard` / `valueOrEmpty` / `targetNoteForToday` / `averageFilledValue` / `averageWeeklyWeightChange` / `consecutiveRecordDays` / `recordHabitReview` / `latestWeightValue` / `weightTrendReview`

**目标系统：** `targetStatusForRecord` / `targetChecksForRecord` / `targetDotsForRecord` / `metricTargetStatus`

**SVG 图表：** `makeIntakeOverview` / `compactMetricCard` / **`makeCompactChart`**（核心，生成 760x250 SVG）/ `makeHoverPoints` / `makePath` / `makeDateLabels` / `movingAverage` / `chartMinimumGap`

**批量导入：** `isImportHeaderLine` / `findDateInImportLine` / `readImportNumbers` / `parseImportLine` / `parseImportRows` / `renderImportPreview`

**宠物吉祥物：** `showPetSpeech`

**种子数据（仅 index.html）：** `importInitialRecords`

## Modifying This Codebase

所有逻辑都在单个 HTML 文件内，编辑时需注意 CSS、HTML、JS 三部分的对应关系。两个 HTML 文件功能一致，修改时通常需要同步更新两个文件（除非改动仅涉及种子数据）。

### 按功能找代码

- **改图表** → `makeCompactChart`（核心 SVG 生成）、`makeIntakeOverview`（热量总览卡片）
- **改日期解析** → `normalizeDate`（单条记录）、`findDateInImportLine`（批量导入）
- **改月历** → `renderCalendar` + `targetDotsForRecord`
- **改统计** → `renderStats`、`averageWeeklyWeightChange`、`consecutiveRecordDays`
- **改目标判定** → `metricTargetStatus`、`targetStatusForRecord`
- **改宠物语录** → `showPetSpeech` 函数内的数组
