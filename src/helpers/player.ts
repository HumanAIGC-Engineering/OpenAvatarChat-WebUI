import type EventEmitter from 'eventemitter3'
import { nanoid } from 'nanoid'

import { PlayerEventTypes } from '../interface/eventType'
interface IOption {
  // 传入的数据是采用多少位编码，默认16位
  channels: number
  // 缓存时间 单位 ms
  fftSize: number

  inputCodec: 'Int8' | 'Int16' | 'Int32' | 'Float32'
  // analyserNode fftSize
  onended: (extParams?: IExtInfo) => void
  // 采样率 单位Hz
  sampleRate: number
  // 是否静音
  isMute: boolean
}
interface ITypedArrays {
  Float32: typeof Float32Array
  Int16: typeof Int16Array
  Int32: typeof Int32Array
  Int8: typeof Int8Array
}
type IExtInfo = Record<string, unknown>
interface ISamples {
  data: Float32Array
  end_of_batch: boolean
  startTime?: number
}
export class Player {
  static isTypedArray(
    data: Int8Array | Int16Array | Int32Array | Float32Array,
  ) {
    // 检测输入的数据是否为 TypedArray 类型或 ArrayBuffer 类型
    return (
      (data.byteLength &&
        data.buffer &&
        data.buffer.constructor === ArrayBuffer) ||
      data.constructor === ArrayBuffer
    )
  }
  id = nanoid()
  analyserNode?: AnalyserNode
  audioCtx?: AudioContext
  // 是否自动播放
  autoPlay = true
  bufferSource?: AudioBufferSourceNode
  convertValue = 32768
  ee: EventEmitter
  gainNode?: GainNode
  option: IOption = {
    inputCodec: 'Int16', // 传入的数据是采用多少位编码，默认16位
    channels: 1, // 声道数
    sampleRate: 8000, // 采样率 单位Hz
    fftSize: 2048, // analyserNode fftSize
    onended: () => {},
    isMute: false,
  }
  samplesList: ISamples[] = []

  startTime?: number
  typedArray?:
    | typeof Int8Array
    | typeof Int16Array
    | typeof Int32Array
    | typeof Float32Array

  _firstStartRelativeTime?: number
  _firstStartAbsoluteTime?: number

  constructor(option: IOption, ee: EventEmitter) {
    this.ee = ee
    this.init(option)
  }

