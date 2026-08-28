# NutriFlow

Minimal Daily Nutrition & Weight Tracking

极简每日饮食、体重与营养趋势记录工具。数据只保存在当前浏览器的 `localStorage`，无需服务器、账号或安装。

<img width="1536" height="1024" alt="project-nutriflow" src="https://github.com/user-attachments/assets/fd030c6c-cc89-43b7-9073-93aaf4e1446b" />

## 使用方法

下载 **`NutriFlow.html`** 这一个文件，双击后用浏览器打开即可。

> 请不要下载 `index.html`。该文件包含开发者演示数据，普通用户只需要 `NutriFlow.html`。

## 主要功能

- 记录每日热量、体重、蛋白质和饮水量
- 日历、连续记录和趋势统计
- 7 天、30 天及全部历史图表
- 文本、CSV 和 JSON 数据导入
- CSV 导出、JSON 备份、完整备份（记录 + 目标 + 主题）
- 深色与浅色主题

同一导入批次中如有重复日期，系统会拒绝整批导入并列出重复日期；与已有记录日期相同仍允许覆盖，但预览会明确标注。

## 数据保存与隐私

- 数据默认只存在当前浏览器本地，不上传任何服务器。
- 清除浏览器网站数据、更换浏览器或设备后，记录可能消失。
- 保存失败时会回滚并明确提示，不会把“未保存”显示成“已保存”。
- 如果浏览器无法使用 `localStorage`，页面顶部会显示“只能临时使用”的警告。
- 完整备份恢复是带恢复日志的多键操作；若回滚时存储再次失败，日志会保留并在下次打开时尝试自动恢复旧数据。存在未完成日志时，新的保存操作会被暂停，直到恢复成功，避免日志覆盖用户之后的新修改。

## 备份方法

- **CSV**：`导出 CSV`，可用表格软件打开。
- **JSON**：`导出 JSON`，导出与浏览器存储一致的记录数组，兼容旧版。
- **完整备份**：`导出完整备份`，导出包含记录、目标和主题的 JSON 对象；导入该文件会恢复这三类数据。

恢复方法：点击“导入文件”，选择 `.csv` 或 `.json`。旧版 JSON 数组（仅记录）永远可以导入。

### CSV 格式

NutriFlow 导出的 CSV 表头为：

```text
日期,摄入(kcal),体重(kg),蛋白质(g),饮水(ml)
```

导入时支持带表头/不带表头、LF/CRLF、中文单位以及自由文本日期。

## 浏览器要求

- 现代浏览器即可，无需 Node.js、Python、服务器或扩展。
- 推荐 Chrome / Edge / Firefox / Safari 的最新版本。

## 开发验证

仓库没有构建步骤，也没有 npm 依赖。验证命令：

```bash
node test-reliability.js
node test-parity.js
node check-html-syntax.js
node check-repo-structure.js
```

GitHub Actions 会在 push / PR 时自动运行以上检查。

## 项目架构

- `NutriFlow.html`：正式发布入口，无种子数据。
- `index.html`：开发/演示入口，含种子数据和 PWA 接入。
- `test-reliability.js`：核心逻辑回归测试。
- `test-parity.js`：双 HTML 一致性检查。
- `manifest.json`、`sw.js`：仅服务于 `index.html` 的 PWA 缓存。

## License

当前仓库未声明 License。正式分发前请先选择并添加合适的 License。
