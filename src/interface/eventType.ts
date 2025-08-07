export enum EventTypes {
  'ErrorReceived' = 'ErrorReceived',
  'MessageReceived' = 'MessageReceived',
  'StartSpeech' = 'StartSpeech',
  'EndSpeech' = 'EndSpeech',
  'StateChanged' = 'StateChanged',
}

export enum WsEventTypes {
  'WS_CLOSE' = 'WS_CLOSE',
  'WS_ERROR' = 'WS_ERROR',
  'WS_MESSAGE' = 'WS_MESSAGE',
  'WS_OPEN' = 'WS_OPEN',
}

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
