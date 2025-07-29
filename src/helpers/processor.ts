import EventEmitter from 'eventemitter3'
import PQueue from 'p-queue'

import {
  EventTypes,
  PlayerEventTypes,
  ProcessorEventTypes,
} from '../interface/eventType'
import { unpack } from '../utils/binaryUtils'
import { Player } from './player'

export type IPayload = Record<string, string | number | object | Blob>

interface IDataRecords {
  channel_names?: string[]
  data_id: number
  data_offset: number
  data_type: string
  sample_rate: number
  shape: number[]
}
interface IEvent {
  avatar_status?: string
  event_type: string
  speech_id: string
}
interface IParsedData {
  batch_id?: number
  batch_name?: string
  data_records: Record<string, IDataRecords>
  end_of_batch: boolean
  events: IEvent[]
}
interface IAvatarMotionData {
  // 数据大小，首包存在该值
  binary_size: number
  // 是否首包
  first_package: boolean
  // 数据分片，非首包存在该值
  motion_data_slice?: Blob
  // 分片数量，首包存在该值
  segment_num?: number
  // 分片索引，非首包存在该值
  slice_index?: number
  // 是否使用二进制帧，首包存在该值
  use_binary_frame?: boolean
  // 初始化的音频是否静音
  is_audio_mute?: boolean
}

interface IAvatarMotionGroupBase {
  arkitFaceArrayBufferArray?: ArrayBuffer[]
  batch_id?: number
  batch_name?: string
  binSize?: number
  jsonSize?: number
  merged_motion_data: Uint8Array
  motion_data_slices: Blob[]
  player?: Player
  tts2faceArrayBufferArray?: ArrayBuffer[]
}
interface IAvatarMotionGroup extends IAvatarMotionGroupBase {
  binary_size: number
  first_package: boolean
  segment_num?: number
  use_binary_frame?: boolean
}
const InputCodecs: Record<string, 'Int8' | 'Int16' | 'Int32' | 'Float32'> = {
  int16: 'Int16',
  int32: 'Int32',
  float32: 'Float32',
}
const TypedArrays: Record<
  string,
  typeof Int16Array | typeof Int32Array | typeof Float32Array
> = {
  int16: Int16Array,
  int32: Int32Array,
  float32: Float32Array,
}

export class Processor {
  private ee: EventEmitter
  private _motionDataGroupHandlerQueue = new PQueue({
    concurrency: 1,
  })
  private _motionDataGroups: IAvatarMotionGroup[] = []
  private _arkit_face_sample_rate?: number
  private _arkit_face_channel_names?: string[]
  private _tts2face_sample_rate?: number
  private _tts2face_channel_names?: string[]
  private _maxBatchId?: number
  private _arkitFaceShape?: number
  private _tts2FaceShape?: number
  constructor(ee: EventEmitter) {
    this.ee = ee
  }
  add(payload: IPayload) {
    const { avatar_motion_data } = payload
    this._motionDataGroupHandlerQueue.add(
      async () =>
        await this._motionDataGroupHandler(
          avatar_motion_data as IAvatarMotionData,
        ),
    )
  }
  clear() {
    this._motionDataGroups.forEach((group) => {
      group.player?.destroy()
    })
    this._motionDataGroups = []
  }
  setMute(isMute: boolean) {
    this._motionDataGroups.forEach((group) => {
      group.player?.setMute(isMute)
    })
  }
  getArkitFaceFrame() {
    return {
      arkitFace: this._getArkitFaceFrame(),
    }
  }
  getLastBatchId() {
    let batch_id
    this._motionDataGroups.forEach((group) => {
      if (group.batch_id) {
        batch_id = group.batch_id
      }
    })
    return batch_id
  }
  getTtt2FaceFrame() {
    return {
      tts2Face: this._getTts2FaceFrame(),
    }
  }

