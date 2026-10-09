# NutriFlow

**Keep track. See the trend. Own your data.**

极简每日饮食、体重与营养趋势追踪。打开浏览器即可使用，无账号、无服务器、无安装流程。

**[▶ Open online](https://seiya058904.github.io/NutriFlow/)** · [Use the offline HTML](NutriFlow.html) · [Backups & privacy](#your-data-and-backups) · [Developer checks](#development-and-checks)

<img width="700" alt="NutriFlow project artwork" src="https://github.com/user-attachments/assets/fd030c6c-cc89-43b7-9073-93aaf4e1446b" />


## Track the essentials · 每日记录

| 每天记录 | 观察变化 | 管理数据 |
| --- | --- | --- |
| 热量、蛋白质、饮水、体重 | 日历、连续记录和 7 天 / 30 天 / 全历史曲线 | CSV、JSON 与完整备份（记录、目标、主题） |

- 🌗 浅色与深色主题，适合日常快速查看。
- 📥 支持文本、CSV 与 JSON 导入，以及带预览的同日期覆盖。
- 🛡️ 同一导入批次若出现重复日期会拒绝整批导入，避免静默数据丢失。
- 🔄 在浏览器支持的条件下，同一来源多个窗口会同步状态；保存失败时不会伪装为成功。

## Start in your browser · 两种入口

| Online / 在线 | Offline / 离线 |
| --- | --- |
| 打开 [GitHub Pages](https://seiya058904.github.io/NutriFlow/) 即可开始 | 下载仓库根目录的 [`NutriFlow.html`](NutriFlow.html)，双击在浏览器打开 |
| GitHub Actions 发布正式无种子数据版本 | 单文件，不需要 Node、后端或网络 |

> [!IMPORTANT]
> [`NutriFlow.html`](NutriFlow.html) 才是正式、无种子数据的发行入口。[`index.html`](index.html) 含开发演示数据与 PWA 接入，不要用它代替正式离线版。

## Your data and backups

数据默认保存在**当前浏览器来源**的 `localStorage`，不会自动上传到服务器。在线站点与本地 `file://` 的存储空间彼此独立，不会自动同步；跨入口迁移应先导出**完整备份**，再在另一端导入。

| Backup | Content |
| --- | --- |
| **CSV** | 每日记录，便于在表格软件中查看 |
| **JSON** | 每日记录数组，兼容旧版格式 |
| **Full backup** | 记录 + 目标 + 主题，适合迁移与完整恢复 |

CSV 的标准字段为 `日期,摄入(kcal),体重(kg),蛋白质(g),饮水(ml)`。清除站点数据、更换设备或浏览器可能导致数据消失。**建议在更换浏览器或重置设备前导出完整备份。**

存储不可用时会出现临时使用警告。完整备份恢复包含失败回滚与恢复日志保护；发生未完成的恢复时会暂停新的持久化写入，避免损坏现有内容。

## Development and checks

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
