import { Buffer } from 'buffer'
import { Processor } from '@/helpers/processor'
import { type WS } from '@/helpers/ws.js'
import {
  EchoAvatarAudioPayload,
  EventTypes,
  MotionDataPayload,
  PlayerEventTypes,
  SendHumanTextPayload,
  TextPayload,
  WsInboundMessage,
  WsPayloadMap,
  WsProtocol,
  WsEventTypes,
  SignalBody,
} from '@/interface/eventType'
import { TYVoiceChatState } from '@/interface/voiceChat'
import EventEmitter from 'eventemitter3'
// import * as GaussianSplats3D from "./gaussian-splats-3d.module.js";
import { LAMRenderer } from './avatarRenderers/lam'
import { nanoid } from 'nanoid'

interface AvatarHandlerOptions {
  container: HTMLDivElement
  assetsPath: string
  ws: WS
  downloadProgress?: (percent: number) => void
  loadProgress?: (percent: number) => void
  rendererType: 'lam' | '' // '' means pure audio mode
}

export class AvatarHandler extends EventEmitter {
  private _avatarDivEle: HTMLDivElement
  private _assetsPath = ''
  private _ws: WS
  private _downloadProgress: (percent: number) => void
  private _loadProgress: (percent: number) => void
  private _loadPercent = 0
  private _downloadPercent = 0
  private _processor!: Processor
  private _renderer: { dispose?: () => void } | null = null
  private _audioMute = false
  private _rendererType: 'lam' | '' = 'lam'
  private _heartbeatWorker?: Worker
  private _currentStreamKey?: string
  curState = TYVoiceChatState.Idle
  constructor(options: AvatarHandlerOptions) {
    const { container, assetsPath, ws, downloadProgress, loadProgress, rendererType } = options
    super()
    this._avatarDivEle = container
    this._assetsPath = assetsPath
    this._ws = ws
    this._rendererType = rendererType
    if (downloadProgress) {
      this._downloadProgress = (percent: number) => {
        this._downloadPercent = percent
        downloadProgress(percent)
      }
    } else {
      this._downloadProgress = (percent: number) => {
        this._downloadPercent = percent
      }
    }
    if (loadProgress) {
      this._loadProgress = (percent: number) => {
        this._loadPercent = percent
        loadProgress(percent)
      }
    } else {
      this._loadProgress = (percent: number) => {
        this._loadPercent = percent
      }
    }
    this._init()
  }
  private _init(): void {
    if (!this._avatarDivEle || !this._ws) {
      throw new Error('Lack of necessary initialization parameters for gaussian render')
    }
    this._processor = new Processor(this, this._rendererType)
    this._bindEventTypes()
    this.start()
  }
  start(): void {
    this.getData()
    this.render()
  }

  async getData(): Promise<void> {
    this._ws.on(WsEventTypes.WS_MESSAGE, (data: Blob | string) => {
      if (typeof data === 'string') {
        this._handleTextMessage(data)
      } else if (data instanceof Blob) {
        // console.log('WS_MESSAGE Blob', data)
        this._handleBinaryMessage(data)
      }
    })
  }

