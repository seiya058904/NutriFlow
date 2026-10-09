<div align="center">

# NutriFlow

**Keep track. See the trend. Own your data.**

极简每日饮食、体重与营养趋势追踪。打开浏览器即可使用，无账号、无服务器、无安装流程。

[**Open web app ↗**](https://seiya058904.github.io/NutriFlow/) · [**Download offline HTML**](NutriFlow.html) · [Data & privacy](#privacy)

![Offline-capable](https://img.shields.io/badge/use-browser%20%2F%20offline-3c9c77?style=flat-square) ![Storage](https://img.shields.io/badge/storage-localStorage-64748b?style=flat-square)

<img width="700" alt="NutriFlow project artwork" src="https://github.com/user-attachments/assets/fd030c6c-cc89-43b7-9073-93aaf4e1446b" />

</div>

## ✨ Everyday tracking / 每天只记录重要的事

| Record | Explore | Keep |
| --- | --- | --- |
| 热量、蛋白质、饮水、体重 | 日历、连续记录、7 天 / 30 天 / 全历史趋势 | CSV 导出、JSON 导入导出、完整备份 |

- 🌗 浅色与深色主题，适合日常快速查看。
- 📥 支持文本、CSV 与 JSON 导入，以及带预览的同日期覆盖。
- 🛡️ 同一导入批次若出现重复日期会拒绝整批导入，避免静默数据丢失。
- 🔄 在浏览器支持的条件下，同一来源多个窗口会同步状态；保存失败时不会伪装为成功。

## 🚀 Choose how to use it / 选择使用方式

| Online / 在线 | Offline / 离线 |
| --- | --- |
| 打开 [GitHub Pages](https://seiya058904.github.io/NutriFlow/) 即可开始 | 下载仓库根目录的 [`NutriFlow.html`](NutriFlow.html)，双击在浏览器打开 |
| GitHub Actions 发布正式无种子数据版本 | 单文件，不需要 Node、后端或网络 |

> **重要：** [`index.html`](index.html) 是带开发种子数据及 PWA 接入的演示入口，**不是**正式离线发行文件。请使用 `NutriFlow.html`。

## Privacy

数据默认保存在**当前浏览器来源**的 `localStorage`，不会自动上传到服务器。在线站点与本地 `file://` 的存储空间彼此独立，不会自动同步；跨入口迁移应先导出**完整备份**，再在另一端导入。

| Backup | Content |
| --- | --- |
| **CSV** | 每日记录，便于在表格软件中查看 |
| **JSON** | 每日记录数组，兼容旧版格式 |
| **Full backup** | 记录 + 目标 + 主题，适合迁移与完整恢复 |

CSV 的标准字段为 `日期,摄入(kcal),体重(kg),蛋白质(g),饮水(ml)`。清除站点数据、更换设备或浏览器可能导致数据消失，建议定期导出备份。

存储不可用时会出现临时使用警告。完整备份恢复包含失败回滚与恢复日志保护；发生未完成的恢复时会暂停新的持久化写入，避免损坏现有内容。

## 🛠️ Development / 开发

纯 HTML/CSS/JS，无 npm 依赖或打包步骤。项目提供两份产品逻辑需要保持一致的 HTML，以及针对可靠性、语法、入口结构的 Node 验证。

```bash
node test-reliability.js
node test-parity.js
node check-html-syntax.js
node check-repo-structure.js
```

| Path | Purpose |
| --- | --- |
| [`NutriFlow.html`](NutriFlow.html) | 正式发行入口，无种子数据 |
| [`index.html`](index.html) | 开发/演示入口，PWA 接入 |
| [`test-parity.js`](test-parity.js) | 两份 HTML 的核心逻辑一致性 |
| [`manifest.json`](manifest.json), [`sw.js`](sw.js) | 演示入口的 PWA 资源 |

## License

仓库当前**未声明开源许可证**；公开可查看代码不等于授予任意复制、修改或再分发权利。
