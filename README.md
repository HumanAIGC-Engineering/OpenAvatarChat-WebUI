# OpenAvatarChat WebUI

## 项目简介

这是 [OpenAvatarChat](https://github.com/HumanAIGC-Engineering/OpenAvatarChat) 项目的官方 Web 前端界面，基于 Vue 3 + TypeScript + Vite 构建，同时支持 Electron 桌面应用。

项目提供实时数字人对话交互、音视频通信、会话管理等核心功能，支持多种对话模式（WebRTC / WebSocket）和数字人渲染方式（LAM 端侧高斯泼溅渲染 / 服务端渲染）。

主要技术栈：Vue 3, TypeScript, Vite, Electron, Pinia, Ant Design Vue, WebRTC, WebSocket

## 与 OpenAvatarChat 的关系

本项目是 [OpenAvatarChat](https://github.com/HumanAIGC-Engineering/OpenAvatarChat) 的前端工程。

- 在 OpenAvatarChat 仓库中，本项目的编译产物（dist 目录）被集成在 `src/service/frontend_service/frontend/dist/` 路径下
- 后端通过 FastAPI 的 `register_frontend()` 函数将前端静态资源挂载到 `/ui` 路径，访问根路径 `/` 时会自动重定向到 `/ui/index.html`
- 前端通过 `/openavatarchat/initconfig` 接口获取后端的初始化配置（对话模式、数字人类型、WebRTC/WebSocket 路由等）
- 前后端通过 HTTP REST API、WebRTC 信令和 WebSocket 进行通信
- 两个项目有独立的版本管理和发布周期，通过编译产物（dist 文件）进行同步

## 环境变量配置（.env）

`.env` 文件位于项目根目录，用于配置前端连接后端服务的地址信息。

### 变量说明

| 环境变量 | 类型 | 用途 | 默认值 |
|---------|------|------|--------|
| `VITE_SERVER_IP` | String | OpenAvatarChat 后端服务器 IP 地址 | 自动从 `location.hostname` 读取 |
| `VITE_SERVER_PORT` | String | 后端服务器端口 | 自动从 `location.port` 读取 |
| `VITE_USE_SSL` | String | 是否使用 SSL/HTTPS 连接 (`true`/`false`) | 自动从 `location.protocol` 推导 |

### 配置规则

- **跟随 OpenAvatarChat 部署时**：无需配置 .env，前端自动从浏览器 `location` 对象获取服务器地址（因为前端和后端同源部署）
- **独立前端开发/部署时**：需要在 .env 中配置后端服务器地址
- 当 `VITE_USE_SSL=false` 时，出于浏览器安全限制，hostname 必须为 `127.0.0.1` 或 `localhost`
- 非本地网络访问必须配置 SSL 证书（`VITE_USE_SSL=true`）

### 示例

```env
# 连接本地后端服务（无SSL）
VITE_SERVER_IP=127.0.0.1
VITE_SERVER_PORT=8282
VITE_USE_SSL=false

# 连接远程后端服务（需SSL）
VITE_SERVER_IP=your-server-ip
VITE_SERVER_PORT=8282
VITE_USE_SSL=true
```

## 初始化配置接口（InitConfig）

前端启动时会调用 `GET /openavatarchat/initconfig` 接口获取后端的初始化配置，该配置决定了前端的对话模式、数字人渲染方式和媒体采集参数。

### 响应数据结构

```typescript
interface InitConfigResponse {
  // 错误信息（若存在则表示初始化失败）
  detail?: string

  // WebRTC 配置（标准 RTCConfiguration 对象，包含 ICE 服务器等）
  rtc_configuration?: RTCConfiguration

  // 对话模式：'webrtc'（实时音视频）或 'ws'（WebSocket 音频/文本）
  chat_mode?: 'webrtc' | 'ws'

  // 数字人配置
  avatar_config?: {
    avatar_type: string          // 渲染类型标识，如 'lam'（端侧渲染）或 ''（纯音频）
    avatar_ws_route: string      // 数字人 WebSocket 路由，如 '/ws/webrtc/avatar'
    avatar_assets_path: string   // 数字人模型资源路径
    ws_session_route?: string    // 会话 WebSocket 路由（备选）
  }

  // 备选会话 WebSocket 路由
  ws_session_route?: string

  // 媒体轨道约束（控制摄像头/麦克风采集参数）
  track_constraints?: {
    audio?: boolean | MediaTrackConstraints
    video?: boolean | MediaTrackConstraints
  }
}
```

### 字段说明

| 字段 | 前端存储位置 | 用途 | 默认值 |
|------|------------|------|--------|
| `rtc_configuration` | `appStore.rtcConfig` | 初始化 WebRTC PeerConnection 连接 | `{}` |
| `chat_mode` | `appStore.chatMode` | 决定使用 WebRTC 或 WebSocket 对话模式 | `'webrtc'` |
| `avatar_config.avatar_type` | `appStore.avatarType` | 选择数字人渲染引擎 | `''` |
| `avatar_config.avatar_ws_route` | `appStore.avatarWSRoute` | 建立数字人 WebSocket 通道 | `''` |
| `avatar_config.avatar_assets_path` | `appStore.avatarAssetsPath` | 加载数字人模型资源（自动转换为完整 URL） | `''` |
| `avatar_config.ws_session_route` | `appStore.wsSessionRoute` | 备选会话路由，当 `avatar_ws_route` 未设置时使用 | `''` |
| `track_constraints` | `mediaStore.trackConstraints` | 控制前端音视频采集参数 | 浏览器默认值 |

### 配置优先级

1. `avatar_config.avatar_ws_route` 优先作为 WebSocket 连接路由
2. 若未设置，则依次尝试 `avatar_config.ws_session_route` → `ws_session_route` 作为回退
3. `avatar_assets_path` 会通过 `makeURL()` 自动转换为完整的资源 URL

## 部署方式

### 1. 跟随 OpenAvatarChat 一起部署（推荐）

这是最简单的部署方式，前端作为静态资源被后端 FastAPI 服务直接挂载。

**流程**：

1. 按照 [OpenAvatarChat](https://github.com/HumanAIGC-Engineering/OpenAvatarChat) 的文档部署后端服务
2. 前端编译产物已包含在 OpenAvatarChat 的 `src/service/frontend_service/frontend/dist/` 中
3. 启动后端服务后，访问 `https://your-server:8282` 即可自动重定向到前端页面

**特点**：

- 前后端同源部署，无跨域问题
- 无需单独配置 .env
- 前端更新需要重新编译并同步 dist 文件到后端项目

**如需更新前端**：

```bash
# 在 WebUI 项目中
pnpm install
pnpm run build
# 将 dist/ 目录内容复制到 OpenAvatarChat/src/service/frontend_service/frontend/dist/
```

### 2. 独立前端部署

适用于前后端分离开发或需要自定义前端部署的场景。

**开发模式**：

```bash
# 安装依赖
pnpm install

# 配置 .env 指向后端服务地址
# VITE_SERVER_IP=your-backend-ip
# VITE_SERVER_PORT=8282

# 启动开发服务器（支持HMR热更新）
pnpm run dev
```

**生产构建**：

```bash
pnpm run build
# 输出目录：dist/
# 将 dist/ 部署到任意 Web 服务器（Nginx、Apache 等）
```

**特点**：

- 前后端独立部署，灵活性高
- 开发模式通过 Vite 代理解决跨域问题（代理 `/openavatarchat`、`/webrtc/offer`、`/ws` 等路由）
- 生产部署需要通过 .env 配置后端地址，或通过反向代理转发 API 请求
- 适合前端开发调试和自定义部署场景

### 3. Electron 桌面应用部署

将前端打包为原生桌面应用，提供更好的桌面集成体验。

**开发模式**：

```bash
pnpm run electron:dev
```

**构建命令**：

```bash
# macOS
pnpm run build:mac

# Windows
pnpm run build:win

# Linux
pnpm run build:linux
```

**特点**：

- 原生桌面应用体验，独立窗口运行
- 支持无边框透明窗口
- 通过 Electron IPC 实现主进程与渲染进程通信
- 需要在应用内配置后端服务器地址

### 三种部署方式对比

| 特性 | 跟随 OpenAvatarChat | 独立前端 | Electron |
|------|-------------------|---------|----------|
| 部署复杂度 | 低（自动集成） | 中（需配置代理/地址） | 高（需打包分发） |
| 跨域处理 | 无需（同源） | 需要配置代理 | 无需（内置请求） |
| .env 配置 | 不需要 | 需要 | 需要 |
| 热更新开发 | 不支持 | 支持 | 支持 |
| 适用场景 | 生产部署 | 前端开发/自定义部署 | 桌面应用分发 |

## Manager 管理后台

项目包含一个独立的管理后台页面（`manager.html`），用于实时监控和调试 OpenAvatarChat 的会话与数据处理流程。

### 访问方式

- 跟随 OpenAvatarChat 部署时：访问 `https://your-server:8282/ui/manager.html`
- 独立前端开发时：访问 `http://localhost:5173/manager.html`

### 功能模块

#### 1. 会话列表管理

实时展示所有活跃的数字人对话会话，支持会话选择与切换。系统最多保留 20 个并发会话，超过限制时自动清理非活跃会话（60 秒内无更新即标记为非活跃）。

#### 2. 消息详情查看

展示选中会话的完整聊天历史，包括用户消息和数字人回复。支持音频资源在线播放、消息时间戳显示、流 ID 追踪和流元数据复制。

#### 3. 信号流可视化

基于 Vue Flow 的实时数据处理管道可视化，展示各 Handler 节点及其之间的数据流向：

- **活跃节点**（绿色）：数据正在流动，带脉冲动画
- **完成节点**（灰色）：处理已完成
- **超时节点**（红色）：处理超过 10 秒无进展，闪烁警告

支持自动布局（dagre 算法）、节点耗时计算、打断信号发送等功能。

#### 4. 运行时配置查看

实时监控后端当前的运行时配置，包括全局参数（如 `model_root`、`concurrent_limit`）和各 Handler 的详细配置信息。

#### 5. 连接与认证管理

管理 WebSocket 连接状态（idle/connecting/open/closed/error），支持 Token 认证设置和重新连接操作。

### 数据通信

Manager 通过独立的 WebSocket 连接（`/ws/manager/data_tool`）与后端通信，接收以下类型的实时事件：

| 事件类型 | 说明 |
|---------|------|
| `snapshot` | 初始会话快照，同步当前所有活跃会话 |
| `chat_data` | 聊天消息、音频数据、图像数据 |
| `signal` | Handler 节点信号（stream_begin/stream_end/interrupt） |
| `current_config` | 后端运行时配置更新 |

## Electron 增强功能

Electron 版本在 Web 版本基础上增加了以下桌面应用特性：

### 1. 自定义窗口管理

- 无边框透明窗口设计（`frame: false`, `transparent: true`）
- 默认窗口尺寸 900×670px
- 动态窗口大小调整（隐藏对话记录时窗口宽度缩小为 450px）

### 2. 右键上下文菜单

- 工具栏显示/隐藏切换
- 输入框显示/隐藏切换
- 对话记录面板显示/隐藏切换

### 3. 本地状态持久化

- 使用 `electron-store` 持久化应用状态
- 保存用户界面偏好设置（工具栏、输入框、对话记录的显示状态）
- 应用重启后自动恢复上次的界面布局

### 4. 系统权限管理

- macOS 摄像头访问权限（`NSCameraUsageDescription`）
- macOS 麦克风访问权限（`NSMicrophoneUsageDescription`）
- 文件系统访问权限（Documents、Downloads 目录）

### 5. 安全桥接层（Preload）

- 通过 `contextBridge` 安全暴露 Electron API
- 提供 `window.electron`、`window.api`（fetch 代理）、`window.electronInfo`（版本、平台信息）
- IPC 通信支持：`app-ready`、`state-changed`、`show-context-menu`、`set-state`/`get-state`

## 扩展端渲染数字人

本项目支持通过自定义 AvatarHandler 集成新的数字人渲染引擎（如 Live2D、3D 模型等）。项目内置了基于高斯泼溅（Gaussian Splatting）的 LAM 端侧渲染器和纯音频对话模式。

| 渲染器 | 类型标识 | 说明 |
|--------|---------|------|
| LAMRenderer | `'lam'` | 基于高斯泼溅的端侧数字人渲染，使用 `gaussian-splat-renderer-for-lam` 库 |
| 纯音频模式 | `''` | 不渲染数字人形象，仅进行语音对话 |

详细的架构说明、通信协议和扩展开发指南请参阅 [AvatarHandler 开发指南](./docs/extending-avatar-renderer.md)。

## 项目构建命令

| 命令 | 说明 |
|------|------|
| `pnpm run dev` | Web 开发模式（HMR 热更新） |
| `pnpm run build` | Web 生产构建（输出到 `dist/`） |
| `pnpm run electron:dev` | Electron 开发模式 |
| `pnpm run electron:build` | Electron 代码编译 |
| `pnpm run build:mac` | macOS 应用打包 |
| `pnpm run build:win` | Windows 应用打包 |
| `pnpm run build:linux` | Linux 应用打包 |

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](./LICENSE) 文件。
