export enum EventTypes {
  'InterruptSpeech' = 'InterruptSpeech',
  'ErrorReceived' = 'ErrorReceived',
  'MessageReceived' = 'MessageReceived',
  'SignalReceived' = 'SignalReceived',
  'StartSpeech' = 'StartSpeech',
  'EndSpeech' = 'EndSpeech',
  'StateChanged' = 'StateChanged',
}

// WebSocket protocol header names
export enum WsProtocol {
  InitializeAvatarSession = 'InitializeAvatarSession',
  SendHumanAudio = 'SendHumanAudio',
  SendHumanVideo = 'SendHumanVideo',
  SendHumanText = 'SendHumanText',
  TriggerHeartbeat = 'TriggerHeartbeat',
  Interrupt = 'Interrupt',
  EndSpeech = 'EndSpeech',
  AvatarSessionInitialized = 'AvatarSessionInitialized',
  EchoHumanText = 'EchoHumanText',
  EchoAvatarText = 'EchoAvatarText',
  EchoAvatarAudio = 'EchoAvatarAudio',
  EchoHumanAudio = 'EchoHumanAudio',
  AvatarHeartbeat = 'AvatarHeartbeat',
  MotionDataWelcome = 'MotionDataWelcome',
  MotionData = 'MotionData',
  Error = 'Error',
  InterruptAccepted = 'InterruptAccepted', // 打断成功通知
  InterruptNotification = 'InterruptNotification', // 双工打断通知
  ChatSignal = 'ChatSignal',
}

export enum WsEventTypes {
  'WS_CLOSE' = 'WS_CLOSE',
  'WS_ERROR' = 'WS_ERROR',
  'WS_MESSAGE' = 'WS_MESSAGE',
  'WS_OPEN' = 'WS_OPEN',
}

export type SubscriptionType =
  | 'human_text'
  | 'avatar_text'
  | 'avatar_audio'
  | 'human_audio'
  | 'motion_data'

export interface InitializeAvatarSessionPayload {
  audio: {
    format: string
    sample_rate: number
    channels: number
  }
  subscriptions?: SubscriptionType[]
}

export type TransportType = 'binary' | 'base64'

interface BinaryTransportPayload {
  transport: 'binary'
  binary_size: number
  segment_num: number
}

interface Base64TransportPayload {
  transport: 'base64'
  data_base64: string
}

export type SendHumanAudioPayload = BinaryTransportPayload | Base64TransportPayload

export type ImageFormat = 'JPEG' | 'JPG' | 'PNG' | string

export type SendHumanVideoPayload =
  | (BinaryTransportPayload & {
      width: number
      height: number
      format: ImageFormat
    })
  | (Base64TransportPayload & {
      width: number
      height: number
      format: ImageFormat
    })

export type TextMode = 'increment' | 'full_text'

export interface TextMetadata {
  continue_from_stream: string
  [key: string]: unknown
}

export interface TextPayload {
  request_id: string
  stream_key: string
  mode: TextMode
  text: string
  end_of_speech: boolean
  metadata?: TextMetadata
}

export type SendHumanTextPayload = TextPayload

export interface InterruptPayload {
  maxBatchId?: number
}

export interface EndSpeechPayload {
  stream_key: string
}

export type EchoHumanTextPayload = TextPayload
export type EchoAvatarTextPayload = TextPayload
export type EchoHumanAudioPayload = EchoAvatarAudioPayload

export type EchoAvatarAudioPayload =
  | (BinaryTransportPayload & {
      stream_key: string
      format: string
      sample_rate: number
      channels: number
      end_of_speech: boolean
    })
  | (Base64TransportPayload & {
      stream_key: string
      format: string
      sample_rate: number
      channels: number
      end_of_speech: boolean
    })

export interface MotionDataBinaryInfo {
  binary_size: number
  segment_num: number
}

export type MotionEventType = 'start_avatar_speaking' | 'end_avatar_speaking' | 'interrupt_speech'

export interface MotionDataEvent {
  event_type: MotionEventType
  event_subtype?: string | null
  event_data_type?: string | null
  event_data?: unknown
  event_time: number
  event_time_unit: number
}

export interface MotionDataDescription {
  data_records?: Record<
    string,
    {
      data_type: string
      data_offset: number
      shape: number[]
      sample_rate: number
      data_id: number
      timeline_axis?: number
      channel_axis?: number
      channel_names?: string[]
    }
  >
  metadata?: {
    stream_key?: string
    avatar_speech_text?: string
    [key: string]: unknown
  }
  events?: MotionDataEvent[]
  timestamp?: [number, number] | null
  end_sample_id?: number | null
  batch_name?: string | null
  batch_id?: number | null
  start_of_batch?: boolean | null
  end_of_batch?: boolean
}

