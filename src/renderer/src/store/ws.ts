import { defineStore } from 'pinia'

import { createWS } from '@/apis'
import { WsEventTypes } from '@/interface/eventType'
import { StreamState } from '@/interface/voiceChat'
import { nanoid } from 'nanoid'
import type { WS } from '@/helpers/ws.js'

import { useAppStore } from './app'
import { useChatStore } from './chat'
import { useMediaStore } from './media'
import { useVisionStore } from './vision'
import { AvatarHandler } from '@renderer/handlers/avatarHandler'

type AudioProcessorNode = ScriptProcessorNode | AudioWorkletNode

interface PendingAvatarAudio {
  stream_key: string
  binary_size: number
  segment_num: number
  format: string
  sample_rate: number
  channels: number
  end_of_speech?: boolean
  parts: Blob[]
}

interface WSChatState {
  streamState: StreamState
  ws: WS | null
  sessionId: string
  audioContext: AudioContext | null
  audioProcessor: AudioProcessorNode | null
  audioSource: MediaStreamAudioSourceNode | null
  lastSpeechId: string | null
  localRendererAvatar: AvatarHandler | null
  pendingAvatarAudio: PendingAvatarAudio | null
}

function floatTo16BitPCM(
  data: Float32Array,
  inputSampleRate: number,
  targetRate = 16000
): Int16Array {
  const ratio = inputSampleRate / targetRate
  const length = Math.floor(data.length / ratio)
  const result = new Int16Array(length)
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.floor((i + 1) * ratio)
    let sum = 0
    let count = 0
    for (let j = start; j < end && j < data.length; j++) {
      sum += data[j]
      count++
    }
    const sample = count ? sum / count : 0
    const clamped = Math.max(-1, Math.min(1, sample))
    result[i] = clamped * 0x7fff
  }
  return result
}

export const useWSVideoChatStore = defineStore('wsVideoChatStore', {
  state: (): WSChatState => ({
    streamState: StreamState.closed,
    ws: null,
    sessionId: '',
    audioContext: null,
    audioProcessor: null,
    audioSource: null,
    lastSpeechId: null,
    localRendererAvatar: null,
    pendingAvatarAudio: null,
  }),
  actions: {
    async startSession() {
      if (this.streamState === StreamState.waiting) return
      const appStore = useAppStore()
      const mediaStore = useMediaStore()
      const chatStore = useChatStore()
      if (this.streamState === StreamState.closed) {
        await mediaStore.accessDevice()
        appStore.resetChatRecords()
        chatStore.replying = false
        this.sessionId = crypto.randomUUID ? crypto.randomUUID() : nanoid()
        this.streamState = StreamState.waiting
        this._createWS()
        this._initLocalAvatar()
      } else {
        this._cleanupSession()
      }
    },
    sendText(message: string) {
      if (!message || !this.localRendererAvatar) return
      const chatStore = useChatStore()
      if (this.streamState === StreamState.open && this.localRendererAvatar) {
        this.localRendererAvatar.sendSpeech(message)
      }
      chatStore.replying = true
    },
    interrupt() {
      if (!this.localRendererAvatar) return
      const chatStore = useChatStore()
      this.localRendererAvatar.interrupt()
      chatStore.replying = false
    },
    _createWS() {
      const appStore = useAppStore()
      const ws = createWS(appStore.avatarWSRoute, this.sessionId)
      ws.on(WsEventTypes.WS_OPEN, () => {
        console.log('socket opened')
        this.streamState = StreamState.open
        this._startAudioCapture()
      })
      ws.on(WsEventTypes.WS_CLOSE, () => {
        console.log('socket closed')
        this.streamState = StreamState.closed
        this._stopAudioCapture()
      })
      ws.on(WsEventTypes.WS_ERROR, (event) => {
        console.log('socket error', event)
        this.streamState = StreamState.closed
        this._stopAudioCapture()
      })
      ws.on(WsEventTypes.WS_MESSAGE, () => {
        // console.log('socket on message')
      })
      this.ws = ws
    },

    async _startAudioCapture() {
      const mediaStore = useMediaStore()
      if (!mediaStore.stream) return
      this._stopAudioCapture()
      this.audioContext = new AudioContext()
      this.audioSource = this.audioContext.createMediaStreamSource(mediaStore.stream)

      const startWorklet = async (): Promise<boolean> => {
        try {
          await this.audioContext!.audioWorklet.addModule(
            new URL('../worklets/mic-processor.js', import.meta.url)
          )
          const workletNode = new AudioWorkletNode(this.audioContext!, 'mic-processor', {
            processorOptions: { targetSampleRate: 16000 },
          })
          workletNode.port.onmessage = ({ data }) => {
            if (this.ws?.engine?.readyState !== WebSocket.OPEN) return
            if (mediaStore.micMuted) return
            if (!data?.pcm) return
            this._sendHumanAudio(new Int16Array(data.pcm))
          }
          this.audioProcessor = workletNode
          this.audioSource?.connect(workletNode)
          workletNode.connect(this.audioContext!.destination)
          return true
        } catch (error) {
          console.warn('AudioWorklet unavailable, falling back to ScriptProcessor', error)
          return false
        }
      }

      const workletStarted =
        this.audioContext.audioWorklet && typeof AudioWorkletNode !== 'undefined'
          ? await startWorklet()
          : false
      if (workletStarted) return

      const fallbackBufferSize = 2048
      const scriptNode = this.audioContext.createScriptProcessor(fallbackBufferSize, 1, 1)
      this.audioProcessor = scriptNode
      scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
        if (this.ws?.engine?.readyState !== WebSocket.OPEN) return
        if (mediaStore.micMuted) return
        const input = event.inputBuffer.getChannelData(0)
        const pcm = floatTo16BitPCM(input, this.audioContext!.sampleRate)
        this._sendHumanAudio(pcm)
      }
      this.audioSource.connect(scriptNode)
      scriptNode.connect(this.audioContext.destination)
    },
    _stopAudioCapture() {
      this.audioProcessor?.disconnect()
      this.audioSource?.disconnect()
      if (this.audioContext?.state !== 'closed') {
        this.audioContext?.close()
      }
      this.audioProcessor = null
      this.audioSource = null
      this.audioContext = null
    },
    _sendHumanAudio(pcm: Int16Array) {
      if (!this.localRendererAvatar) return
      this.localRendererAvatar.sendAudio(pcm, 'base64')
    },

    _cleanupSession() {
      const chatStore = useChatStore()
      this.streamState = StreamState.closed
      chatStore.replying = false
      this._stopAudioCapture()
      if (this.localRendererAvatar) {
        this.localRendererAvatar.exit()
        this.localRendererAvatar.removeAllListeners()
        this.localRendererAvatar = null
        chatStore.setActiveRenderer(null)
      }
      if (this.ws) {
        this.ws.stop()
        this.ws = null
      }
    },
    _initLocalAvatar() {
      const appStore = useAppStore()
      const visionStore = useVisionStore()
      const chatStore = useChatStore()
      const renderer = new AvatarHandler({
        container: visionStore.remoteVideoContainerRef!,
        assetsPath: appStore.avatarAssetsPath,
        ws: this.ws as WS,
        rendererType: appStore.avatarType,
      })

      chatStore.bindAvatarHandler(renderer)
      chatStore.setActiveRenderer(renderer)

      this.localRendererAvatar = renderer
    },
  },
})