  interrupt() {
    this._motionDataGroups.forEach((group) => {
      if (group.batch_id) {
        this._maxBatchId = group.batch_id
      }
      group.player?.destroy()
    })
    this._motionDataGroups = []
  }

  private _getArkitFaceFrame() {
    if (!this._motionDataGroups.length) {
      return null
    }
    const targetMotion = this._motionDataGroups.find(
      (_motion) => _motion.player,
    )

    if (!targetMotion) {
      return null
    }
    const { arkitFaceArrayBufferArray, player } = targetMotion!
    if (
      player &&
      player._firstStartAbsoluteTime &&
      arkitFaceArrayBufferArray &&
      arkitFaceArrayBufferArray.length > 0 &&
      this._arkitFaceShape &&
      this._arkit_face_sample_rate
    ) {
      const offsetTime = Date.now() - player._firstStartAbsoluteTime
      let lastIndex = 0
      let firstSampleStartTime: number
      player.samplesList.forEach((item, index) => {
        if (
          firstSampleStartTime === undefined &&
          item.startTime !== undefined
        ) {
          firstSampleStartTime = item.startTime
        }
        if (
          item.startTime !== undefined &&
          item.startTime - firstSampleStartTime <= offsetTime / 1000
        ) {
          lastIndex = index
        }
      })
      const samples = player.samplesList[lastIndex]
      const subOffsetTime = offsetTime - samples.startTime! * 1000
      const offset = Math.floor(
        (subOffsetTime / 1000) * this._arkit_face_sample_rate,
      )
      const arkitFaceFloat32ArrayArray = new Float32Array(
        arkitFaceArrayBufferArray[lastIndex],
      )
      const subData = arkitFaceFloat32ArrayArray?.slice(
        offset * this._arkitFaceShape,
        offset * this._arkitFaceShape + this._arkitFaceShape,
      )
      if (subData?.length) {
        const result = {}
        const channelNames = this._arkit_face_channel_names || []
        channelNames.forEach((channelName, index) => {
          Object.assign(result, {
            [channelName]: subData[index],
          })
        })
        return result
      }
      return null
    }
    return null
  }
  private _getTts2FaceFrame() {
    if (!this._motionDataGroups.length) {
      return null
    }
    const targetMotion = this._motionDataGroups.find(
      (_motion) => _motion.player,
    )
    if (!targetMotion) {
      return null
    }
    const { tts2faceArrayBufferArray, player } = targetMotion!
    if (
      player &&
      player._firstStartAbsoluteTime &&
      tts2faceArrayBufferArray &&
      tts2faceArrayBufferArray.length > 0 &&
      this._tts2FaceShape &&
      this._tts2face_sample_rate
    ) {
      const offsetTime = Date.now() - player._firstStartAbsoluteTime
      let lastIndex = 0
      let firstSampleStartTime: number
      player.samplesList.forEach((item, index) => {
        if (
          firstSampleStartTime === undefined &&
          item.startTime !== undefined
        ) {
          firstSampleStartTime = item.startTime
        }
        if (
          item.startTime !== undefined &&
          item.startTime - firstSampleStartTime <= offsetTime / 1000
        ) {
          lastIndex = index
        }
      })
      const samples = player.samplesList[lastIndex]
      const subOffsetTime = offsetTime - samples.startTime! * 1000
      const offset = Math.floor(
        (subOffsetTime / 1000) * this._tts2face_sample_rate,
      )
      const arkitFaceFloat32ArrayArray = new Float32Array(
        tts2faceArrayBufferArray[lastIndex],
      )
      const subData = arkitFaceFloat32ArrayArray?.slice(
        offset * this._tts2FaceShape,
        offset * this._tts2FaceShape + this._tts2FaceShape,
      )
      if (subData?.length) {
        return subData
      }
      return null
    }
    return null
  }

