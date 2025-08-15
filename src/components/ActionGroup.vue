<template>
  <div class="action-group">
    <div v-if="hasCamera">
      <div v-click-outside="() => (cameraListShow = false)" class="action" @click="handleCameraOff">
        <Iconfont :icon="cameraOff ? CameraOff : CameraOn" />
        <div
          v-if="streamState === 'closed'"
          class="corner"
          @click.stop.prevent="() => (cameraListShow = !cameraListShow)"
        >
          <div class="corner-inner" />
        </div>
        <div
          v-show="cameraListShow && streamState === 'closed'"
          class="selectors"
          :class="{ left: isLandscape }"
        >
          <div
            v-for="device in availableVideoDevices"
            :key="device.deviceId"
            class="selector"
            @click.stop="
              () => {
                handleDeviceChange(device.deviceId)
                cameraListShow = false
              }
            "
          >
            {{ device.label }}
            <div
              v-if="selectedVideoDevice && device.deviceId === selectedVideoDevice.deviceId"
              class="active-icon"
            >
              <CheckIcon />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="hasMic">
      <div v-click-outside="() => (micListShow = false)" class="action" @click="handleMicMuted">
        <Iconfont :icon="micMuted ? MicOff : MicOn" />
        <div
          v-if="streamState === 'closed'"
          class="corner"
          @click.stop.prevent="() => (micListShow = !micListShow)"
        >
          <div class="corner-inner" />
        </div>
        <div
          v-show="micListShow && streamState === 'closed'"
          class="selectors"
          :class="{ left: isLandscape }"
        >
          <div
            v-for="device in availableAudioDevices"
            :key="device.deviceId"
            class="selector"
            @click.stop="
              (e) => {
                handleDeviceChange(device.deviceId)
                micListShow = false
              }
            "
          >
            {{ device.label }}
            <div
              v-if="selectedAudioDevice && device.deviceId === selectedAudioDevice.deviceId"
              class="active-icon"
            >
              <CheckIcon />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="action" @click="handleVolumeMute">
      <Iconfont :icon="volumeMuted ? VolumeOff : VolumeOn" />
    </div>
    <div v-if="wrapperRect.width > 300">
      <div class="action" @click="handleSubtitleToggle">
        <Iconfont :icon="showChatRecords ? SubtitleOn : SubtitleOff" />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useVideoChatStore } from '@/store'
import { useVisionStore } from '@/store/vision'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import Iconfont, {
  CameraOff,
  CameraOn,
  CheckIcon,
  MicOff,
  MicOn,
  SubtitleOff,
  SubtitleOn,
  VolumeOff,
  VolumeOn,
} from './Iconfont'
const videoChatStore = useVideoChatStore()
const visionStore = useVisionStore()
const {
  hasCamera,
  hasMic,
  cameraOff,
  micMuted,
  volumeMuted,
  showChatRecords,
  streamState,

  selectedAudioDevice,
  selectedVideoDevice,
  availableAudioDevices,
  availableVideoDevices,
} = storeToRefs(videoChatStore)
const {
  handleCameraOff,
  handleMicMuted,
  handleVolumeMute,
  handleDeviceChange,
  handleSubtitleToggle,
} = videoChatStore

const { wrapperRect, isLandscape } = storeToRefs(visionStore)
const micListShow = ref(false)
const cameraListShow = ref(false)
</script>

<style lang="less" scoped>
.action-group {
  border-radius: 12px;
  background: rgba(88, 87, 87, 0.5);
  padding: 2px;
  backdrop-filter: blur(8px);

  .action {
    cursor: pointer;
    width: 42px;
    height: 42px;
    border-radius: 8px;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    color: #fff;

    .corner {
      position: absolute;
      right: 0px;
      bottom: 0px;
      padding: 3px;

      .corner-inner {
        width: 6px;
        height: 6px;
        border-top: 3px transparent solid;
        border-left: 3px transparent solid;
        border-bottom: 3px #fff solid;
        border-right: 3px #fff solid;
      }
    }

    // &:hover {
    // 	.selectors {
    // 		display: block !important;
    // 	}
    // }
    .selectors {
      position: absolute;
      top: 0;
      left: calc(100%);
      margin-left: 3px;
      max-height: 150px;

      &.left {
        left: 0;
        margin-left: -3px;
        transform: translateX(-100%);
      }

      border-radius: 12px;
      width: max-content;
      overflow: hidden;
      overflow: auto;

      background: rgba(90, 90, 90, 0.5);
      backdrop-filter: blur(8px);

      .selector {
        max-width: 250px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        position: relative;
        cursor: pointer;
        height: 42px;
        line-height: 42px;
        color: #fff;
        font-size: 14px;

        &:hover {
          background: #67666a;
        }

        padding-left: 15px;
        padding-right: 50px;

        .active-icon {
          position: absolute;
          right: 10px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          top: 0;
        }
      }
    }
  }

  .action:hover {
    background: #67666a;
  }
}

.action-group + .action-group {
  margin-top: 10px;
}
</style>
