# PriceWise - Amazon Price Tracker Chrome Extension

## 项目概述
透明、不劫持联盟链接的亚马逊价格追踪 Chrome 扩展。
差异化定位：Keepa 的隐私问题 + Honey 的联盟劫持丑闻 = 我们的机会。

## 技术栈
- Chrome Extension MV3（纯 JavaScript，无构建工具）
- Chart.js（价格历史图表）
- Shadow DOM（CSS 隔离）
- chrome.storage.local（本地数据存储）
- chrome.alarms（降价提醒轮询）

## 项目结构
```
pricewise/
├── manifest.json          # MV3 配置
├── background/
│   └── service-worker.js  # 后台逻辑（alarms, notifications）
├── content/
│   ├── chart-panel.js     # 价格图表面板组件（Shadow DOM）
│   └── amazon-product.js  # 商品页主控制脚本
├── popup/
│   ├── popup.html         # 弹窗 HTML
│   ├── popup.css          # 弹窗样式
│   └── popup.js           # 弹窗逻辑
├── utils/
│   ├── constants.js       # 常量
│   ├── price-parser.js    # 亚马逊 DOM 价格提取
│   └── storage.js         # chrome.storage 封装
├── lib/
│   └── chart.umd.min.js   # Chart.js UMD
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 数据模型
- 价格历史存储在 `chrome.storage.local`，key 格式：`pw_history_{ASIN}`
- 每个商品最多保存 730 条价格记录（约 2 年）
- 降价提醒存储在 `pw_alerts` key 中

## 开发和调试
```bash
# 加载扩展
1. Chrome → chrome://extensions/
2. 打开"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 pricewise/ 目录

# 修改后刷新
- 修改 service-worker.js → 需要在 extensions 页面点击刷新
- 修改 content script → 刷新亚马逊页面即可
- 修改 popup → 关闭再打开 popup 即可
```

## 核心原则
- **零数据收集**：所有数据存储在用户本地浏览器
- **不劫持联盟链接**：绝不修改/覆盖任何联盟链接
- **最小权限**：只请求必要的 host_permissions
- **透明**：用户可以看到所有存储的数据

## 变现计划
- Phase 1: 免费发布，积累用户和评价
- Phase 2: Freemium（免费基础版 + Pro 高级功能）
- Phase 3: 接入 Keepa API 提供完整历史数据
