# Pixel Ledger 像素记账系统

一个可直接运行的像素风记账系统原型，界面采用像素卡片、清晰中文字体和响应式布局，适合后续升级为微信小程序、安卓 App、iOS App。

## 已实现功能

- 多账本：个人账本、家庭账本、旅行账本，可新增账本并切换。
- 快速记账：支出、收入、账户转账三种类型。
- 流水管理：按月份、类型、关键词检索；支持编辑、删除。
- 分类和标签：预置常用支出/收入分类，流水可添加多个标签。
- 预算管理：月度总预算、分类预算、预算进度条。
- 存钱计划：目标金额、已存金额、截止日期。
- 账户资产：现金、银行卡、信用卡、支付宝、微信、投资账户、负债账户。
- 自动余额：账户余额由“初始余额 + 流水”动态计算，避免多端同步误差。
- 分析报表：月度趋势、分类支出排行、大额支出 Top 5、预算风险提示。
- 提醒中心：记账提醒、预算提醒等本地配置。
- 定时记账：每月固定收入/支出规则，可一键生成本月流水。
- 数据导入导出：JSON 完整备份、CSV 流水导出。
- 本地存储：使用 localStorage，便于演示与后续迁移。

## 运行方法

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址即可。

## 构建发布

```bash
npm run build
npm run preview
```

## iOS / iPadOS 封装

项目已接入 Capacitor，完整 Xcode 环境下可打开 `ios/App/App.xcworkspace` 打包：

```bash
npm run ios:open
```

真机 `.ipa` 需要完整 Xcode、Apple Developer 签名证书和 provisioning profile。详细步骤见 `IOS_INSTALL.md`。

## 推荐升级路线

### 1. 小程序

- 页面层：迁移到微信小程序原生组件或 uni-app。
- 数据层：将当前 localStorage 替换为云开发数据库。
- 能力层：接入订阅消息、拍照 OCR、小票识别、语音输入。

### 2. 安卓 / iOS App

- 技术路线：React Native 或 Flutter。
- 账号体系：手机号/微信/Apple 登录。
- 同步：服务端 API + 本地缓存 + 冲突解决。
- 安全：本地加密、隐私模式、Face ID / 指纹解锁。

### 3. 后端表设计建议

- users：用户表。
- books：账本表。
- accounts：账户表。
- records：流水表。
- categories：分类表。
- budgets：预算表。
- goals：存钱目标表。
- reminders：提醒表。
- recurring_rules：定时记账规则表。
- audit_logs：操作日志表，用于恢复误删数据。

## 目录结构

```text
pixel-ledger-system/
├── index.html
├── package.json
├── README.md
└── src/
    ├── main.jsx
    └── styles.css
```

## 注意事项

当前版本是前端原型，适合确认产品功能、视觉风格和交互流程；若要正式上线，需要增加登录、服务端存储、数据加密、权限控制、异常恢复和真机推送。
