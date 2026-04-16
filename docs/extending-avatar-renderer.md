# 扩展端渲染数字人（AvatarHandler 开发指南）

AvatarHandler 是本项目的核心组件，负责管理数字人的完整生命周期。以下介绍其架构和扩展方法。

本文档基于 [OpenAvatarChat WebUI](https://github.com/HumanAIGC-Engineering/OpenAvatarChat) 项目。

## 架构概述

AvatarHandler 基于 EventEmitter3 实现事件驱动设计，核心职责包括：

- WebSocket 通信管理
- 音视频数据处理
- 数字人渲染引擎管理
- 心跳保活机制
- 对话状态机管理

## 状态机

```
Idle ──[开始说话]──→ Listening
  ↑                    │
  │                    ↓
  └────[对话完成]── Responding ──[说话结束]──→ Idle
```

状态定义（`TYVoiceChatState`）：

```typescript
export enum TYVoiceChatState {
  Idle = 'Idle',             // 空闲/待机
  Listening = 'Listening',   // 正在监听用户输入
  Responding = 'Responding', // 数字人正在响应
  Thinking = 'Thinking',     // 思考中（预留状态）
}
```

## 核心接口

```typescript
// AvatarHandler 初始化选项
interface AvatarHandlerOptions {
  container: HTMLDivElement           // 渲染容器 DOM 元素
  assetsPath: string                  // 数字人模型资源路径
  ws: WS                              // WebSocket 连接实例
  downloadProgress?: (percent: number) => void  // 资源下载进度回调
  loadProgress?: (percent: number) => void      // 资源加载进度回调
  rendererType: 'lam' | ''            // 渲染模式：'lam'=LAM本地渲染, ''=纯音频模式
}

// 数字人渲染器需实现的接口
interface AvatarLike {
  setAvatarMute?(isMute: boolean): void  // 静音控制
  interrupt?(): void                      // 中断当前响应
}
```

## 通信协议

AvatarHandler 通过 WebSocket 与后端通信，主要协议消息：

**发送（前端→后端）**：

- `InitializeAvatarSession`：初始化数字人会话
- `SendHumanText`：发送用户文本输入
- `SendHumanAudio`：发送用户语音（16kHz PCM, base64编码）
- `Interrupt`：中断数字人响应
- `TriggerHeartbeat`：心跳保活（每10秒）

**接收（后端→前端）**：

- `AvatarSessionInitialized`：会话初始化完成
- `EchoHumanText`：用户文本回显
- `EchoAvatarText`：数字人文本回复
- `MotionData` / `MotionDataWelcome`：运动/表情数据（用于端侧渲染）
- `ChatSignal`：流信号（stream_begin/stream_end/stream_cancel）
- `Error`：错误信息

## 事件系统

```typescript
// AvatarHandler 发出的事件
EventTypes.StateChanged       // 对话状态变化
EventTypes.MessageReceived    // 接收到文本消息
EventTypes.SignalReceived     // 接收到流信号
EventTypes.ErrorReceived      // 接收到错误
```

## 如何扩展新的数字人渲染器

如果你希望集成自定义的数字人渲染引擎（如 Live2D、3D 模型等），可以按照以下步骤操作：

### 步骤1：创建渲染器类

在 `src/renderer/src/handlers/avatarRenderers/` 目录下创建新的渲染器文件：

```typescript
// 例如：src/renderer/src/handlers/avatarRenderers/custom.ts
export class CustomRenderer {
  container: HTMLDivElement
  assetsPath: string

  constructor(options: {
    container: HTMLDivElement
    assetsPath: string
    downloadProgress?: (percent: number) => void
    loadProgress?: (percent: number) => void
  }) {
    this.container = options.container
    this.assetsPath = options.assetsPath
    // 初始化你的渲染引擎...
  }

  // 更新表情/动作数据
  updateExpression(data: any): void {
    // 将运动数据应用到你的渲染模型
  }

  // 销毁渲染器
  destroy(): void {
    // 清理资源
  }
}
```

### 步骤2：集成到 AvatarHandler

修改 `src/renderer/src/handlers/avatarHandler.ts`：

首先扩展 `rendererType` 类型定义以支持新的渲染器类型：

```typescript
// 在 AvatarHandlerOptions 接口中扩展 rendererType
interface AvatarHandlerOptions {
  // ...
  rendererType: 'lam' | '' | 'custom'  // 添加你的渲染器类型标识
}
```

然后在 `render()` 方法中添加你的渲染器类型分支：

```typescript
async render(): Promise<void> {
  if (this._rendererType === 'lam') {
    // ... 现有 LAM 渲染器逻辑
  } else if (this._rendererType === 'custom') {
    this._renderer = new CustomRenderer({
      container: this._avatarDivEle,
      assetsPath: this._assetsPath,
      downloadProgress: this._downloadProgress,
      loadProgress: this._loadProgress,
    })
  } else {
    this._renderer = null
  }
}
```

### 步骤3：处理运动数据

在 `_handleBinaryMessage()` 或 `Processor` 中适配你的数据格式，将后端发送的运动数据转换为渲染器能理解的格式。

### 步骤4：注册到 Store

在 `useVideoChatStore` 或 `useWSVideoChatStore` 中，通过 `chatStore.setActiveRenderer()` 注册你的 Handler：

```typescript
// 在 Store 的 initAvatarHandler() 方法中
const handler = new AvatarHandler({
  container: visionStore.remoteVideoContainerRef!,
  assetsPath: appStore.avatarAssetsPath,
  ws: ws,
  rendererType: 'custom',  // 你的渲染器类型
})
chatStore.setActiveRenderer(handler)
chatStore.bindAvatarHandler(handler)
```

## 当前内置渲染器

| 渲染器 | 类型标识 | 说明 |
|--------|---------|------|
| LAMRenderer | `'lam'` | 基于高斯泼溅（Gaussian Splatting）的端侧数字人渲染，使用 `gaussian-splat-renderer-for-lam` 库 |
| 纯音频模式 | `''` | 不渲染数字人形象，仅进行语音对话 |
