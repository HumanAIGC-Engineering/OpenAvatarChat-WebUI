export type Timestamp = [number, number] | number | undefined

export type ChatRole = 'human' | 'avatar'

export type DataToolStream = {
  data_type?: string
  builder_id?: number
  stream_id?: number
  name?: string | null
  producer?: string | null
  stream_meta?: ChatDataMeta
}

export type ChatDataMeta = Record<string, unknown>

export type ChatDataEvent = {
  event: 'chat_data'
  session_id: string
  owner: string
  data_type:
    | 'avatar_audio'
    | 'avatar_text'
    | 'human_audio'
    | 'human_text'
    | 'camera_video'
    | 'human_duplex_audio'
    | 'human_duplex_text'
  timestamp: Timestamp
  is_first?: boolean
  is_last?: boolean
  source?: string
  stream?: DataToolStream
  start_of_stream?: boolean
  end_of_stream?: boolean
  meta?: ChatDataMeta
  stream_meta?: ChatDataMeta
  data?: {
    kind?: string
    main_entry?: string
    shape?: number[]
    dtype?: string
    text?: string
    preview_base64?: string
    sample_rate?: number
    channels?: number
    file_path?: string
    [key: string]: unknown
  }
  ref_streams?: DataToolStream[]
}

export type SignalEvent = {
  event: 'signal'
  session_id: string
  owner: string
  timestamp: number
  type: 'stream_end' | 'stream_begin' | 'interrupt'
  source_type?: string
  source_name?: string
  stream?: DataToolStream
  ref_streams?: DataToolStream[]
  payload?: Record<string, unknown>
}

export type SnapshotEvent = {
  event: 'snapshot'
  items?: Array<ChatDataEvent | SignalEvent>
}

export type CurrentConfig = {
  model_root?: string
  concurrent_limit?: number
  handler_search_path?: string[]
  logic_search_path?: string[]
  handler_configs?: Record<string, Record<string, unknown>>
  logic_configs?: Record<string, Record<string, unknown>>
  outputs?: Record<
    string,
    {
      handler?: string | string[] | null
      type?: string
      [key: string]: unknown
    }
  >
  turn_config?: Record<string, unknown>
  [key: string]: unknown
}

export type CurrentConfigEvent = {
  event: 'current_config'
  config: CurrentConfig
}

export type IncomingMessage = ChatDataEvent | SignalEvent | SnapshotEvent | CurrentConfigEvent

export type SessionMessage = {
  id: string
  kind: 'chat_data' | 'signal'
  ts: number
  tsDisplay: string
  sessionId: string
  owner?: string
  dataType?: ChatDataEvent['data_type']
  stream?: DataToolStream
  flags?: {
    start?: boolean
    end?: boolean
    first?: boolean
    last?: boolean
  }
  text?: string
  filePath?: string
  previewBase64?: string
  mediaUrl?: string
  mediaType?: 'audio' | 'image'
  sampleRate?: number
  channels?: number
  meta?: ChatDataMeta
  stream_meta?: ChatDataMeta
  payload?: Record<string, unknown>
  signalType?: string
  error?: string
  loadingMedia?: boolean
  ref_streams?: DataToolStream[]
}
export type VisibleMessage = ChatMessage | SignalMessage

export type ChatMessage = {
  type: 'chat_message'
  text: string
  originalText?: string
  role: ChatRole
  textStream?: DataToolStream
  audioStream?: DataToolStream
  audioUrl?: string
  imageUrl?: string
  timestamp?: number
}

export type SignalMessage = {
  type: 'signal_message'
  signalType: string
  payload: Record<string, unknown>
}
export type SessionState = {
  id: string
  owner?: string
  messages: SessionMessage[]
  chatMessages: ChatMessage[]
  lastUpdated: number
}

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

// Vue Flow types for signal visualization
export type FlowNodeStatus = 'active' | 'inactive' | 'timeout'

export type FlowNode = {
  id: string // source_name as unique key
  type: 'handler'
  position: { x: number; y: number }
  data: {
    label: string
    sourceType: string
    sourceName?: string
    status: FlowNodeStatus
    lastUpdated: number
    activeStartTime?: number // Time when node became active
    startTime?: number // 信号中给的时间戳，用于计算耗时
    endTime?: number // 信号中给的时间戳，用于计算耗时
  }
}

export type FlowEdge = {
  id: string
  source: string
  target: string
  animated: boolean // true when data is flowing
  data?: {
    refStreamId?: string
  }
}
