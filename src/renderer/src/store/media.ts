import { message } from 'ant-design-vue'
import { defineStore } from 'pinia'
import {
  createSimulatedAudioTrack,
  createSimulatedVideoTrack,
  getDevices,
  getStream,
  setAvailableDevices,
} from '@/utils/streamUtils'
import { useVisionStore } from './vision'

const defaultTrackConstraints = {
  video: {
    width: 500,
    height: 500,
  },
  audio: {},
}

type TrackConstraints =
  | {
      video: MediaTrackConstraints | boolean
      audio: MediaTrackConstraints | boolean
    }
  | undefined

interface MediaState {
  devices: MediaDeviceInfo[]
  availableVideoDevices: MediaDeviceInfo[]
  availableAudioDevices: MediaDeviceInfo[]
  selectedVideoDevice: MediaDeviceInfo | null
  selectedAudioDevice: MediaDeviceInfo | null
  stream: MediaStream | null
  localStream: MediaStream | null
  webcamAccessed: boolean
  trackConstraints: TrackConstraints

  hasCamera: boolean
  hasCameraPermission: boolean
  hasMic: boolean
  hasMicPermission: boolean

  cameraOff: boolean
  micMuted: boolean
}

export const useMediaStore = defineStore('mediaStore', {
  state: (): MediaState => {
    return {
      devices: [],
      availableVideoDevices: [],
      availableAudioDevices: [],
      selectedVideoDevice: null,
      selectedAudioDevice: null,
      stream: null,
      localStream: null,
      webcamAccessed: false,
      trackConstraints: defaultTrackConstraints,
      hasCamera: false,
      hasCameraPermission: true,
      hasMic: false,
      hasMicPermission: true,
      cameraOff: false,
      micMuted: false,
    }
  },
  actions: {
    setTrackConstraints(trackConstraints: TrackConstraints) {
      this.trackConstraints = trackConstraints || defaultTrackConstraints
    },
    async accessDevice() {
      try {
        this.micMuted = false
        this.cameraOff = false
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
        await this.fillStream(audioDeviceId, videoDeviceId)
        this.webcamAccessed = true
      } catch (err: unknown) {
        console.log(err)
        const errorMessage = err instanceof Error ? err.message : String(err)
        message.error(errorMessage)
      }
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
    async handleDeviceChange(deviceId: string) {
      const device_id = deviceId
      const devices = await getDevices()
      this.devices = devices
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
          ? {
              video:
                typeof this.trackConstraints.video === 'boolean' ? {} : this.trackConstraints.video,
              audio:
                typeof this.trackConstraints.audio === 'boolean' ? {} : this.trackConstraints.audio,
            }
          : undefined
      )
        .then(async (local_stream) => {
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
          if (!this.stream) {
            this.stream = new MediaStream()
          }
          if (!this.stream.getTracks().find((item) => item.kind === 'audio')) {
            this.stream.addTrack(createSimulatedAudioTrack())
          }
          if (!this.stream.getTracks().find((item) => item.kind === 'video')) {
            this.stream.addTrack(createSimulatedVideoTrack())
          }
          this.webcamAccessed = true
          this.localStream = this.stream
          if (node) {
            node.srcObject = this.localStream
            node.muted = true
            node?.play()
          }
        })
    },
  },
})
