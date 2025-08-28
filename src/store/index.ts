import { WS } from '@/helpers/ws'
import { WsEventTypes } from '@/interface/eventType'
import { StreamState } from '@/interface/voiceChat'
import { GaussianAvatar } from '@/utils/gaussianAvatar'
import {
  createSimulatedAudioTrack,
  createSimulatedVideoTrack,
  getDevices,
  getStream,
  setAvailableDevices,
} from '@/utils/streamUtils'
import { setupWebRTC, stop } from '@/utils/webrtcUtils'
import { message } from 'ant-design-vue'
import { defineStore } from 'pinia'
import { useVisionStore } from './vision'

const track_constraints = {
  video: {
    width: 500,
    height: 500,
  },
  audio: true,
}

interface VideoChatState {
  devices: MediaDeviceInfo[]
  availableVideoDevices: MediaDeviceInfo[]
  availableAudioDevices: MediaDeviceInfo[]
  selectedVideoDevice: MediaDeviceInfo | null
  selectedAudioDevice: MediaDeviceInfo | null
  streamState: StreamState
  stream: MediaStream | null
  peerConnection: RTCPeerConnection | null
  localStream: MediaStream | null
  webcamAccessed: boolean
  webRTCId: string

  avatarType: '' | 'lam'
  avatarWSRoute: string
  avatarAssetsPath: string
  rtcConfig: RTCConfiguration | undefined
  trackConstraints:
    | {
        video: MediaTrackConstraints | boolean
        audio: MediaTrackConstraints | boolean
      }
    | undefined
  gsLoadPercent: number

  volumeMuted: boolean
  micMuted: boolean
  cameraOff: boolean

  hasCamera: boolean
  hasCameraPermission: boolean
  hasMic: boolean
  hasMicPermission: boolean
  showChatRecords: boolean

  localAvatarRenderer: any

  chatDataChannel: RTCDataChannel | null
  replying: boolean
  chatRecords: Array<{ id: string; role: 'human' | 'avatar'; message: string }>
}

