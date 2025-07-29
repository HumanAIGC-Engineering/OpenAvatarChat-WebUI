<script setup lang="ts">
import Iconfont, { Send } from '@/components/Iconfont';
import { insertStringAt } from '@/utils/utils';
import { useTemplateRef } from 'vue';

const props = withDefaults(
  defineProps<{
    replying: boolean;
  }>(),
  {},
);
const emit = defineEmits(['send', 'stop', 'interrupt']);

let inputHeight = 24;
let rowsDivRef = useTemplateRef<HTMLDivElement>('rowsDivRef');
let chatInputRef = useTemplateRef<HTMLInputElement>('chatInputRef');
let inputValue = '';
function on_chat_input_keydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    if (event.altKey) {
      if (chatInputRef.value) {
        chatInputRef.value.value = insertStringAt(
          chatInputRef.value.value,
          '\n',
          chatInputRef.value.selectionStart || 0,
        );
        chatInputRef.value.dispatchEvent(new InputEvent('input'));
      }
    } else {
      event.preventDefault();
      on_send();
    }
  }
}
async function on_send() {
  if (chatInputRef.value) {
    emit('send', chatInputRef.value.value);
    chatInputRef.value.value = '';
  }
}
function on_chat_input(event: Event) {
  if (rowsDivRef.value) {
    rowsDivRef.value.textContent = (event.target as any).value.replace(/\n$/, '\n\n');
    inputHeight = rowsDivRef.value.offsetHeight;
  }
}

function onStop() {
  emit('stop');
}
function onInterrupt() {
  emit('interrupt');
}
</script>

<template>
  <div class="chat-input-container">
    <div class="stop-chat-btn" @click="onStop"></div>

    <div class="chat-input-inner">
      <div class="chat-input-wrapper">
        <textarea
          class="chat-input"
          ref="chatInputRef"
          @keydown="on_chat_input_keydown"
          @input="on_chat_input"
          :style="`height:${inputHeight}px`"
        />
        <div class="rowsDiv" ref="rowsDivRef">{{ inputValue }}</div>
      </div>
      <template v-if="replying">
        <button class="interrupt-btn" @click="onInterrupt"></button>
      </template>
      <template v-else>
        <button class="send-btn" @click="on_send">
          <Iconfont :icon="Send" :color="'#fff'"></Iconfont>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped lang="less">
.chat-input-container {
  height: 15%;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 84px;
  width: calc(100% - 140px);
  margin: auto;
  // padding: 0 12px;

  .chat-input-inner {
    padding: 0 12px;
    background-color: #fff;
    height: 64px;
    flex: 1;
    display: flex;
    align-items: center;
    border: 1px solid #e8eaf2;
    border-radius: 12px;
    border-radius: 20px;
    box-shadow:
      0 12px 24px -16px rgba(54, 54, 73, 0.04),
      0 12px 40px 0 rgba(51, 51, 71, 0.08),
      0 0 1px 0 rgba(44, 44, 54, 0.02);

    .chat-input-wrapper {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;

      .chat-input {
        width: 100%;
        border: none;
        outline: none;
        color: #26244c;
        font-size: 16px;
        font-weight: 400;
        resize: none;
        padding: 0;
        margin: 8px 0;
        line-height: 24px;
        max-height: 48px;
        min-height: 24px;
      }

      .rowsDiv {
        position: absolute;
        left: 0;
        right: 0;
        z-index: -1;
        visibility: hidden;
        font-size: 16px;
        font-weight: 400;
        line-height: 24px;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
    }

    .send-btn,
    .interrupt-btn {
      border: none;
      flex: 0 0 auto;
      background: #615ced;
      border-radius: 20px;
      height: 28px;
      width: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 16px;
      cursor: pointer;
    }

    .interrupt-btn {
      &::after {
        content: ' ';
        width: 12px;
        height: 12px;
        border-radius: 2px;
        background: #fafafa;
      }
    }
  }

  .stop-chat-btn {
    cursor: pointer;
    margin-right: 12px;
    height: 28px;
    width: 28px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 999px;
    opacity: 1;
    background: linear-gradient(180deg, #7873f6 0%, #524de1 100%);

    &::after {
      content: ' ';
      width: 12px;
      height: 12px;
      border-radius: 2px;
      background: #fafafa;
    }
  }
}
</style>
