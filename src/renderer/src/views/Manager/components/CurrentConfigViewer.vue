<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Collapse, Empty, Tag } from 'ant-design-vue'
import { useManagerStore } from '@/store/manager'

const managerStore = useManagerStore()
const { currentConfig } = storeToRefs(managerStore)

const handlerEntries = computed(() => {
  const configs = currentConfig.value?.handler_configs
  if (!configs) return []

  return Object.entries(configs)
    .map(([name, value]) => ({
      name,
      display: JSON.stringify(value || {}, null, 2),
      fields: Object.keys(value || {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<template>
  <section class="current-config-viewer">
    <div class="current-config-viewer__header">
      <h3 class="current-config-viewer__title">当前配置</h3>
      <span v-if="currentConfig?.model_root" class="current-config-viewer__meta">
        model_root: {{ currentConfig.model_root }}
      </span>
      <Tag v-if="typeof currentConfig?.concurrent_limit === 'number'" color="blue">
        并发上限 {{ currentConfig.concurrent_limit }}
      </Tag>
    </div>

    <div v-if="!currentConfig" class="current-config-viewer__empty">
      <Empty description="等待 current_config 消息..." />
    </div>

    <template v-else>
      <div class="current-config-viewer__summary">handler 数量：{{ handlerEntries.length }}</div>

      <Collapse
        v-if="handlerEntries.length > 0"
        class="current-config-viewer__collapse"
        :bordered="false"
        expand-icon-position="end"
      >
        <Collapse.Panel
          v-for="handler in handlerEntries"
          :key="handler.name"
          :header="`${handler.name}（${handler.fields.length} 个字段）`"
        >
          <div class="current-config-viewer__handler-tags">
            <Tag v-if="handler.fields.length === 0" color="default">空配置</Tag>
            <Tag v-for="field in handler.fields" :key="field" color="processing">{{ field }}</Tag>
          </div>
          <pre class="current-config-viewer__json">{{ handler.display }}</pre>
        </Collapse.Panel>
      </Collapse>

      <div v-else class="current-config-viewer__empty-tip">当前配置未包含 handler_configs</div>
    </template>
  </section>
</template>

<style scoped lang="less">
.current-config-viewer {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 6px 16px rgba(31, 48, 84, 0.06);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.current-config-viewer__header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.current-config-viewer__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #27314f;
}

.current-config-viewer__meta {
  color: #6b7280;
  font-size: 12px;
}

.current-config-viewer__summary {
  color: #4b5563;
  font-size: 12px;
}

.current-config-viewer__collapse {
  background: transparent;
}

.current-config-viewer__handler-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.current-config-viewer__json {
  margin: 0;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  line-height: 1.45;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 280px;
  overflow: auto;
}

.current-config-viewer__empty,
.current-config-viewer__empty-tip {
  color: #9ca3af;
  font-size: 13px;
}
</style>
