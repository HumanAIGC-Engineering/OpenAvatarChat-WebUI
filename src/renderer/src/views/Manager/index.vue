<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { storeToRefs } from 'pinia'

import { statusClassMap, statusTextMap, useManagerStore } from '@/store/manager'
import ManagerHeader from './components/ManagerHeader.vue'
import MessageList from './components/MessageList.vue'
import SessionList from './components/SessionList.vue'
import SignalViewer from './components/SignalViewer.vue'
import CurrentConfigViewer from './components/CurrentConfigViewer.vue'

const managerStore = useManagerStore()
const { status, connectionError, sortedSessions, activeSession, activeChatMessages, currentTime } =
  storeToRefs(managerStore)
const { reconnect, selectSession, removeSession } = managerStore

onMounted(() => {
  managerStore.start()
})

onBeforeUnmount(() => {
  managerStore.stop()
})
</script>

<template>
  <div class="manager">
    <ManagerHeader
      :status="status"
      :status-text-map="statusTextMap"
      :status-class-map="statusClassMap"
      @reconnect="reconnect"
    />

    <section v-if="connectionError" class="manager__error">
      {{ connectionError }}
    </section>

    <section class="manager__content">
      <div class="manager__content-left">
        <SessionList
          :sessions="sortedSessions"
          :active-session-id="activeSession?.id || undefined"
          :now="currentTime"
          @select="selectSession"
          @close="removeSession"
        />

        <main class="manager__detail">
          <div v-if="!activeSession" class="manager__empty">请选择或等待会话出现</div>

          <MessageList v-else :messages="activeChatMessages" />
        </main>
      </div>
      <div class="manager__content-right">
        <SignalViewer />
        <CurrentConfigViewer />
      </div>
    </section>
  </div>
</template>

<style scoped lang="less">
.manager {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f6f7fb;
  height: 100vh;
  color: #1f2933;
  font-family:
    'Inter',
    'PingFang SC',
    'Microsoft YaHei',
    system-ui,
    -apple-system,
    sans-serif;
}

.manager__error {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff3f3;
  color: #b42318;
  border: 1px solid #ffd5d5;
}

.manager__content {
  height: 100%;
  display: flex;
  flex-direction: row;
  gap: 12px;
  overflow: hidden;
  .manager__content-left {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .manager__content-right {
    width: 60vw;
    flex: 0 0 auto;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}

.manager__detail {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 6px 16px rgba(31, 48, 84, 0.06);
  flex: 1;
  overflow: hidden;
}

.manager__empty {
  color: #6b7280;
  padding: 20px 0;
}

.manager__section-title {
  font-weight: 600;
  color: #27314f;
  display: flex;
  align-items: center;
  gap: 8px;
}

.manager__detail-id {
  background: #eef2ff;
  color: #394b8f;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 12px;
}
</style>
