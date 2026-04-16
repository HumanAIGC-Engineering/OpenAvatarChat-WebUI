<template>
  <div class="signal-viewer">
    <div class="signal-viewer__header">
      <div class="signal-viewer__title-row">
        <h3 class="signal-viewer__title">
          信号流图
          <span v-if="activeSessionId" class="signal-viewer__session">
            <span class="signal-viewer__session-label">Session:</span>
            <span class="signal-viewer__session-id">{{ activeSessionId }}</span>
            <button
              class="signal-viewer__action-btn signal-viewer__action-btn--danger"
              title="发送打断信号"
              @click="sendInterrupt"
            >
              打断
            </button>
          </span>
        </h3>
        <span class="signal-viewer__count">{{ flowNodes.length }} 节点</span>
      </div>
    </div>

    <div class="signal-viewer__canvas">
      <VueFlow
        v-if="flowNodes.length > 0"
        :nodes="flowNodes"
        :edges="flowEdges"
        :nodes-draggable="true"
        :edges-updatable="false"
        :nodes-connectable="false"
        :edges-deletable="false"
        :edges-movable="false"
        :edges-selectable="false"
        :edges-stylable="false"
        :fit-view-on-init="true"
        :default-viewport="{ zoom: 0.8 }"
        class="vue-flow-container"
      >
        <template #node-handler="nodeProps">
          <HandlerNode :data="nodeProps.data" />
        </template>

        <Background :gap="16" :size="1" pattern-color="#e5e7eb" />
        <!-- <Controls position="bottom-right" /> -->
        <!-- <MiniMap position="bottom-left" :pannable="true" :zoomable="true" /> -->
      </VueFlow>

      <div v-else class="signal-viewer__empty">
        <div class="signal-viewer__empty-icon">📡</div>
        <p>等待信号数据...</p>
      </div>
    </div>

    <div class="signal-viewer__legend">
      <div class="legend-item">
        <span class="legend-dot legend-dot--active"></span>
        <span>数据产生中</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot legend-dot--inactive"></span>
        <span>已完成</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot legend-dot--timeout"></span>
        <span>超时(&gt;10s)</span>
      </div>
      <div class="legend-item">
        <span class="legend-line legend-line--animated"></span>
        <span>数据流动</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, defineComponent, watch } from 'vue'
import { VueFlow, MarkerType, Handle, Position, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { storeToRefs } from 'pinia'
import { useManagerStore } from '@/store/manager'
import type { FlowNode } from '../managerTypes'
import { message } from 'ant-design-vue'

const managerStore = useManagerStore()
const { flowNodes: storeNodes, flowEdges: storeEdges, activeSession } = storeToRefs(managerStore)

// Use VueFlow composable to get fitView method
const { fitView } = useVueFlow()

// Watch for node changes and fit view when nodes are added
watch(
  () => storeNodes.value.length,
  (newLength, oldLength) => {
    if (newLength > 0 && newLength !== oldLength) {
      // Use nextTick to ensure DOM is updated before fitting view
      setTimeout(() => {
        fitView({ duration: 300 })
      }, 300)
    }
  }
)

// Get active session ID
const activeSessionId = computed(() => activeSession.value?.id || null)
// Send interrupt signal to server (delegated to store)
const sendInterrupt = (): void => {
  if (activeSessionId.value) {
    managerStore.sendInterrupt()
    message.success('已发送打断信号')
  } else {
    message.error('请先选择会话')
  }
}

// Transform nodes for vue-flow with custom styling
const flowNodes = computed(() => {
  return storeNodes.value.map((node) => ({
    ...node,
    type: 'handler',
    class: node.data.status === 'active' ? 'node-active' : 'node-inactive',
  }))
})

// Transform edges for vue-flow with styling
const flowEdges = computed(() => {
  return storeEdges.value.map((edge) => ({
    ...edge,
    type: 'smoothstep',
    sourceHandle: 'right', // Connect from right handle of source
    targetHandle: 'left', // Connect to left handle of target
    style: {
      stroke: edge.animated ? '#22c55e' : '#94a3b8',
      strokeWidth: edge.animated ? 2 : 1,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edge.animated ? '#22c55e' : '#94a3b8',
    },
  }))
})

// Custom Handler Node Component
const HandlerNode = defineComponent({
  name: 'HandlerNode',
  props: {
    data: {
      type: Object as () => FlowNode['data'],
      required: true,
    },
  },
  setup(props) {
    const getStatusClass = (): string => {
      switch (props.data.status) {
        case 'active':
          return 'handler-node--active'
        case 'timeout':
          return 'handler-node--timeout'
        default:
          return 'handler-node--inactive'
      }
    }

    return () =>
      h(
        'div',
        {
          class: ['handler-node', getStatusClass()],
        },
        [
          // Left handle (target/input)
          h(Handle, {
            id: 'left',
            type: 'target',
            position: Position.Left,
            style: { left: '-6px', top: '50%', transform: 'translateY(-50%)' },
          }),
          h('div', { class: 'handler-node__status' }),
          h('div', { class: 'handler-node__content' }, [
            h('div', { class: 'handler-node__label' }, props.data.label),
            // h('div', { class: 'handler-node__type' }, props.data.sourceType),
            h(
              'div',
              { class: 'handler-node__type' },
              props.data.endTime && props.data.startTime
                ? `耗时: ${Math.floor((props.data.endTime - props.data.startTime) * 1000)}ms`
                : '暂无耗时数据'
            ),
          ]),
          // Right handle (source/output)
          h(Handle, {
            id: 'right',
            type: 'source',
            position: Position.Right,
            style: { right: '-6px', top: '50%', transform: 'translateY(-50%)' },
          }),
        ]
      )
  },
})
</script>

<style scoped lang="less">
.signal-viewer {
  width: 100%;
  height: auto;
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 6px 16px rgba(31, 48, 84, 0.06);
  overflow: hidden;
}

.signal-viewer__header {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.signal-viewer__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.signal-viewer__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #27314f;
}

.signal-viewer__count {
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 10px;
}

.signal-viewer__session {
  font-size: 11px;
  color: #9ca3af;
}

.signal-viewer__session-label {
  color: #9ca3af;
}

.signal-viewer__session-id {
  color: #4b5563;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.signal-viewer__action-btn {
  margin-left: 8px;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.96);
  }

  &--danger {
    background: #ef4444;

    &:hover {
      background: #dc2626;
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
    }

    &:active {
      background: #b91c1c;
    }
  }
}

