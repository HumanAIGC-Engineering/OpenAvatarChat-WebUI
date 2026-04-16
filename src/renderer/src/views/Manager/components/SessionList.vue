<script lang="ts">
import { computed, defineComponent } from 'vue'
import type { SessionState } from '../managerTypes'

export default defineComponent({
  name: 'SessionList',
  props: {
    sessions: {
      type: Array as () => SessionState[],
      required: true,
    },
    now: {
      type: Number,
      required: true,
    },
    activeSessionId: {
      type: String,
      default: null,
    },
  },
  emits: ['select', 'close'],
  setup(props, { emit }) {
    function handleSelect(id: string): void {
      emit('select', id)
    }
    function handleClose(id: string, event: MouseEvent): void {
      event.stopPropagation()
      emit('close', id)
    }
    // Computed map of session id -> live status
    const liveStatusMap = computed(() => {
      const map: Record<string, boolean> = {}
      for (const session of props.sessions) {
        map[session.id] = props.now - session.lastUpdated <= 60_000
      }
      return map
    })
    return {
      props,
      handleSelect,
      handleClose,
      liveStatusMap,
    }
  },
})
</script>

<template>
  <header class="manager__sessions">
    <div class="manager__tabs-header">
      <div class="manager__section-title">会话</div>
      <div class="manager__session-count">{{ props.sessions.length }} 个</div>
    </div>
    <div v-if="props.sessions.length === 0" class="manager__empty">暂无会话</div>
    <div v-else class="manager__tab-strip" role="tablist">
      <button
        v-for="session in props.sessions"
        :key="session.id"
        type="button"
        role="tab"
        :class="['manager__tab', session.id === props.activeSessionId ? 'is-active' : '']"
        @click="handleSelect(session.id)"
      >
        <span
          :class="['manager__status-dot', liveStatusMap[session.id] ? 'is-live' : 'is-idle']"
        ></span>
        <span class="manager__tab-text">{{ session.id }}</span>
        <!-- <span v-if="session.owner" class="manager__tab-meta">{{ session.owner }}</span> -->
        <!-- <span class="manager__tab-meta">事件 {{ session.messages.length }}</span> -->
        <span class="manager__tab-close" title="关闭会话" @click="handleClose(session.id, $event)">
          ×
        </span>
      </button>
    </div>
  </header>
</template>

<style scoped lang="less">
.manager__sessions {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
  box-shadow: 0 6px 16px rgba(31, 48, 84, 0.06);
}

.manager__tabs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.manager__section-title {
  font-weight: 600;
  color: #27314f;
  display: flex;
  align-items: center;
  gap: 8px;
}

.manager__session-count {
  background: #eef2ff;
  color: #394b8f;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 12px;
}

.manager__tab-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  overflow-y: visible;
  padding: 8px 4px 4px 4px;
  margin: -8px -4px 0 -4px;
}

.manager__tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f8fafc;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    background 0.2s;
  white-space: nowrap;
  overflow: visible;
}

.manager__tab:hover {
  border-color: #c7d2fe;
  background: #eef2ff;
  box-shadow: 0 6px 16px rgba(31, 48, 84, 0.06);
}

.manager__tab.is-active {
  border-color: #6b7bff;
  background: #e8ecff;
  box-shadow: 0 8px 20px rgba(107, 123, 255, 0.16);
}

.manager__status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px #ffffff;
}

.manager__status-dot.is-live {
  background: #22c55e;
}

.manager__status-dot.is-idle {
  background: #cbd5e1;
}

.manager__tab-text {
  font-weight: 600;
  color: #1f2933;
}

.manager__tab-meta {
  font-size: 12px;
  color: #475569;
}

.manager__tab-close {
  position: absolute;
  top: -6px;
  right: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: #94a3b8;
  background: #fff;
  border: 1px solid #e5e7eb;
  opacity: 0;
  pointer-events: none;
  transition: all 0.15s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.manager__tab:hover .manager__tab-close {
  opacity: 1;
  pointer-events: auto;
}

.manager__tab-close:hover {
  color: #ef4444;
  background: #fff;
  border-color: #ef4444;
  transform: scale(1.1);
}

.manager__empty {
  color: #6b7280;
  padding: 20px 0;
}
</style>
