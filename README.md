# YouTube 弹幕翻译器

轻量级 Chrome/Edge 浏览器扩展，使用免费翻译 API 实时翻译 YouTube 弹幕（直播聊天 / 聊天回放）。

## 功能特性

- **实时弹幕翻译** — 自动检测并翻译 YouTube 聊天消息
- **双语内嵌显示** — 翻译结果直接显示在原弹幕文字下方
- **多个免费翻译 API** — 支持 Google 翻译、MyMemory、LibreTranslate，自动故障切换
- **悬浮输入面板** — 可拖拽的悬浮窗，输入你的弹幕并在发送前翻译成目标语言
- **一键发送** — 将翻译后的文字直接发送到 YouTube 聊天
- **高度可定制** — 可选择目标语言、翻译 API、显示模式（内嵌/悬停/替换）和字体大小

## 安装方法

1. 下载或克隆此仓库
2. 打开 Chrome/Edge 浏览器，进入 `chrome://extensions`
3. 打开右上角的 **开发者模式**
4. 点击 **加载未打包的扩展程序**，选择项目文件夹
5. 打开一个有直播聊天或聊天回放的 YouTube 视频，翻译会自动生效

## 使用说明

### 弹幕翻译

打开含有聊天回放或直播的 YouTube 视频后，扩展会自动在聊天 iframe 中运行。每条弹幕消息下方都会显示黄色的翻译文字。

**触发生效的场景：**
- 直播视频的实时聊天（Live Chat）
- 视频回放中的聊天回放（Chat Replay）


### 悬浮输入面板

页面右下角会显示一个深色的悬浮窗，你可以：

1. **输入弹幕** — 在文本框中输入你想发送的内容
2. **选择目标语言** — 在下拉菜单中选择要翻译成的语言（默认：简体中文）
3. **翻译** — 点击 **Translate** 按钮或按 `Ctrl + Enter` 进行翻译
4. **发送到聊天** — 翻译完成后，点击 **Send to Chat** 按钮，翻译内容会自动填入 YouTube 聊天输入框并发送

**面板操作：**
- **拖拽** — 按住面板标题栏拖动到任意位置
- **最小化** — 点击 `_` 按钮收起面板，点击右下角 `DT` 按钮恢复
- **关闭** — 点击 `X` 按钮隐藏面板

### 扩展设置

点击浏览器工具栏的扩展图标，打开设置弹窗：

| 设置项 | 说明 | 默认值 |
|---|---|---|
| **启用翻译** | 开关弹幕翻译功能 | 开启 |
| **翻译 API** | Google 翻译 / MyMemory / LibreTranslate | Google 翻译 |
| **目标语言** | 弹幕和用户输入翻译的目标语言 | 简体中文 |
| **显示模式** | 内嵌（原文下方）/ 悬停提示 / 替换原文 | 内嵌 |
| **字体大小** | 翻译文字大小（8–18px） | 11px |

设置会实时同步到所有已打开的 YouTube 页面，无需刷新。

## 支持的语言

简体中文（默认）、繁体中文、English、日本語、한국어、Español、Français、Deutsch、Português、Русский、العربية、हिन्दी、ไทย、Tiếng Việt、Bahasa Indonesia、Türkçe、Italiano、Nederlands、Polski、Українська

## 翻译 API 说明

| API | 优点 | 限制 |
|---|---|---|
| **Google 翻译** | 质量高、速度快、支持语言多 | 免费端点可能有频率限制 |
| **MyMemory** | 无需 API Key、稳定 | 单次最多 500 字符、有每日配额 |
| **LibreTranslate** | 开源、注重隐私 | 公共实例可能不稳定 |

当一个 API 失败时，扩展会自动尝试下一个可用 API。

## 技术栈

- 纯原生 JavaScript，零外部依赖
- Chrome Extension Manifest V3
- 双 Content Script 架构（聊天 iframe + 主页面）
- MutationObserver 实时消息检测
- 内存翻译缓存 + 请求限流

## 项目结构

```
├── manifest.json                 # 扩展入口配置
├── background/
│   └── service-worker.js         # 消息路由 + 翻译代理
├── content/
│   ├── chat-inject.js            # 弹幕翻译脚本（注入聊天 iframe）
│   └── main-inject.js            # 悬浮面板脚本（注入主页面）
├── popup/
│   ├── popup.html / js / css     # 扩展设置弹窗
├── lib/
│   ├── translator.js             # 3 个翻译 API + 缓存 + 故障切换
│   └── utils.js                  # 语言列表 + 工具函数
├── styles/
│   └── danmaku.css               # 翻译样式 + 面板样式
└── icons/
    ├── icon16.png / icon48.png / icon128.png
```

## 常见问题

**Q: 翻译没有显示？**
- 确保扩展已在 `chrome://extensions` 中启用
- 确认视频有直播聊天或聊天回放功能
- 检查设置弹窗中"启用翻译"是否开启
- 刷新 YouTube 页面后重试

**Q: 翻译质量不好？**
- 尝试在设置中切换不同的翻译 API
- Google 翻译通常质量最高

**Q: 悬浮面板不见了？**
- 点击右下角的 `DT` 按钮恢复面板
- 如果 `DT` 按钮也不在，刷新页面即可

## License

MIT
