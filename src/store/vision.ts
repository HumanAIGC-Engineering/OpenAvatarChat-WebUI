import { defineStore } from 'pinia'

interface VisionState {
  wrapperRef: HTMLDivElement | undefined
  wrapperRect: { width: number; height: number }
  localVideoRef: HTMLVideoElement | undefined
  localVideoContainerRef: HTMLDivElement | undefined

  remoteVideoRef: HTMLVideoElement | undefined
  remoteVideoContainerRef: HTMLDivElement | undefined

  isLandscape: boolean
  showChatRecords: boolean
}

export const useVisionStore = defineStore('visionStore', {
  state: (): VisionState => {
    return {
      wrapperRect: {
        width: 0,
        height: 0,
      },
      wrapperRef: undefined,
      localVideoRef: undefined,
      localVideoContainerRef: undefined,

      remoteVideoRef: undefined,
      remoteVideoContainerRef: undefined,

      isLandscape: true,
      showChatRecords: false,
    }
  },
  actions: {},
})