  async continue() {
    await this.audioCtx!.resume()
  }
  destroy() {
    this.samplesList = []
    this.audioCtx?.close()
    this.audioCtx = undefined
  }
  feed(audioOptions: {
    audio: Int8Array | Int16Array | Int32Array | Float32Array
    end_of_batch: boolean
  }) {
    let { audio } = audioOptions
    const { end_of_batch } = audioOptions
    if (!audio) {
      return
    }
    this._isSupported(audio)
    // 获取格式化后的buffer
    audio = this._getFormattedValue(audio)
    // 开始拷贝buffer数据
    // 新建一个Float32Array的空间
    const data = new Float32Array(audio.length)
    // 复制传入的新数据
    // 从历史buff位置开始
    data.set(audio, 0)
    // 将新的完整buff数据赋值给samples
    const samples = {
      data,
      end_of_batch,
    }
    this.samplesList.push(samples)
    this.flush(samples, this.samplesList.length - 1)
  }
  flush(samples: ISamples, index: number) {
    if (!(samples && this.autoPlay && this.audioCtx)) return
    const { data, end_of_batch } = samples
    if (this.bufferSource) {
      this.bufferSource.onended = () => {}
    }
    this.bufferSource = this.audioCtx!.createBufferSource()
    if (typeof this.option.onended === 'function') {
      this.bufferSource.onended = () => {
        if (!end_of_batch && index === this.samplesList.length - 1) {
          this.ee.emit(PlayerEventTypes.Player_WaitNextAudioClip)
        }
        this.option.onended()
      }
    }
    const length = data.length / this.option.channels
    const audioBuffer = this.audioCtx!.createBuffer(
      this.option.channels,
      length,
      this.option.sampleRate,
    )

    for (let channel = 0; channel < this.option.channels; channel++) {
      const audioData = audioBuffer.getChannelData(channel)
      let offset = channel
      let decrement = 50
      for (let i = 0; i < length; i++) {
        audioData[i] = data[offset]
        /* fadein */
        if (i < 50) {
          audioData[i] = (audioData[i] * i) / 50
        }
        /* fadeout */
        if (i >= length - 51) {
          audioData[i] = (audioData[i] * decrement--) / 50
        }
        offset += this.option.channels
      }
    }

    if (this.startTime! < this.audioCtx!.currentTime) {
      this.startTime = this.audioCtx!.currentTime
    }
    this.bufferSource.buffer = audioBuffer
    this.bufferSource.connect(this.gainNode!)
    this.bufferSource.connect(this.analyserNode!) // bufferSource连接到analyser
    this.bufferSource.start(this.startTime)
    samples.startTime = this.startTime
    if (this._firstStartAbsoluteTime === undefined) {
      this._firstStartAbsoluteTime = Date.now()
    }
    if (this._firstStartRelativeTime === undefined) {
      this._firstStartRelativeTime = this.startTime
      this.ee.emit(PlayerEventTypes.Player_StartSpeaking, this)
    }
    this.startTime! += audioBuffer.duration
  }
  init(option: IOption) {
    this.option = Object.assign(this.option, option) // 实例最终配置参数
    this.convertValue = this._getConvertValue()
    this.typedArray = this._getTypedArray()
    this.initAudioContext()
  }
  initAudioContext() {
    // 初始化音频上下文的东西
    // @ts-ignore webkitAudioContext
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    // 控制音量的 GainNode
    // https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createGain
    this.gainNode = this.audioCtx.createGain()
    this.gainNode.gain.value = this.option.isMute ? 0 : 1
    this.gainNode.connect(this.audioCtx.destination)
    this.startTime = this.audioCtx.currentTime
    this.analyserNode = this.audioCtx.createAnalyser()
    this.analyserNode.fftSize = this.option.fftSize
  }
  setMute(isMute: boolean) {
    this.gainNode!.gain.value = isMute ? 0 : 1
  }
  async pause() {
    await this.audioCtx!.suspend()
  }
  async updateAutoPlay(value: boolean) {
    if (this.autoPlay !== value && value) {
      this.autoPlay = value
      this.samplesList.forEach((sample, index) => {
        this.flush(sample, index)
      })
    } else {
      this.autoPlay = value
    }
  }

  volume(volume: number) {
    this.gainNode!.gain.value = volume
  }
  _getFormattedValue(data: Int8Array | Int16Array | Int32Array | Float32Array) {
    const TargetArray = this.typedArray!
    if (data.constructor === ArrayBuffer) {
      data = new TargetArray(data)
    } else {
      data = new TargetArray(data.buffer)
    }

    const float32 = new Float32Array(data.length)

    for (let i = 0; i < data.length; i++) {
      // buffer 缓冲区的数据，需要是IEEE754 里32位的线性PCM，范围从-1到+1
      // 所以对数据进行除法
      // 除以对应的位数范围，得到-1到+1的数据
      // float32[i] = data[i] / 0x8000;
      float32[i] = data[i] / this.convertValue
    }
    return float32
  }

  private _isSupported(
    data: Int8Array | Int16Array | Int32Array | Float32Array,
  ) {
    // 数据类型是否支持
    // 目前支持 ArrayBuffer 或者 TypedArray
    if (!Player.isTypedArray(data))
      throw new Error('请传入ArrayBuffer或者任意TypedArray')
    return true
  }

  private _getConvertValue() {
    // 根据传入的目标编码位数
    // 选定转换数据所需要的基本值
    const inputCodecs = {
      Int8: 128,
      Int16: 32768,
      Int32: 2147483648,
      Float32: 1,
    }
    if (!inputCodecs[this.option.inputCodec])
      throw new Error(
        'wrong codec.please input one of these codecs:Int8,Int16,Int32,Float32',
      )
    return inputCodecs[this.option.inputCodec]
  }

  private _getTypedArray() {
    // 根据传入的目标编码位数
    // 选定前端的所需要的保存的二进制数据格式
    // 完整TypedArray请看文档
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray
    const typedArrays: ITypedArrays = {
      Int8: Int8Array,
      Int16: Int16Array,
      Int32: Int32Array,
      Float32: Float32Array,
    }
    if (!typedArrays[this.option.inputCodec])
      throw new Error(
        'wrong codec.please input one of these codecs:Int8,Int16,Int32,Float32',
      )
    return typedArrays[this.option.inputCodec]
  }
}