export const useVideoChatStore = defineStore('videoChatStore', {
  state: (): VideoChatState => {
    return {
      devices: [],
      availableVideoDevices: [],
      availableAudioDevices: [],
      selectedVideoDevice: null,
      selectedAudioDevice: null,
      streamState: StreamState.closed,
      stream: null,
      peerConnection: null,
      localStream: null,
      webRTCId: '',
      webcamAccessed: false,
      avatarType: '',
      avatarWSRoute: '',
      avatarAssetsPath: '',
      rtcConfig: undefined,
      trackConstraints: track_constraints,
      gsLoadPercent: 0,
      volumeMuted: false,
      micMuted: false,
      cameraOff: false,
      hasCamera: false,
      hasCameraPermission: true,
      hasMic: false,
      hasMicPermission: true,
      showChatRecords: false,

      localAvatarRenderer: null,

      chatDataChannel: null,
      replying: false,
      chatRecords: [],
    }
  },
  getters: {},
  actions: {
    async accessDevice() {
      try {
        const visionState = useVisionStore()
        const node = visionState.localVideoRef
        this.micMuted = false
        this.cameraOff = false
        this.volumeMuted = false
        if (!navigator.mediaDevices) {
          message.error('无法获取媒体设备，请确保用localhost访问或https协议访问')
          return
        }
        await navigator.mediaDevices
          .getUserMedia({
            audio: true,
          })
          .catch(() => {
            console.log('no audio permission')
            this.hasMicPermission = false
          })
        await navigator.mediaDevices
          .getUserMedia({
            video: true,
          })
          .catch(() => {
            console.log('no video permission')
            this.hasCameraPermission = false
          })
        const devices = await getDevices()
        this.devices = devices
        console.log('🚀 ~ access_webcam ~ devices:', devices)
        const videoDeviceId =
          this.selectedVideoDevice &&
          devices.some((device) => device.deviceId === this.selectedVideoDevice?.deviceId)
            ? this.selectedVideoDevice.deviceId
            : ''
        const audioDeviceId =
          this.selectedAudioDevice &&
          devices.some((device) => device.deviceId === this.selectedAudioDevice?.deviceId)
            ? this.selectedAudioDevice.deviceId
            : ''
        console.log(videoDeviceId, audioDeviceId, ' access web device')
        this.fillStream(audioDeviceId, videoDeviceId)
        this.webcamAccessed = true
      } catch (err: any) {
        console.log(err)
        message.error(err)
      }
    },
    async init() {
      fetch('/openavatarchat/initconfig')
        .then((res) => res.json())
        .then((config) => {
          if (config.rtc_configuration) {
            this.rtcConfig = config.rtc_configuration
          }

          console.log(config)
          if (config.avatar_config) {
            this.avatarType = config.avatar_config.avatar_type
            this.avatarWSRoute = config.avatar_config.avatar_ws_route
            this.avatarAssetsPath = config.avatar_config.avatar_assets_path
          }
          if (config.track_constraints) {
            this.trackConstraints = config.track_constraints
          }
        })
        .catch(() => {
          message.error('服务端链接失败，请检查是否能正确访问到 OpenAvatarChat 服务端')
        })
    },
    handleCameraOff() {
      this.cameraOff = !this.cameraOff
      this.stream?.getTracks().forEach((track) => {
        if (track.kind.includes('video')) track.enabled = !this.cameraOff
      })
    },
    handleMicMuted() {
      this.micMuted = !this.micMuted
      this.stream?.getTracks().forEach((track) => {
        if (track.kind.includes('audio')) track.enabled = !this.micMuted
      })
    },
    handleVolumeMute() {
      this.volumeMuted = !this.volumeMuted
      if (this.avatarType === 'lam') {
        this.localAvatarRenderer?.setAvatarMute(this.volumeMuted)
      }
    },
    async handleDeviceChange(deviceId: string) {
      const device_id = deviceId
      const devices = await getDevices()
      this.devices = devices
      console.log('🚀 ~ handle_device_change ~ devices:', devices)
      let videoDeviceId =
        this.selectedVideoDevice &&
        devices.some((device) => device.deviceId === this.selectedVideoDevice?.deviceId)
          ? this.selectedVideoDevice.deviceId
          : ''
      let audioDeviceId =
        this.selectedAudioDevice &&
        devices.some((device) => device.deviceId === this.selectedAudioDevice?.deviceId)
          ? this.selectedAudioDevice.deviceId
          : ''
      if (this.availableVideoDevices.find((video_device) => video_device.deviceId === device_id)) {
        videoDeviceId = device_id
        this.cameraOff = false
      } else if (
        this.availableAudioDevices.find((audio_device) => audio_device.deviceId === device_id)
      ) {
        audioDeviceId = device_id
        this.micMuted = false
      }
      this.fillStream(audioDeviceId, videoDeviceId)
    },
    handleSubtitleToggle() {
      this.showChatRecords = !this.showChatRecords
      const visionState = useVisionStore()
      const { wrapperRef, wrapperRect } = visionState
      console.log(wrapperRect, wrapperRef)
      if (!wrapperRef || !wrapperRect) return
      wrapperRef.getBoundingClientRect()
      wrapperRect.width = wrapperRef!.clientWidth
      wrapperRect.height = wrapperRef!.clientHeight
      visionState.isLandscape = wrapperRect.width > wrapperRect.height
    },
    async updateAvailableDevices() {
      const devices = await getDevices()
      this.availableVideoDevices = setAvailableDevices(devices, 'videoinput')
      this.availableAudioDevices = setAvailableDevices(devices, 'audioinput')
    },
    async fillStream(audioDeviceId: string, videoDeviceId: string) {
      const { devices } = this
      const visionState = useVisionStore()
      const node = visionState.localVideoRef
      this.hasMic =
        devices.some((device) => {
          return device.kind === 'audioinput' && device.deviceId
        }) && this.hasMicPermission
      this.hasCamera =
        devices.some((device) => device.kind === 'videoinput' && device.deviceId) &&
        this.hasCameraPermission
      await getStream(
        audioDeviceId && audioDeviceId !== 'default'
          ? { deviceId: { exact: audioDeviceId } }
          : this.hasMic,
        videoDeviceId && videoDeviceId !== 'default'
          ? { deviceId: { exact: videoDeviceId } }
          : this.hasCamera,
        this.trackConstraints
      )
        .then(async (local_stream) => {
          console.log('local_stream', local_stream)
          this.stream = local_stream
          this.updateAvailableDevices()
        })
        .then(() => {
          const used_devices = this.stream!.getTracks().map(
            (track) => track.getSettings()?.deviceId
          )
          used_devices.forEach((device_id) => {
            const used_device = devices.find((device) => device.deviceId === device_id)
            if (used_device && used_device?.kind.includes('video')) {
              this.selectedVideoDevice = used_device
            } else if (used_device && used_device?.kind.includes('audio')) {
              this.selectedAudioDevice = used_device
            }
          })
          !this.selectedVideoDevice && (this.selectedVideoDevice = this.availableVideoDevices[0])
        })
        .catch((e) => {
          console.error('image.no_webcam_support', e)
        })
        .finally(() => {
          console.log(this.stream)
          if (!this.stream) {
            this.stream = new MediaStream()
          }
          console.log(this.stream.getTracks())

          if (!this.stream.getTracks().find((item) => item.kind === 'audio')) {
            this.stream.addTrack(createSimulatedAudioTrack())
          }
          if (!this.stream.getTracks().find((item) => item.kind === 'video')) {
            this.stream.addTrack(createSimulatedVideoTrack())
          }
          console.log(this.hasCamera, this.hasMic)
          this.webcamAccessed = true
          this.localStream = this.stream
          if (node) {
            node.srcObject = this.localStream
            node.muted = true
            node?.play()
          }
        })
    },
    async startWebRTC() {
      const visionState = useVisionStore()
      if (this.streamState === 'closed') {
        this.chatRecords = []
        this.peerConnection = new RTCPeerConnection(this.rtcConfig)
        this.peerConnection.addEventListener('connectionstatechange', async (event) => {
          switch (this.peerConnection!.connectionState) {
            case 'connected':
              this.streamState = StreamState.open
              break
            case 'disconnected':
              this.streamState = StreamState.closed
              stop(this.peerConnection!)
              // await access_webcam() //TODO 重置状态
              break
            default:
              break
          }
        })
        this.streamState = StreamState.waiting
        await setupWebRTC(this.stream!, this.peerConnection!, visionState.remoteVideoRef!)
          .then(([dataChannel, webRTCId]) => {
            this.streamState = StreamState.open
            this.webRTCId = webRTCId as string
            this.chatDataChannel = dataChannel as any

            if (this.avatarType && this.avatarWSRoute) {
              const ws = this.initWebsocket(this.avatarWSRoute, this.webRTCId)
              if (this.avatarType === 'lam') {
                this.localAvatarRenderer = this.doGaussianRender(ws)
              }
            }
          })
          .catch((e) => {
            console.info('catching', e)
            this.streamState = StreamState.closed
            message.error(e)
            message.error('请检查是否超过数字人并发上限')
          })
      } else if (this.streamState === 'waiting') {
        // waiting 中不允许操作
      } else {
        stop(this.peerConnection!)
        this.streamState = StreamState.closed
        this.chatRecords = []
        this.chatDataChannel = null
        this.replying = false
        await this.accessDevice()
        if (this.avatarType === 'lam') {
          this.localAvatarRenderer?.exit()
          this.gsLoadPercent = 0
        }
      }
    },
    initWebsocket(ws_route: string, webRTCId: string) {
      const ws = new WS(
        `${window.location.protocol.includes('https') ? 'wss' : 'ws'}://${window.location.host}${ws_route}/${webRTCId}`
      )
      ws.on(WsEventTypes.WS_OPEN, () => {
        console.log('socket opened')
      })
      ws.on(WsEventTypes.WS_CLOSE, () => {
        console.log('socket closed')
      })
      ws.on(WsEventTypes.WS_ERROR, (event) => {
        console.log('socket error', event)
      })
      ws.on(WsEventTypes.WS_MESSAGE, (data) => {
        console.log('socket on message', data)
      })
      return ws
    },
    doGaussianRender(ws: WS) {
      const visionState = useVisionStore()
      const gaussianAvatar = new GaussianAvatar({
        container: visionState.remoteVideoContainerRef!,
        assetsPath: this.avatarAssetsPath,
        ws,
        loadProgress: (progress) => {
          console.log('gs loadProgress', progress)
          this.gsLoadPercent = progress
          if (progress >= 1) {
            // visionState.computeRemotePosition();
          }
        },
      })
      gaussianAvatar.start()
      return gaussianAvatar
    },
  },
})
