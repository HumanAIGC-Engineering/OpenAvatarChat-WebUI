<template>
  <div class="player-controls">
    <div
      :class="[
        'chat-btn',
        streamState === StreamState.closed && 'start-chat',
        streamState === StreamState.open && 'stop-chat',
      ]"
      @click="onStartChat"
    >
      <template v-if="streamState === StreamState.closed">
        <span>点击开始对话</span>
      </template>
      <template v-else-if="streamState === StreamState.waiting">
        <div class="waiting-icon-text">
          <div class="icon" title="spinner">
            <Spin wrapperClassName="spin-icon"></Spin>
          </div>
          <span>等待中</span>
        </div>
      </template>
      <template v-else>
        <div class="stop-chat-inner"></div>
      </template>
    </div>
    <template v-if="streamState === StreamState.open">
      <div class="input-audio-wave">
        <AudioWave
          :audioSourceCallback="audioSourceCallback"
          :streamState="streamState"
          :waveColor="waveColor"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Spin } from 'ant-design-vue';
import { StreamState } from '@/interface/voiceChat';
import AudioWave from '@/components/AudioWave.vue';

const props = withDefaults(
  defineProps<{
    streamState: StreamState;
    onStartChat: any;
    audioSourceCallback: () => MediaStream | null;
    waveColor: string;
  }>(),
  {
    streamState: StreamState.closed,
  },
);

const emit = defineEmits([]);
</script>

<style scoped lang="less"></style>

<style scoped lang="less">
.player-controls {
  height: 15%;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 84px;

  .chat-btn {
    height: 64px;
    width: 296px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 999px;
    opacity: 1;
    background: linear-gradient(180deg, #7873f6 0%, #524de1 100%);
    transition: all 0.3s;
    z-index: 2;
    cursor: pointer;
  }

  .start-chat {
    font-size: 16px;
    font-weight: 500;
    text-align: center;
    color: #ffffff;
  }

  .waiting-icon-text {
    width: 80px;
    align-items: center;
    font-size: 16px;
    font-weight: 500;
    color: #ffffff;
    margin: 0 var(--spacing-sm);
    display: flex;
    justify-content: space-evenly;
    gap: var(--size-1);

    .icon {
      width: 25px;
      height: 25px;
      fill: #ffffff;
      stroke: #ffffff;
      color: #ffffff;
    }
    .spin-icon {
      color: #fff;
    }
    :global(.ant-spin-dot-item) {
      background-color: #fff !important;
    }
  }

  .stop-chat {
    width: 64px;

    .stop-chat-inner {
      width: 25px;
      height: 25px;
      border-radius: 6.25px;
      background: #fafafa;
    }
  }

  .input-audio-wave {
    position: absolute;
  }
}
</style>
