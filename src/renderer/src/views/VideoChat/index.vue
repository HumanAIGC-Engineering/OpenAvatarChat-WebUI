<template>
  <div ref="wrapRef" class="page-container">
    <div class="content-container">
      <div
        class="video-container"
        :style="{
          visibility: webcamAccessed ? 'visible' : 'hidden',
          aspectRatio: remoteAspectRatio,
        }"
      >
        <div
          v-show="hasCamera && !cameraOff"
          ref="localVideoContainerRef"
          :class="`local-video-container ${streamState === 'open' ? 'scaled' : ''}`"
        >
          <video
            ref="localVideoRef"
            class="local-video"
            autoplay
            muted
            playsinline
            :style="{
              visibility: cameraOff ? 'hidden' : 'visible',
              display: !hasCamera || cameraOff ? 'none' : 'block',
            }"
          />
        </div>
        <div
          ref="remoteVideoContainerRef"
          :class="['remote-video-container', { connected: streamState === 'open' }]"
        >
          <video
            v-if="!avatarType"
            v-show="streamState === 'open'"
            ref="remoteVideoRef"
            class="remote-video"
            autoplay
            playsinline
            :muted="volumeMuted"
            @playing="onplayingRemoteVideo"
          />
          <div
            v-if="streamState === 'open' && showChatRecords && !isLandscape"
            :class="`chat-records-container inline`"
            :style="
              !hasCamera || cameraOff ? 'width:80%;padding-bottom:12px;' : 'padding-bottom:12px;'
            "
          >
            <ChatRecords
              ref="chatRecordsInstanceRef"
              :chat-records="chatRecords.filter((_, index) => index >= chatRecords.length - 4)"
            />
          </div>
        </div>

        <div v-if="toolsVisible" class="actions">
          <ActionGroup />
        </div>
      </div>
      <template v-if="inputVisible">
        <template v-if="(!hasMic || micMuted) && streamState === 'open'">
          <ChatInput
            :replying="replying"
            @interrupt="onInterrupt"
            @send="onSend"
            @stop="videoChatState.startWebRTC"
          />
        </template>
        <template v-else-if="webcamAccessed">
          <ChatBtn
            :audio-source-callback="audioSourceCallback"
            :stream-state="streamState"
            wave-color="#7873F6"
            @start-chat="onStartChat"
          />
        </template>
      </template>
    </div>
    <div
      v-if="streamState === 'open' && showChatRecords && isLandscape"
      class="chat-records-container"
    >
      <ChatRecords ref="chatRecordsInstanceRef" :chat-records="chatRecords" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, ref, useTemplateRef } from 'vue'

import ActionGroup from '@/components/ActionGroup.vue'
import ChatBtn from '@/components/ChatBtn.vue'
import ChatInput from '@/components/ChatInput.vue'
import ChatRecords from '@/components/ChatRecords.vue'
import { useAppStore } from '@/store/app'
import { useChatStore } from '@/store/chat'
import { useVideoChatStore } from '@/store/webrtc'
import { useMediaStore } from '@/store/media'
import { useVisionStore } from '@/store/vision'

const visionState = useVisionStore()
const videoChatState = useVideoChatStore()
const chatState = useChatStore()
const appState = useAppStore()
const mediaState = useMediaStore()
const wrapRef = ref<HTMLDivElement>()

const localVideoContainerRef = ref<HTMLDivElement>()
const remoteVideoContainerRef = ref<HTMLDivElement>()
const localVideoRef = ref<HTMLVideoElement>()
const remoteVideoRef = ref<HTMLVideoElement>()
const remoteAspectRatio = ref('9 / 16')
const onplayingRemoteVideo = (): void => {
  if (remoteVideoRef.value) {
    remoteAspectRatio.value = `${remoteVideoRef.value.videoWidth} / ${remoteVideoRef.value.videoHeight}`
  }
}

const audioSourceCallback = (): MediaStream | null => mediaState.localStream

onMounted(() => {
  const wrapperRef = wrapRef.value
  visionState.wrapperRef = wrapperRef
  wrapperRef!.getBoundingClientRect()
  wrapperRect.value.width = wrapperRef!.clientWidth
  wrapperRect.value.height = wrapperRef!.clientHeight
  visionState.isLandscape = wrapperRect.value.width > wrapperRect.value.height

  visionState.remoteVideoContainerRef = remoteVideoContainerRef.value
  visionState.localVideoContainerRef = localVideoContainerRef.value
  visionState.localVideoRef = localVideoRef.value
  visionState.remoteVideoRef = remoteVideoRef.value
  visionState.wrapperRef = wrapRef.value
})
const { streamState } = storeToRefs(videoChatState)
const { volumeMuted, replying, showChatRecords } = storeToRefs(chatState)
const { avatarType, chatRecords, inputVisible, toolsVisible } = storeToRefs(appState)
const { hasCamera, hasMic, micMuted, cameraOff, webcamAccessed } = storeToRefs(mediaState)
const { wrapperRect, isLandscape } = storeToRefs(visionState)

function onStartChat(): void {
  videoChatState.startWebRTC()
}

function onInterrupt(): void {
  videoChatState.interrupt()
}

const chatRecordsInstanceRef =
  useTemplateRef<InstanceType<typeof ChatRecords>>('chatRecordsInstanceRef')
function onSend(message: string): void {
  if (!message) return
  videoChatState.sendText(message)
  chatRecordsInstanceRef.value?.scrollToBottom()
}
</script>
<style lang="less" scoped>
@import './index.less';
</style>
