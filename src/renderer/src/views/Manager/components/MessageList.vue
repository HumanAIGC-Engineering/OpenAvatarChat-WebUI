<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ChatMessage } from '../managerTypes'
import InlineAudioPlayer from '@/components/InlineAudioPlayer.vue'
import { useClipboard } from '@vueuse/core'
import { Tooltip } from 'ant-design-vue'
type DisplayChatMessage = ChatMessage & {
  builderId?: number
  streamId?: number
  key: string
}

const props = defineProps<{
  messages: ChatMessage[]
}>()

const scrollEl = ref<HTMLElement | null>(null)
const showScrollButton = ref(false)

const visibleMessages = computed<DisplayChatMessage[]>(() =>
  props.messages
    .filter((msg): msg is ChatMessage => msg.type === 'chat_message')
    .map((msg, idx) => {
      const builderId = msg.textStream?.builder_id
      const streamId = msg.textStream?.stream_id
      const key =
        builderId !== undefined || streamId !== undefined
          ? `${builderId ?? 'nb'}-${streamId ?? 'ns'}`
          : `msg-${idx}`
      return {
        ...msg,
        builderId,
        streamId,
        key,
      }
    })
)

const messageLabel = (msg: ChatMessage): string => {
  return msg.role === 'human' ? 'Human' : 'Avatar'
}

/**
 * 格式化时间戳为可读时间
 */
