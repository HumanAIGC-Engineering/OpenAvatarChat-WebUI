<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'
import ChatMessage from '@/components/ChatMessage.vue'

interface ChatRecordItem {
  id: string
  role: 'human' | 'avatar'
  message: string
  stream_key?: string
  cancelled?: boolean
  invalid?: boolean
}

const props = defineProps<{
  chatRecords: ChatRecordItem[]
}>()

let containerRef = useTemplateRef<HTMLElement>('containerRef')

watch(
  () => props.chatRecords,
  () => {
    if (props.chatRecords) {
      nextTick().then(() => {
        scrollToBottom()
      })
    }
  }
)
function scrollToBottom(): void {
  // console.log("🚀 ~ scrollToBottom ~ scrollToBottom:")
  if (containerRef.value) {
    containerRef.value.scrollTop = containerRef.value.scrollHeight
  }
}

defineExpose({
  scrollToBottom,
})
</script>

<template>
  <div ref="containerRef" class="chat-records">
    <div class="chat-records-inner">
      <template v-for="item in chatRecords" :key="item.id">
        <div
          v-show="item.message && !(item.cancelled && item.invalid)"
          :class="['chat-message', item.role, { cancelled: item.cancelled }]"
        >
          <!-- <div v-if="item.stream_key" class="stream-key">stream_key: {{ item.stream_key }}</div> -->
          <ChatMessage
            :message="item.message"
            :role="item.role"
            :style="item.cancelled ? 'background:#f5c542;color:#26244c;' : ''"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="less">
.chat-records {
  width: 100%;
  height: 100%;
  overflow-y: auto;

  &::-webkit-scrollbar {
    display: none;
  }
}

.chat-records-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: end;
  width: 100%;
  // height: 100%;
  height: auto;
  min-height: 100%;

  .chat-message {
    margin-bottom: 12px;
    max-width: 80%;

    &.human {
      align-self: flex-end;
    }

    &.avatar {
      align-self: flex-start;
    }

    &.cancelled {
      opacity: 0.95;
    }

    &:last-child {
      margin-bottom: 0;
    }

    .stream-key {
      margin-bottom: 4px;
      font-size: 12px;
      color: #a5a5a5;
      word-break: break-all;
    }
  }
}
</style>
