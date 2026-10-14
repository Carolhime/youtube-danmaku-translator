# YouTube 弹幕翻译器

轻量级 Chrome/Edge 浏览器扩展，使用免费翻译 API 实时翻译 YouTube 弹幕（直播聊天 / 聊天回放）。

## 功能特性

- **实时弹幕翻译** — 自动检测并翻译 YouTube 聊天消息
- **双语内嵌显示** — 翻译结果以紫色文字直接显示在原弹幕下方
- **Index-Translate 免费 API** — 默认接入 B站开源 [Index-Translate](https://github.com/bilibili/Index-Translate) 免费公网 API
- **多个免费翻译 API** — 同时支持 Google 翻译、MyMemory、LibreTranslate，自动故障切换
- **悬浮输入面板** — 可拖拽的悬浮窗，输入弹幕并翻译后一键复制到剪贴板
- **一键复制** — 翻译完成后点击 Copy 即可复制翻译结果

- **高度可定制** — 可选择目标语言、翻译 API、显示模式（内嵌/悬停/替换）和字体大小

## 安装方法

1. 下载或克隆此仓库
2. 打开 Chrome/Edge 浏览器，进入 `chrome://extensions`
3. 打开右上角的 **开发者模式**
4. 点击 **加载未打包的扩展程序**，选择项目文件夹
5. 打开一个有直播聊天或聊天回放的 YouTube 视频，翻译会自动生效

## 使用说明

### 弹幕翻译

打开含有聊天回放或直播的 YouTube 视频后，扩展会自动在聊天 iframe 中运行。每条弹幕消息下方都会显示紫色的翻译文字。

**触发生效的场景：**
- 直播视频的实时聊天（Live Chat）
- 视频回放中的聊天回放（Chat Replay）


### Index-Translate 免费 API

扩展默认使用 B站开源的 [Index-Translate](https://github.com/bilibili/Index-Translate) 免费公网 API（模型 `Index-Translate-35B-A3B`），**无需 API Key、无需 GPU**。

在设置弹窗的 **Translation API** 里可以选两种接法：

| 选项 | 说明 | 需要额外准备 |
|---|---|---|
| **Index-Translate (Free, direct)** | 由页面直接请求 `https://index-translate.bilibili.com/v1` | 无，装好扩展即可 |
| **Index-Translate (Local proxy)** | 请求本地网桥 `http://127.0.0.1:8080/v1` | 需要先在本地启动网桥 |

> **为什么不在扩展后台（service worker）里直连公网网关？**
> 公网网关会拒绝来源为浏览器扩展的请求（`Origin: chrome-extension://` → HTTP 412）。
> 因此弹幕翻译和悬浮面板翻译都在**页面上下文**中发起请求，而不是在 service worker 里。

**方式一：直连（推荐，零配置）**

装好扩展即可用，默认就是它，不需要安装任何额外软件。

**方式二：本地代理网桥**

适合需要本地统一注入参数，或页面直连不稳定时使用：

```bash
git clone https://github.com/bilibili/Index-Translate
cd Index-Translate
python inference/llm/call_api.py --serve
```

网桥启动后监听 `127.0.0.1:8080`，在扩展设置里把 **Translation API** 切到
**Index-Translate (Local proxy)** 即可。网桥会自动透传 CORS，并注入
`enable_thinking=false`、`temperature=0.0`。

**自定义地址**：只要选中任一 Index-Translate 选项，设置里就会出现 **Index-Translate URL**
输入框；填了就覆盖上面的预设地址（例如指向自建的 vLLM 网关）。

### 悬浮输入面板

页面右下角会显示一个深色的悬浮窗，你可以：

1. **输入弹幕** — 在文本框中输入你想发送的内容
2. **选择目标语言** — 在下拉菜单中选择要翻译成的语言（默认：简体中文）
3. **翻译** — 点击 **Translate** 按钮或按 `Ctrl + Enter` 进行翻译
4. **复制** — 翻译完成后，点击 **Copy** 按钮将翻译结果复制到剪贴板

**面板操作：**
- **拖拽** — 按住面板标题栏拖动到任意位置
- **最小化** — 点击 `_` 按钮收起面板，点击右下角 Logo 图标恢复
- **关闭** — 点击 `X` 按钮隐藏面板

### 扩展设置

点击浏览器工具栏的扩展图标，打开设置弹窗：

| 设置项 | 说明 | 默认值 |
|---|---|---|
| **启用翻译** | 开关弹幕翻译功能 | 开启 |
| **翻译 API** | Index-Translate（直连 / 本地代理）/ Google 翻译 / MyMemory / LibreTranslate | Index-Translate（直连） |
| **Index-Translate URL** | 自定义服务地址，仅在选择 Index-Translate 时显示；留空则用预设地址 | 留空 |
| **目标语言** | 弹幕和用户输入翻译的目标语言 | 简体中文 |
| **显示模式** | 内嵌（原文下方）/ 悬停提示 / 替换原文 | 内嵌 |
| **字体大小** | 翻译文字大小（8–18px） | 11px |

设置会实时同步到所有已打开的 YouTube 页面，无需刷新。

## 支持的语言

简体中文（默认）、繁体中文、English、日本語、한국어、Español、Français、Deutsch、Português、Русский、العربية、हिन्दी、ไทย、Tiếng Việt、Bahasa Indonesia、Türkçe、Italiano、Nederlands、Polski、Українська

## 翻译 API 说明

| API | 优点 | 限制 |
|---|---|---|
| **Index-Translate（默认）** | B站开源模型，翻译质量高，支持 150 种语言 | 免费公网端点有频率限制，偶发不稳定 |
| **Index-Translate（本地代理）** | 参数可控、可接入本地 vLLM，不受公网限流影响 | 需要本地运行网桥 |
| **Google 翻译** | 质量高、速度快、支持语言多 | 免费端点可能有频率限制 |
| **MyMemory** | 无需 API Key、稳定 | 单次最多 500 字符、有每日配额 |
| **LibreTranslate** | 开源、注重隐私 | 公共实例可能不稳定 |

当一个 API 失败时，扩展会自动尝试下一个可用 API。

## 技术栈

- 纯原生 JavaScript，零外部依赖
- Index-Translate 走页面上下文请求（规避公网网关对扩展来源的 412 拦截）
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
│   （两个脚本都会先加载 lib/translator.js，在页面上下文里调用 Index-Translate）
├── popup/
│   ├── popup.html / js / css     # 扩展设置弹窗
├── lib/
│   ├── translator.js             # 各翻译 API（含 Index-Translate）+ 缓存 + 故障切换
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

**Q: 选了 Index-Translate 但翻译没出现？**
- 公网免费端点偶尔限流，稍等几秒或刷新 YouTube 页面重试
- 确认扩展版本为 v1.3.0 或更高（在 `chrome://extensions` 里点重新加载）
- 如果当前网络访问不了 `index-translate.bilibili.com`，可改用本地代理方式
- 选中 Index-Translate 后的失败会自动回退到其它免费 API，不会让弹幕卡住

**Q: 悬浮面板不见了？**
- 点击右下角的 Logo 图标恢复面板
- 如果图标也不在，刷新页面即可

## 更新日志

### v1.3.0
- 新增 B站 Index-Translate 免费 API 并设为默认（直连 / 本地代理两种接法）
- 支持自定义 Index-Translate 服务地址

### v1.1.0
- 翻译文字颜色由黄色改为紫色
- "Send to Chat" 改为"Copy"一键复制到剪贴板
- 翻译内容支持直接鼠标选中复制
- 默认目标语言改为简体中文

### v1.0.0
- 首个版本发布
- 支持 Google 翻译、MyMemory、LibreTranslate 三大免费 API
- 弹幕内嵌翻译 + 悬浮输入面板

## License

MIT
