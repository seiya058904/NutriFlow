# NutriFlow

Minimal Daily Nutrition & Weight Tracking

极简每日饮食、体重与营养趋势记录工具。

<img width="1536" height="1024" alt="project-nutriflow" src="https://github.com/user-attachments/assets/fd030c6c-cc89-43b7-9073-93aaf4e1446b" />

## 使用方法

下载 **`NutriFlow.html`** 这一个文件，双击后使用浏览器打开。

> 请不要下载 `index.html`。该文件包含开发者测试数据，普通用户只需要 `NutriFlow.html`。

## 主要功能

- 记录每日热量、体重、蛋白质和饮水量
- 日历、连续记录和趋势统计
- 7 天、30 天及全部历史图表
- 文本、CSV 和 JSON 数据导入
- CSV 数据导出
- 深色与浅色主题

同一导入批次中如有重复日期，系统会拒绝整批导入并列出重复日期；与已有记录日期相同仍允许覆盖。

## 数据保存

数据保存在当前浏览器的 `localStorage` 中，无需服务器，正常刷新或重新打开页面后仍会保留。

保存失败时，新增、覆盖、导入和删除操作会自动回滚，避免页面显示尚未保存的数据。

检测到损坏或部分无效的旧记录时，原始内容会在首次覆盖前备份到：

`dailyDietRecordsV1CorruptBackupV1`

> `localStorage` 不是云端备份。清理浏览器网站数据、更换浏览器或更换设备后，记录可能无法继续使用。建议定期导出 CSV 备份。