  async render(): Promise<void> {
    if (this._rendererType === 'lam') {
      const lamRenderer = new LAMRenderer({
        container: this._avatarDivEle,
        assetsPath: this._assetsPath,
        getChatState: this.getChatState.bind(this),
        getExpressionData: this.getArkitFaceFrame.bind(this),
        downloadProgress: this._downloadProgress.bind(this),
        loadProgress: this._loadProgress.bind(this),
      })
      this._renderer = await lamRenderer.getInstance()
    } else {
      this._renderer = null
    }
  }
  setAvatarMute(isMute: boolean): void {
    this._processor.setMute(isMute)
    this._audioMute = isMute
  }
  getChatState(): TYVoiceChatState {
    return this.curState
  }
  getArkitFaceFrame(): unknown {
    return this._processor?.getArkitFaceFrame().arkitFace
  }
  interrupt(needSendInterrupt: boolean = true): void {
    const maxBatchId = this._processor?.interrupt()
    if (needSendInterrupt) {
      this._sendJson(WsProtocol.Interrupt, { maxBatchId })
    }

    this.curState = TYVoiceChatState.Idle
    this.emit(EventTypes.StateChanged, this.curState)
  }
  sendSpeech(data: string): void {
    const requestId = nanoid()
    const streamKey = nanoid()
    const payload: SendHumanTextPayload = {
      request_id: requestId,
      text: data,
      stream_key: streamKey,
      end_of_speech: true,
      mode: 'full_text',
    }
    this._sendJson(WsProtocol.SendHumanText, payload)
    this.curState = TYVoiceChatState.Listening
    this.emit(EventTypes.StateChanged, this.curState)
    this._processor?.clear()
  }
  sendAudio(pcm: Int16Array, transport: 'base64' | 'binary' = 'base64'): void {
    if (!this._ws?.engine || this._ws.engine.readyState !== WebSocket.OPEN) return
    if (!pcm?.length) return

    if (transport === 'binary') {
      const binary = pcm instanceof Int16Array ? pcm : new Int16Array(pcm)
      this._sendJson(WsProtocol.SendHumanAudio, {
        transport: 'binary',
        binary_size: binary.byteLength,
        segment_num: 1,
      })
      this._ws.send(new Uint8Array(binary.buffer))
      return
    }

    const data_base64 = Buffer.from(pcm.buffer).toString('base64')
    this._sendJson(WsProtocol.SendHumanAudio, {
      transport: 'base64',
      data_base64,
    })
  }
  exit(): void {
    this._stopHeartbeat()
    this._renderer?.dispose?.()
    this.curState = TYVoiceChatState.Idle
    this._downloadPercent = 0
    this._loadPercent = 0
    this._processor?.clear()
    this.removeAllListeners()
  }
  private _bindEventTypes(): void {
    this.on(PlayerEventTypes.Player_StartSpeaking, () => {
      console.log('startSpeach')
      this.curState = TYVoiceChatState.Responding
      this.emit(EventTypes.StateChanged, this.curState)
    })
    this.on(PlayerEventTypes.Player_EndSpeaking, () => {
      console.log('endSpeach')
      this.curState = TYVoiceChatState.Idle
      this.emit(EventTypes.StateChanged, this.curState)
      if (!this._currentStreamKey) return
      this._sendJson(WsProtocol.EndSpeech, {
        stream_key: this._currentStreamKey,
      })
    })
    this.on(EventTypes.ErrorReceived, (data) => {
      console.log('ErrorReceived', data)
      this.curState = TYVoiceChatState.Idle
      this.emit(EventTypes.StateChanged, this.curState)
    })
    this._ws.on(WsEventTypes.WS_OPEN, () => {
      console.log('WS_OPEN')

      this._sendInitializeSession()
      this._startHeartbeat()
    })
    this._ws.on(WsEventTypes.WS_CLOSE, () => {
      this.exit()
    })
  }
  private _handleTextMessage(message: string): void {
    let parsed: WsInboundMessage | undefined
    try {
      parsed = JSON.parse(message) as WsInboundMessage
    } catch (error) {
      console.warn('Failed to parse ws text message', error)
      return
    }
    if (!parsed?.header?.name) return
    const { header } = parsed
    switch (header.name) {
      case WsProtocol.AvatarSessionInitialized:
        this.curState = TYVoiceChatState.Idle
        this.emit(EventTypes.StateChanged, this.curState)
        break
      case WsProtocol.MotionDataWelcome:
      case WsProtocol.MotionData: {
        const payload = this._extractPayload(parsed, header.name) as MotionDataPayload | undefined
        if (!payload?.motion_data) break
        const segmentNum = payload.motion_data.segment_num ?? 1
        const binarySize = payload.motion_data.binary_size ?? 0
        this._currentStreamKey = payload.stream_key
        this._processor.add({
          avatar_motion_data: {
            first_package: true,
            segment_num: segmentNum,
            binary_size: binarySize,
            use_binary_frame: true,
          },
        })

        break
      }
      case WsProtocol.EchoAvatarAudio: {
        const payload = this._extractPayload(parsed, WsProtocol.EchoAvatarAudio)
        this._handleAvatarAudioTextFrame(payload)
        break
      }
      case WsProtocol.EchoHumanText: {
        console.log('EchoHumanText', parsed)
        const payload = this._extractPayload(parsed, WsProtocol.EchoHumanText) as
          | TextPayload
          | undefined
        if (!payload) break
        this.emit(EventTypes.MessageReceived, { role: 'human', payload })
        break
      }
      case WsProtocol.EchoAvatarText: {
        console.log('EchoAvatarText', parsed)
        const payload = this._extractPayload(parsed, WsProtocol.EchoAvatarText) as
          | TextPayload
          | undefined
        if (!payload) break
        this.emit(EventTypes.MessageReceived, { role: 'avatar', payload })
        break
      }
      case WsProtocol.AvatarHeartbeat:
        break
      case WsProtocol.Error:
        this.emit(EventTypes.ErrorReceived, this._extractPayload(parsed, WsProtocol.Error))
        break
      case WsProtocol.InterruptNotification:
        this.interrupt(false)
        break
      case WsProtocol.ChatSignal:
        this._handleSignal(this._extractPayload(parsed, WsProtocol.ChatSignal))
        break
      default:
        break
    }
  }
  private _handleSignal(payload: SignalBody | undefined) {
    if (payload) {
      this.emit(EventTypes.SignalReceived, payload)
      switch (payload.type) {
        case 'interrupt':
          this.interrupt(false)
          break
        case 'stream_cancel':
          console.log('stream_cancel  interrupt', payload)
          if (payload.stream_type === 'client_playback') {
            this.interrupt(false)
          }
          break
        default:
          break
      }
    }
  }
  private _handleBinaryMessage(data: Blob): void {
    this._processor.add({
      avatar_motion_data: {
        first_package: false,
        motion_data_slice: data, // 数据分片，非首包存在该值
        is_audio_mute: this._audioMute, // 音频片段是否静音，非首包存在该值
      },
    })
  }
  private _handleAvatarAudioTextFrame(payload?: EchoAvatarAudioPayload): void {
    if (!payload) return
    // 当前前端未做单独的 TTS 音频拼接播放，这里仅保留类型化后的钩子
    console.log('EchoAvatarAudio', payload)
  }
  private _sendJson<K extends WsProtocol>(name: K, payload?: WsPayloadMap[K]): void {
    const body: Record<string, unknown> = {
      header: {
        name,
        request_id: nanoid(),
      },
    }
    if (payload !== undefined) {
      body.payload = payload
    }
    this._ws.send(JSON.stringify(body))
  }
  private _sendInitializeSession(): void {
    this._sendJson(WsProtocol.InitializeAvatarSession, {
      audio: {
        format: 'PCM',
        sample_rate: 16000,
        channels: 1,
      },
      subscriptions: ['human_text', 'avatar_text', 'motion_data'],
    })
  }
  private _startHeartbeat(): void {
    this._stopHeartbeat()
    // 使用 Web Worker 来发送心跳，避免浏览器后台时 setInterval 被节流
    this._heartbeatWorker = new Worker(
      new URL('../worklets/heartbeat-worker.js', import.meta.url),
      { type: 'module' }
    )
    this._heartbeatWorker.onmessage = (e) => {
      if (e.data.type === 'heartbeat') {
        this._sendJson(WsProtocol.TriggerHeartbeat)
      }
    }
    this._heartbeatWorker.postMessage({ type: 'start', interval: 10_000 })
  }
  private _stopHeartbeat(): void {
    if (this._heartbeatWorker) {
      this._heartbeatWorker.postMessage({ type: 'stop' })
      this._heartbeatWorker.terminate()
      this._heartbeatWorker = undefined
    }
  }
  private _extractPayload<K extends WsProtocol>(
    message: WsInboundMessage,
    protocol: K
  ): WsPayloadMap[K] | undefined {
    if (message.header?.name !== protocol) return undefined
    return (message as { payload?: WsPayloadMap[K] }).payload
  }
}
