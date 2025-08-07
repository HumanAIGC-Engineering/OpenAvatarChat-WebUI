import { Player } from '@/helpers/player'
import { Processor } from '@/helpers/processor'
import { type WS } from '@/helpers/ws.js'
import { EventTypes, PlayerEventTypes } from '@/interface/eventType'
import { TYVoiceChatState } from '@/interface/voiceChat'
import EventEmitter from 'eventemitter3'
// import * as GaussianSplats3D from "./gaussian-splats-3d.module.js";
import { WsEventTypes } from '@/interface/eventType'
// @ts-ignore for lam render
import * as GaussianSplats3D from 'gaussian-splat-renderer-for-lam'

interface GaussianOptions {
  container: HTMLDivElement
  assetsPath: string
  ws: WS
  downloadProgress?: (percent: number) => void
  loadProgress?: (percent: number) => void
}

export class GaussianAvatar extends EventEmitter {
  private _avatarDivEle: HTMLDivElement
  private _assetsPath = ''
  private _ws: WS
  private _downloadProgress: (percent: number) => void
  private _loadProgress: (percent: number) => void
  private _loadPercent = 0
  private _downloadPercent = 0
  private _processor!: Processor
  private _renderer: any
  private _audioMute = false
  curState = TYVoiceChatState.Idle
  constructor(options: GaussianOptions) {
    const { container, assetsPath, ws, downloadProgress, loadProgress } =
      options
    super()
    this._avatarDivEle = container
    this._assetsPath = assetsPath
    this._ws = ws
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
  private _init() {
    if (!this._avatarDivEle || !this._assetsPath || !this._ws) {
      throw new Error(
        'Lack of necessary initialization parameters for gaussian render',
      )
    }
    this._processor = new Processor(this)
    this._bindEventTypes()
  }
  start() {
    this.getData()
    this.render()
  }

  async getData() {
    this._ws.on(WsEventTypes.WS_MESSAGE, (data: Blob) => {
      if (this._downloadPercent < 1 || this._loadPercent < 1) {
        // 本地数字人未加载完成前，不处理数据
        return
      }

      this.emit(EventTypes.MessageReceived, this.curState)

      this._processor.add({
        avatar_motion_data: {
          first_package: true, // 是否首包
          segment_num: 1, // 分片数量，首包存在该值
          binary_size: data.size, // 数据大小，首包存在该值
          use_binary_frame: false, // 是否使用二进制帧，首包存在该值
        },
      })

      this._processor.add({
        avatar_motion_data: {
          first_package: false,
          motion_data_slice: data, // 数据分片，非首包存在该值
          is_audio_mute: this._audioMute, // 音频片段是否静音，非首包存在该值
        },
      })
    })
  }

  async render() {
    this._renderer = await GaussianSplats3D.GaussianSplatRenderer.getInstance(
      this._avatarDivEle,
      this._assetsPath,
      {
        getChatState: this.getChatState.bind(this),
        getExpressionData: this.getArkitFaceFrame.bind(this),
        downloadProgress: this._downloadProgress.bind(this),
        loadProgress: this._loadProgress.bind(this),
      },
    )
  }
  setAvatarMute(isMute: boolean) {
    this._processor.setMute(isMute)
    this._audioMute = isMute
  }
  getChatState() {
    return this.curState
  }
  getArkitFaceFrame() {
    return this._processor?.getArkitFaceFrame().arkitFace
  }
  interrupt(): void {
    this._ws.send('%interrupt%') // 约定的打断标识
    this._processor?.interrupt()
    this.curState = TYVoiceChatState.Idle
    this.emit(EventTypes.StateChanged, this.curState)
  }
  sendSpeech(data: string | Int8Array | Uint8Array) {
    this._ws.send(data)
    this.curState = TYVoiceChatState.Listening
    this.emit(EventTypes.StateChanged, this.curState)
    this._processor?.clear()
  }
  exit() {
    this._renderer?.dispose()
    this.curState = TYVoiceChatState.Idle
    this._downloadPercent = 0
    this._loadPercent = 0
    this._processor?.clear()
    this.removeAllListeners()
  }
  private _bindEventTypes() {
    this.on(PlayerEventTypes.Player_StartSpeaking, (player: Player) => {
      console.log('startSpeach')
      this.curState = TYVoiceChatState.Responding
      this.emit(EventTypes.StateChanged, this.curState)
      this._ws.send(
        JSON.stringify({
          header: { name: EventTypes.StartSpeech },
          payload: {},
        }),
      )
    })
    this.on(PlayerEventTypes.Player_EndSpeaking, (player: Player) => {
      console.log('endSpeach')
      this.curState = TYVoiceChatState.Idle
      this.emit(EventTypes.StateChanged, this.curState)
      this._ws.send(
        JSON.stringify({ header: { name: EventTypes.EndSpeech }, payload: {} }),
      )
    })
    this.on(EventTypes.ErrorReceived, (data) => {
      console.log('ErrorReceived', data)
      this.curState = TYVoiceChatState.Idle
      this.emit(EventTypes.StateChanged, this.curState)
      this._ws.send(
        JSON.stringify({
          header: { name: EventTypes.ErrorReceived },
          payload: { ...data },
        }),
      )
    })
    this._ws.on(WsEventTypes.WS_CLOSE, () => {
      this.exit()
    })
  }
}
