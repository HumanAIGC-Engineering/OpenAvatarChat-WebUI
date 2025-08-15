<script setup lang="ts">
import WebcamPermission from '@/components/WebcamPermission.vue'
import { antdLocale, locale } from '@/langs'
import VideoChat from '@/views/VideoChat/index.vue'
import { ConfigProvider } from 'ant-design-vue'
import { useVideoChatStore } from './store'
const videoChatState = useVideoChatStore()
videoChatState.init()
// import dayjs from 'dayjs';
// import 'dayjs/locale/zh-cn';
// dayjs.locale('zh-cn');
</script>
<template>
  <ConfigProvider :locale="antdLocale[locale]">
    <div class="wrap">
      <WebcamPermission v-if="!videoChatState.webcamAccessed" />
      <VideoChat />
    </div>
  </ConfigProvider>
</template>
<style lang="less" scoped>
.wrap {
  background-image: url(@/assets/background.png);
  height: calc(max(80vh, 100%));
  background-size: 100% 100%;
  background-repeat: no-repeat;
  position: relative;
  *::-webkit-scrollbar {
    display: none;
  }
}
</style>