const formatTimestamp = (ts?: number): string => {
  if (!ts) return ''
  const date = new Date(ts * 1000) // 假设是秒级时间戳
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

const scrollToBottom = (): void => {
  if (!scrollEl.value) return
  scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  showScrollButton.value = false
}

const handleScroll = (): void => {
  if (!scrollEl.value) return
  const { scrollTop, clientHeight, scrollHeight } = scrollEl.value
  showScrollButton.value = scrollTop + clientHeight < scrollHeight - 40
}

onMounted(() => {
  scrollToBottom()
  scrollEl.value?.addEventListener('scroll', handleScroll)
  handleScroll()
})

onBeforeUnmount(() => {
  scrollEl.value?.removeEventListener('scroll', handleScroll)
})

watch(
  () => visibleMessages.value.length,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)

watch(
  () => visibleMessages.value.map((msg) => `${msg.key}:${msg.text ?? ''}`).join('||'),
  async () => {
    await nextTick()
    scrollToBottom()
  }
)
const { copy } = useClipboard()
const copyStreamMeta = (msg: ChatMessage) => {
  copy(
    JSON.stringify({
      timestamp: msg.timestamp,
      audioStreamMeta: msg.audioStream?.stream_meta,
      textStreamMeta: msg.textStream?.stream_meta,
    })
  )
}
const downloadAudio = async (msg: ChatMessage): Promise<void> => {
  if (!msg.audioUrl) return

  const audioUrl = msg.audioUrl

  let name = 'audio'
  if (msg.audioStream?.stream_meta?.['task_id']) {
    name = 'tts_' + msg.audioStream?.stream_meta?.['task_id']
  } else if (msg.textStream?.stream_meta?.['task_id']) {
    name = 'asr_' + msg.textStream?.stream_meta?.['task_id']
  }

  try {
    const token = localStorage.getItem('auth_openavatarchat')
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await window.fetch(audioUrl, { headers })

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`)
    }

    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `${name}.wav`
    a.click()
    a.remove()

    // 清理 blob URL
    URL.revokeObjectURL(blobUrl)
  } catch (e) {
    console.error('下载音频失败，回落到原始URL:', e)
    // 回落到原始 URL 下载方式
    const a = document.createElement('a')
    a.href = audioUrl
    a.download = `${name}.wav`
    a.click()
    a.remove()
  }
}
</script>

<template>
  <div ref="scrollEl" class="manager__messages">
    <div
      v-for="msg in visibleMessages"
      :key="msg.key"
      class="manager__message-wrapper"
      :class="msg.role === 'avatar' ? 'is-avatar' : 'is-human'"
    >
      <div
        class="manager__message-card"
        :class="msg.role === 'avatar' ? 'is-avatar' : 'is-human'"
        :data-kind="msg.type"
      >
        <div class="manager__message-body">
          <template v-if="msg.type === 'chat_message'">
            <p v-if="msg.text" class="manager__text">
              <!-- <span v-if="msg.originalText">{{ msg.originalText }}</span> -->
              <span :style="{ verticalAlign: 'middle' }">{{ msg.text }}</span>
              <InlineAudioPlayer
                v-if="msg.audioUrl"
                :src="msg.audioUrl"
                :dark="msg.role === 'avatar'"
                @download="downloadAudio(msg)"
              />
            </p>
            <p v-else class="manager__text is-muted">无文本内容</p>

            <div v-if="msg.imageUrl" class="manager__media">
              <img class="manager__image" :src="msg.imageUrl" alt="image" />
            </div>
          </template>
        </div>
      </div>
      <div v-if="msg.timestamp" class="manager__message-time">
        {{ formatTimestamp(msg.timestamp) }}
        <Tooltip trigger="click" :auto-adjust-overflow="true">
          <template #title>
            <div v-if="msg.audioStream?.stream_meta">
              <span>audio:</span>
              <span :style="{ userSelect: 'text' }">
                {{ msg.audioStream?.stream_meta['task_id'] }}
              </span>
            </div>
            <div v-if="msg.textStream?.stream_meta">
              <span>text:</span>
              <span :style="{ userSelect: 'text' }">
                {{ msg.textStream?.stream_meta['task_id'] }}
              </span>
            </div>
          </template>
          <span class="manager__copy-icon" @click="copyStreamMeta(msg)">📋</span>
        </Tooltip>
      </div>
    </div>
    <button
      v-if="showScrollButton"
      class="manager__scroll-bottom"
      type="button"
      @click="scrollToBottom"
    >
      ↓ 滚动到底部
    </button>
  </div>
</template>

<style scoped lang="less">
.manager__messages {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  max-height: calc(100vh - 240px);
  overflow-y: auto;
  padding-right: 4px;
  position: relative;
  padding-bottom: 40px;
}

.manager__message-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  background: #f9fafb;
}

.manager__message-card.is-avatar {
  background: #c7b7ff;
  color: #fff;
  text-align: left;
}

.manager__message-card.is-human {
  background: #f9fafb;
  color: #111827;
  text-align: right;
}

.manager__message-card[data-kind='signal_message'] {
  background: #f3f4f6;
}

.manager__message-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.manager__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.manager__badge {
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 12px;
  color: #334155;
  background: #e5e7eb;
}

.manager__badge.is-chat {
  background: #e0f2fe;
  color: #0f172a;
}

.manager__badge.is-signal {
  background: #ffe4e6;
  color: #9f1239;
}

.manager__badge.is-avatar {
  background: #a78bfa;
  color: #fff;
}

.manager__badge.is-type {
  background: #eef2ff;
  color: #4f46e5;
}

.manager__badge.is-owner {
  background: #ecfdf3;
  color: #166534;
}

.manager__badge.is-flag {
  background: #fff7ed;
  color: #9a3412;
}

.manager__timestamp {
  color: #6b7280;
  font-size: 12px;
}

.manager__message-wrapper {
  position: relative;
  max-width: 80%;

  &.is-avatar {
    margin-right: auto;
  }

  &.is-human {
    margin-left: auto;
  }
}

.manager__message-time {
  position: absolute;
  bottom: -16px;
  font-size: 11px;
  color: #9ca3af;
  white-space: nowrap;

  .manager__copy-icon {
    cursor: pointer;
    margin-left: 4px;
  }
  .manager__message-wrapper.is-avatar & {
    left: 4px;
  }

  .manager__message-wrapper.is-human & {
    right: 4px;
  }
}

.manager__message-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.manager__text {
  margin: 0;
  line-height: 24px;
  color: #111827;
  white-space: pre-wrap;
  word-break: break-word;
  // display: inline-flex;
  align-items: center;
  font-size: 16px;
  -webkit-user-select: text !important;
  user-select: text !important;
  cursor: text;

  span {
    -webkit-user-select: text !important;
    user-select: text !important;
    cursor: text;
  }
}

.manager__message-card.is-avatar .manager__text {
  color: #fff;
}

.manager__text.is-muted {
  color: #9ca3af;
}

.manager__preview,
.manager__media {
  border: 1px dashed #d1d5db;
  border-radius: 10px;
  padding: 8px;
  background: #fff;
}

.manager__image {
  max-width: 100%;
  border-radius: 8px;
}

.manager__audio-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #4b5563;
}

.manager__file {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.manager__pill {
  padding: 3px 8px;
  border-radius: 8px;
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
}

.manager__link {
  color: #4f46e5;
  font-size: 13px;
}

.manager__error {
  color: #b42318;
}

.manager__meta pre {
  margin: 0;
  background: #0b1021;
  color: #e2e8f0;
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
  overflow: auto;
}

.manager__scroll-bottom {
  position: sticky;
  bottom: 8px;
  margin-left: auto;
  width: fit-content;
  padding: 6px 12px;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transition:
    background 0.2s ease,
    transform 0.2s ease;
}

.manager__scroll-bottom:hover {
  background: #4338ca;
  transform: translateY(-1px);
}
</style>
