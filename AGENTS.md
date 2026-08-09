# Repository Guidelines

## 项目概览

NutriFlow 是零依赖的中文单页饮食、体重与营养趋势记录工具。应用的 CSS、HTML 和 JavaScript 都内嵌在单个 HTML 文件中，没有打包、构建或模块系统。面向普通用户的入口是 `NutriFlow.html`，可直接双击打开；`index.html` 含开发种子数据，并额外引用 `manifest.json` 和 `sw.js`，不应替代前者的单文件使用方式。

## 项目结构与架构

- `NutriFlow.html`：无种子数据的发布入口；修改生产功能时优先以它为准。
- `index.html`：开发/演示入口，保留与发布版本一致的生产逻辑，仅允许保留种子数据和 PWA 接入等有意差异。
- `test-reliability.js`：Node 内置 `assert` 和 VM 的回归测试，覆盖两份 HTML 的共享逻辑。
- `manifest.json`、`sw.js`：仅服务于 `index.html` 的 PWA 缓存入口。
- `open NutriFlow.cmd`、`打开每日饮食记录.cmd`：分别用系统浏览器打开两个 HTML 入口。

记录和目标保存在浏览器 `localStorage`；不得更改正常数据键名或格式，尤其是 `dailyDietRecordsV1` 与 `dailyDietTargetsV1`。记录写入、覆盖、导入和删除必须维持事务性：持久化失败不得把未保存状态渲染为已保存。导入批次内的重复日期必须拒绝整批；与既有记录同日期的覆盖仍是允许行为。处理损坏记录时保留原始备份策略，避免覆盖可恢复内容。

## 开发与验证

没有 `package.json`、构建、Lint 或格式化工具链。可用命令仅包括：

- `node test-reliability.js`：运行共享逻辑的回归测试。
- `open NutriFlow.cmd`：打开可分发的单文件入口。
- `打开每日饮食记录.cmd`：打开含开发种子数据的 `index.html`。

修改 JS 或数据流后，至少运行 `node test-reliability.js`，检查两个 HTML 的内联脚本语法，并用浏览器验证相关流程。涉及日期、导入、图表或持久化时，同时检查空数据、跨月/跨年、写入失败，以及两个入口的行为一致性。修改完成后运行 `git diff --check`、检查 `git status --short` 和限定范围的 diff；未运行的检查必须如实说明。不要把 `file://` 与静态 HTTP/PWA 的结果混为一谈。

## 代码风格与修改边界

沿用相邻的 2 空格缩进、camelCase 函数/变量、UPPER_SNAKE_CASE 存储键常量和中文界面文案。保持单文件结构的顺序：内联样式、页面标记、内联脚本。除非改动仅属于 `index.html` 的种子/PWA 差异，否则同步两份 HTML；不要引入框架、依赖、后端或无关重构。用户输入和导入内容进入 DOM 时避免不安全的 `innerHTML` 拼接。

## 提交与安全

近期提交有简短英文祈使式和中文说明，未形成单一语言规范；使用单一目的、清晰的提交标题，并在 PR 说明复现方式、行为变化和验证结果。UI 改动按需附截图；数据可靠性修复应说明兼容性与回滚/恢复行为。

不提交真实环境变量、密钥、浏览器数据、缓存、日志或临时文件，也不在文档、回复或提交信息中暴露 secrets。修改生产配置、权限、数据完整性、签名或计费相关内容前，先说明风险并取得明确授权。

## Agent 工作规则

## Personal Knowledge Context

The user's shared long-term AI context lives at `D:\xia zai\AI project\Knowledge`.

For substantial work, read `Knowledge\AGENTS.md`, locate this project in `Knowledge\01-Projects\Repository-Index.md`, then read this project's Project Page and `AI-HANDOFF.md`. Read `CONTEXT-HISTORY.md` only when historical decisions, rejected directions, architecture rationale, prior user instructions, or redesign context matters. This repository's current files and Git state are the source of truth when they conflict with Knowledge. Follow Minimum Necessary Context; do not load the entire Vault by default.

When the user explicitly says the project/task is ready to “收工” or gives an equivalent finalization instruction, read and follow `D:\xia zai\AI project\Knowledge\02-AI\Prompts\项目收工提示词.md`. This trigger does not expand current task permissions; do not merge, deploy, force-push, resolve remote conflicts, or modify unrelated files unless separately authorized.

修改前阅读相关实现并给出简短计划；优先小范围、可审查、可回退的改动，不顺手改变业务规则、默认值或兼容行为。保留用户已有未提交修改，禁止擅自安装依赖、全仓格式化、自动修复、提交、推送、部署、发布、创建 Release 或数据库操作。提交前确认变更仅覆盖当前任务、无 secrets/调试产物、必要验证已完成且未运行项已说明；commit 与 push 必须先获明确授权。