  private async _motionDataGroupHandler(avatar_motion_data: IAvatarMotionData) {
    try {
      const {
        first_package,
        motion_data_slice,
        segment_num,
        binary_size,
        use_binary_frame,
        is_audio_mute,
      } = avatar_motion_data
      if (first_package) {
        const lastMotionGroup =
          this._motionDataGroups[this._motionDataGroups.length - 1]
        if (lastMotionGroup) {
          // 检测上一大片数量是否丢包
          if (
            lastMotionGroup.segment_num !==
            lastMotionGroup.motion_data_slices.length
          ) {
            // 丢包触发错误
            this.ee.emit(EventTypes.ErrorReceived, 'lost data packets')
          }
        }
        this._motionDataGroups.push({
          first_package,
          binary_size,
          segment_num,
          use_binary_frame,
          motion_data_slices: [],
          merged_motion_data: new Uint8Array(binary_size),
        })
      } else {
        if (this._motionDataGroups.length === 0) {
          return
        }
        if (!motion_data_slice) {
          return
        }
        const lastMotionGroup =
          this._motionDataGroups[this._motionDataGroups.length - 1]
        const prevMotionGroup =
          this._motionDataGroups[this._motionDataGroups.length - 2]
        lastMotionGroup.motion_data_slices.push(motion_data_slice)
        if (
          lastMotionGroup.motion_data_slices.length ===
          lastMotionGroup.segment_num
        ) {
          // 单段不分小片段的情况，不需要mergeBlob，为了兼容后续逻辑，这里直接赋值
          const blob = lastMotionGroup.motion_data_slices[0]
          // const blob = mergeBlob(
          //   lastMotionGroup.motion_data_slices,
          //   lastMotionGroup.merged_motion_data,
          // );
          const { parsedData, jsonSize, binSize } = await unpack(blob)
          lastMotionGroup.jsonSize = jsonSize
          lastMotionGroup.binSize = binSize
          const bin = blob.slice(12 + lastMotionGroup.jsonSize!)
          if (bin.size !== lastMotionGroup.binSize) {
            this.ee.emit(ProcessorEventTypes.Chat_BinsizeError)
          }
          const batchCheckResult = this._connectBatch(
            parsedData,
            lastMotionGroup,
            prevMotionGroup,
          )
          if (!batchCheckResult) {
            return
          }
          await this._handleArkitFaceConfig(
            parsedData,
            lastMotionGroup,
            prevMotionGroup,
            bin,
          )
          // await this._handletts2faceConfig(
          //   parsedData,
          //   lastMotionGroup,
          //   prevMotionGroup,
          //   bin,
          // );
          await this._handleAudioConfig(
            parsedData,
            lastMotionGroup,
            prevMotionGroup,
            bin,
            is_audio_mute || false,
          )
          this._handleEvents(parsedData)
        }
      }
    } catch (err: unknown) {
      console.error('err', err)
      this.ee.emit(EventTypes.ErrorReceived, (err as Error).message)
    }
  }
  private async _handleAudioConfig(
    parsedData: IParsedData,
    lastMotionGroup: IAvatarMotionGroup,
    prevMotionGroup: IAvatarMotionGroup,
    bin: Blob,
    isPlayerMute: boolean,
  ) {
    const { data_records = {}, end_of_batch } = parsedData
    const { audio } = data_records
    if (audio) {
      const { sample_rate, shape, data_offset, data_type } = audio
      const inputCodec = InputCodecs[data_type]
      const TargetTypedArray = TypedArrays[data_type]
      if (lastMotionGroup.player === undefined) {
        if (
          prevMotionGroup &&
          prevMotionGroup.player &&
          prevMotionGroup.batch_id === lastMotionGroup.batch_id
        ) {
          lastMotionGroup.player = prevMotionGroup.player
        } else if (sample_rate) {
          lastMotionGroup.player = new Player(
            {
              inputCodec,
              channels: 1,
              sampleRate: sample_rate,
              fftSize: 1024,
              isMute: isPlayerMute,
              onended: (option) => {
                if (!option) {
                  return
                }
                const {
                  end_of_batch: innerEndOfBatch,
                  lastMotionGroup: innerLastMotion,
                } = option
                if (innerEndOfBatch) {
                  const { batch_id, player } =
                    innerLastMotion as IAvatarMotionGroup
                  this.ee.emit(PlayerEventTypes.Player_EndSpeaking, player)
                  this._motionDataGroups = this._motionDataGroups.filter(
                    (item) => item.batch_id! > batch_id!,
                  )
                  if (
                    this._motionDataGroups.length &&
                    this._motionDataGroups[0].player
                  ) {
                    this._motionDataGroups[0].player.updateAutoPlay(true)
                  } else {
                    this.ee.emit(PlayerEventTypes.Player_NoLegacy)
                  }
                }
              },
            },
            this.ee,
          )
        }
        if (end_of_batch) {
          const originEnded = lastMotionGroup.player!.option.onended
          lastMotionGroup.player!.option.onended = () => {
            originEnded({
              end_of_batch,
              lastMotionGroup,
            })
          }
        }
      }
      const shapeLength = shape.reduce(
        (acc: number, cur: number) => acc * cur,
        inputCodec === 'Int16' ? 2 : 4,
      )
      const audioBlobSliceStart = data_offset
      const audioBlobSliceEnd = data_offset + shapeLength
      const audioBlob = bin.slice(audioBlobSliceStart, audioBlobSliceEnd)
      const audioArrayBuffer = await audioBlob.arrayBuffer()
      // 如果前一段还没播放结束，后一段已接收到，那么后一段则不能自动播放
      const prevHasPlayerMotionDataGroup = this._motionDataGroups.find(
        (item) => item.player,
      )
      if (
        this._motionDataGroups.length &&
        lastMotionGroup.player &&
        prevHasPlayerMotionDataGroup &&
        prevHasPlayerMotionDataGroup.player !== lastMotionGroup.player
      ) {
        lastMotionGroup.player.autoPlay = false
      }
      if (lastMotionGroup.player) {
        lastMotionGroup.player.feed({
          audio: new TargetTypedArray(audioArrayBuffer),
          end_of_batch,
        })
      }
    } else if (
      // 特殊事件motion挂上这个
      prevMotionGroup &&
      prevMotionGroup.player &&
      lastMotionGroup.batch_id === prevMotionGroup.batch_id
    ) {
      lastMotionGroup.player = prevMotionGroup.player
    }
  }
  private async _handleArkitFaceConfig(
    parsedData: IParsedData,
    lastMotionGroup: IAvatarMotionGroup,
    prevMotionGroup: IAvatarMotionGroup,
    bin: Blob,
  ) {
    const { data_records = {} } = parsedData
    const { arkit_face } = data_records
    if (arkit_face) {
      const { channel_names, shape, data_offset, sample_rate } =
        arkit_face as IDataRecords
      if (channel_names && !this._arkit_face_channel_names) {
        this._arkit_face_channel_names = channel_names
        this._arkit_face_sample_rate = sample_rate
      }
      if (lastMotionGroup.arkitFaceArrayBufferArray === undefined) {
        if (
          prevMotionGroup &&
          prevMotionGroup.arkitFaceArrayBufferArray &&
          prevMotionGroup.batch_id === lastMotionGroup.batch_id
        ) {
          lastMotionGroup.arkitFaceArrayBufferArray =
            prevMotionGroup.arkitFaceArrayBufferArray
        } else {
          lastMotionGroup.arkitFaceArrayBufferArray = []
        }
        const shapeLength = shape.reduce(
          (acc: number, cur: number) => acc * cur,
          4,
        )
        this._arkitFaceShape = shape[1]
        const arkitFaceBlob = bin.slice(data_offset, data_offset + shapeLength)
        const arkitFaceArrayBuffer = await arkitFaceBlob.arrayBuffer()
        lastMotionGroup.arkitFaceArrayBufferArray.push(arkitFaceArrayBuffer)
      }
    } else if (
      prevMotionGroup &&
      prevMotionGroup.arkitFaceArrayBufferArray &&
      lastMotionGroup.batch_id === prevMotionGroup.batch_id
    ) {
      lastMotionGroup.arkitFaceArrayBufferArray =
        prevMotionGroup.arkitFaceArrayBufferArray
    }
  }
  private async _handletts2faceConfig(
    parsedData: IParsedData,
    lastMotionGroup: IAvatarMotionGroup,
    prevMotionGroup: IAvatarMotionGroup,
    bin: Blob,
  ) {
    const { data_records = {} } = parsedData
    const { tts2face } = data_records
    if (tts2face) {
      const { channel_names, shape, data_offset, sample_rate } =
        tts2face as IDataRecords
      if (channel_names && !this._tts2face_channel_names) {
        this._tts2face_channel_names = channel_names
        this._tts2face_sample_rate = sample_rate
      }
      if (lastMotionGroup.tts2faceArrayBufferArray === undefined) {
        if (
          prevMotionGroup &&
          prevMotionGroup.tts2faceArrayBufferArray &&
          prevMotionGroup.batch_id === lastMotionGroup.batch_id
        ) {
          lastMotionGroup.tts2faceArrayBufferArray =
            prevMotionGroup.tts2faceArrayBufferArray
        } else {
          lastMotionGroup.tts2faceArrayBufferArray = []
        }
        const shapeLength = shape.reduce(
          (acc: number, cur: number) => acc * cur,
          4,
        )
        this._tts2FaceShape = shape[1]
        const tts2faceBlob = bin.slice(data_offset, data_offset + shapeLength)
        const tts2faceArrayBuffer = await tts2faceBlob.arrayBuffer()
        lastMotionGroup.tts2faceArrayBufferArray.push(tts2faceArrayBuffer)
      }
    } else if (
      prevMotionGroup &&
      prevMotionGroup.tts2faceArrayBufferArray &&
      lastMotionGroup.batch_id === prevMotionGroup.batch_id
    ) {
      lastMotionGroup.tts2faceArrayBufferArray =
        prevMotionGroup.tts2faceArrayBufferArray
    }
  }

