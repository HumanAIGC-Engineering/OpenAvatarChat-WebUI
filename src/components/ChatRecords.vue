<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from "vue";
import ChatMessage from "@/components/ChatMessage.vue";

const props = defineProps<{
  chatRecords: any[]
}>();

let containerRef = useTemplateRef<HTMLElement>('containerRef')

watch(() => props.chatRecords, (val) => {
  if (props.chatRecords) {
    nextTick().then(() => {
      scrollToBottom()
    })
  }
})
function scrollToBottom() {
  // console.log("🚀 ~ scrollToBottom ~ scrollToBottom:")
  if (containerRef.value) {
    containerRef.value.scrollTop = containerRef.value.scrollHeight;
  }
}

defineExpose({
  scrollToBottom
})
</script>

<template>
  <div class="chat-records" ref="containerRef">
    <div class="chat-records-inner">
      <template v-for="(item, i) in chatRecords" :key="item.id">
        <div :class="`chat-message ${item.role}`">
          <ChatMessage :message="item.message" :role="item.role"></ChatMessage>
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

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
