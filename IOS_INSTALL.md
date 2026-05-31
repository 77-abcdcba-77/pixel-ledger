# Pixel Ledger iOS / iPadOS 打包说明

本项目已经接入 Capacitor，可把现有 React 记账系统封装为 iPhone/iPad App。业务功能仍使用同一套前端代码和同一套本地数据结构。

## 当前产物

- `dist/`：生产版 Web 资源，已使用相对路径，适合放进 iOS WebView。
- `ios/App/App.xcworkspace`：Capacitor 生成的 iOS/iPadOS 工程。
- `ios/App/App/public/`：已复制进原生工程的前端资源。
- `ios/App/App/Assets.xcassets/`：已替换为 Pixel Ledger 图标和启动图。
- `build/PixelLedger-unsigned.ipa`：已生成的未签名 IPA，仅用于证明归档和打包流程成功；标准 iPhone/iPad 不能安装未签名 IPA。

## 真机安装包要求

要生成可安装到 iPhone/iPad 的 `.ipa`，本机必须具备：

- 完整 Xcode，而不是仅 Command Line Tools。
- Apple Developer 账号或可用的签名证书与 provisioning profile。
- CocoaPods。

当前这台机器已经安装 Xcode 和 CocoaPods，iOS 归档也能成功生成；但系统里没有可用代码签名身份，Xcode 也没有登录 Apple Developer 账号，所以还不能产出真机可安装的签名 IPA。

本机检测结果：

- `security find-identity -v -p codesigning`：`0 valid identities found`
- `~/Library/MobileDevice/Provisioning Profiles`：`0` 个 profile
- Xcode 账号列表为空

## 在完整 Xcode 环境打包

```bash
npm install
npm run ios:open
```

打开 Xcode 后：

1. 选择 `App` target。
2. 在 `Signing & Capabilities` 里选择你的 Apple Developer Team。
3. 保持 Bundle Identifier 为 `com.mruni.pixelledger`，后续升级不要随意修改，否则 App 沙盒数据会被视为新应用。
4. 选择真机或 `Any iOS Device`。
5. 通过 `Product > Archive` 生成归档，再用 `Distribute App` 导出 `.ipa`。

如果已经在 Xcode 登录 Apple Developer 账号，并且知道 Team ID，也可以直接运行：

```bash
npm run ios:ipa -- TEAM_ID
```

导出的签名安装包会出现在 `build/ipa/`。如果使用免费 Apple ID，通常只能通过 Xcode 直接安装到自己的设备；要稳定导出可分发的 IPA，一般需要 Apple Developer Program 账号以及匹配的设备/profile。

## 数据保留

- 同一个 Bundle Identifier 的 App 升级安装时，WebView 本地存储会保留。
- 旧浏览器里的 `localStorage` 不能被 iPhone 安装包自动读取，因为浏览器和 App 是不同沙盒。
- 从浏览器迁移到 App 时，在旧版本 `设置 > 导出 JSON`，安装 App 后登录同名账号，再用 `设置 > 导入 JSON` 恢复。

## Apple Watch 说明

Apple Watch 不能直接运行这套 React/Capacitor WebView。要做 watchOS 版本，需要单独开发 SwiftUI Watch App，并通过 App Groups、WatchConnectivity 或云同步读取同一份账本数据。iPhone/iPad 端当前已保留全部现有功能；watchOS 端不能无损复用这套页面。