  private _handleEvents(parsedData: IParsedData) {
    const { events } = parsedData
    if (events && events.length) {
      events.forEach((e) => {
        switch (e.event_type) {
          case 'interrupt_speech':
            // console.log('HandleEvents: interrupt_speech')
            break
          case 'change_status':
            // console.log('HandleEvents: change_status')
            this.ee.emit(ProcessorEventTypes.Change_Status, e)
            break
          default:
            break
        }
      })
    }
  }
  private _connectBatch(
    parsedData: IParsedData,
    lastMotionGroup: IAvatarMotionGroup,
    prevMotionGroup: IAvatarMotionGroup,
  ) {
    let batchCheckResult = true
    // 处理二进制batch_id
    if (parsedData.batch_id && lastMotionGroup.batch_id === undefined) {
      lastMotionGroup.batch_id = parsedData.batch_id
    }
    // 特殊事件motion如果没有batch_id，也可挂上此batch_id
    if (
      !lastMotionGroup.batch_id &&
      prevMotionGroup &&
      prevMotionGroup.batch_id
    ) {
      lastMotionGroup.batch_id = prevMotionGroup.batch_id
    }
    // 特殊事件motion如果没有batch_name，也可挂上此batch_name
    if (parsedData.batch_name && lastMotionGroup.batch_name === undefined) {
      lastMotionGroup.batch_name = parsedData.batch_name
    }
    // 处理打断后，如果仍接收到上一个batch的motionData, 那么重新销毁
    if (
      this._maxBatchId &&
      lastMotionGroup.batch_id &&
      lastMotionGroup.batch_id <= this._maxBatchId
    ) {
      this.clear()
      batchCheckResult = false
    }
    return batchCheckResult
  }
}