.signal-viewer__canvas {
  flex: 1;
  position: relative;
  min-height: 150px;
}

.vue-flow-container {
  width: 100%;
  height: 100%;
}

.signal-viewer__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
}

.signal-viewer__empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.signal-viewer__legend {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;

  &--active {
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
  }

  &--inactive {
    background: #94a3b8;
  }

  &--timeout {
    background: #ef4444;
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
  }
}

.legend-line {
  width: 20px;
  height: 2px;
  background: #22c55e;
  position: relative;

  &--animated {
    background: linear-gradient(90deg, #22c55e 50%, transparent 50%);
    background-size: 8px 2px;
    animation: flow 0.5s linear infinite;
  }
}

@keyframes flow {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 8px 0;
  }
}
</style>

<style lang="less">
/* Global styles for vue-flow nodes - must not be scoped */
.handler-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #ffffff;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  min-width: 100px;
  max-width: 120px;
  transition: all 0.3s ease;

  &--active {
    border-color: #22c55e;
    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.08),
      0 0 0 3px rgba(34, 197, 94, 0.15);

    .handler-node__status {
      background: #22c55e;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
      animation: pulse 1.5s ease-in-out infinite;
    }
  }

  &--inactive {
    border-color: #d1d5db;
    background: #f9fafb;

    .handler-node__status {
      background: #94a3b8;
    }
  }

  &--timeout {
    border-color: #ef4444;
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.08),
      0 0 0 3px rgba(239, 68, 68, 0.15);

    .handler-node__status {
      background: #ef4444;
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
      animation: pulse-error 1s ease-in-out infinite;
    }
  }
}

@keyframes pulse-error {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

.handler-node__status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.handler-node__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.handler-node__label {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.handler-node__type {
  font-size: 11px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Handle styles */
.handler-node__handle {
  width: 10px !important;
  height: 10px !important;
  background: #94a3b8 !important;
  border: 2px solid #ffffff !important;
  border-radius: 50% !important;

  &--left {
    left: -5px !important;
  }

  &--right {
    right: -5px !important;
  }
}

.handler-node--active .handler-node__handle {
  background: #22c55e !important;
}

/* Override vue-flow handle positions */
.vue-flow__handle {
  &.vue-flow__handle-left {
    left: -5px !important;
  }

  &.vue-flow__handle-right {
    right: -5px !important;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

/* Vue Flow overrides */
.vue-flow__minimap {
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.vue-flow__controls {
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.vue-flow__controls-button {
  background: #ffffff;
  border: none;

  &:hover {
    background: #f3f4f6;
  }
}
</style>