export interface MotionDataPayload {
  stream_key: string
  motion_data: MotionDataBinaryInfo
  end_of_speech: boolean
  description?: MotionDataDescription
}

export type ErrorCode =
  | 'INVALID_SESSION'
  | 'AUDIO_FORMAT_ERROR'
  | 'VIDEO_FORMAT_ERROR'
  | 'HEARTBEAT_TIMEOUT'
  | 'INTERNAL_ERROR'
  | 'RATE_LIMIT'
  | string

export interface ErrorPayload {
  code: ErrorCode
  message: string
}

export type SignalType = 'stream_begin' | 'stream_end' | 'stream_cancel' | 'interrupt' | string

export interface SignalData {
  stream_metadata?: Record<string, unknown>
  [key: string]: unknown
}

export interface SignalBody {
  timestamp: number
  type: SignalType
  source_type: string
  stream_type?: string
  stream_producer?: string
  stream_key?: string
  parent_stream_keys?: string[]
  signal_data?: SignalData
}

export interface SignalPayload {
  header: {
    name: 'ChatSignal'
    request_id: string
  }
  payload: SignalBody
}

export type WsPayloadMap = {
  [WsProtocol.InitializeAvatarSession]: InitializeAvatarSessionPayload
  [WsProtocol.SendHumanAudio]: SendHumanAudioPayload
  [WsProtocol.SendHumanVideo]: SendHumanVideoPayload
  [WsProtocol.SendHumanText]: SendHumanTextPayload
  [WsProtocol.TriggerHeartbeat]: undefined
  [WsProtocol.Interrupt]: InterruptPayload
  [WsProtocol.EndSpeech]: EndSpeechPayload
  [WsProtocol.AvatarSessionInitialized]: undefined
  [WsProtocol.EchoHumanText]: EchoHumanTextPayload
  [WsProtocol.EchoAvatarText]: EchoAvatarTextPayload
  [WsProtocol.EchoAvatarAudio]: EchoAvatarAudioPayload
  [WsProtocol.EchoHumanAudio]: EchoHumanAudioPayload
  [WsProtocol.AvatarHeartbeat]: undefined
  [WsProtocol.MotionData]: MotionDataPayload
  [WsProtocol.MotionDataWelcome]: MotionDataPayload
  [WsProtocol.Error]: ErrorPayload
  [WsProtocol.InterruptAccepted]: undefined
  [WsProtocol.InterruptNotification]: undefined
  [WsProtocol.ChatSignal]: SignalBody
}

export type WsHeader<T extends WsProtocol> = {
  name: T
  request_id: string
}

export type WsMessage<T extends WsProtocol> = WsPayloadMap[T] extends undefined
  ? { header: WsHeader<T> }
  : { header: WsHeader<T>; payload: WsPayloadMap[T] }

export type WsInboundMessage = WsMessage<
  | WsProtocol.AvatarSessionInitialized
  | WsProtocol.EchoHumanText
  | WsProtocol.EchoAvatarText
  | WsProtocol.EchoAvatarAudio
  | WsProtocol.EchoHumanAudio
  | WsProtocol.AvatarHeartbeat
  | WsProtocol.MotionData
  | WsProtocol.Error
  | WsProtocol.InterruptAccepted
  | WsProtocol.MotionDataWelcome
  | WsProtocol.InterruptNotification
  | WsProtocol.ChatSignal
>

export type WsOutboundMessage = WsMessage<
  | WsProtocol.InitializeAvatarSession
  | WsProtocol.SendHumanAudio
  | WsProtocol.SendHumanVideo
  | WsProtocol.SendHumanText
  | WsProtocol.TriggerHeartbeat
  | WsProtocol.Interrupt
  | WsProtocol.EndSpeech
>

export enum PlayerEventTypes {
  // Player没断
  'Player_EndSpeaking' = 'Player_EndSpeaking',
  'Player_NoLegacy' = 'Player_NoLegacy',
  // Player相关
  'Player_StartSpeaking' = 'Player_StartSpeaking',
  'Player_WaitNextAudioClip' = 'Player_WaitNextAudioClip',
}
// 端测渲染(端到端)、单独输出数字人处理核心数据Processor相关的事件
export enum ProcessorEventTypes {
  'Change_Status' = 'Change_Status',
  'Chat_BinsizeError' = 'Chat_BinsizeError',
}
