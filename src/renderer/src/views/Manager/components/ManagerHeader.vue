<script setup lang="ts">
import { ref } from 'vue'
import type { ConnectionStatus } from '../managerTypes'
import { Button, Modal, Input, message } from 'ant-design-vue'
import { SettingOutlined } from '@ant-design/icons-vue'
const props = defineProps<{
  status: ConnectionStatus
  statusTextMap: Record<ConnectionStatus, string>
  statusClassMap: Record<ConnectionStatus, string>
}>()

const emit = defineEmits<{
  (e: 'reconnect'): void
}>()

const handleReconnect = (): void => {
  emit('reconnect')
}

// Auth 设置弹窗
const authModalVisible = ref(false)
const authOpenAvatarChat = ref('')

const openAuthModal = (): void => {
  // 读取当前 localStorage 中的值
  authOpenAvatarChat.value = localStorage.getItem('auth_openavatarchat') || ''
  authModalVisible.value = true
}

const handleAuthSave = (): void => {
  // 保存到 localStorage
  if (authOpenAvatarChat.value) {
    localStorage.setItem('auth_openavatarchat', authOpenAvatarChat.value)
  } else {
    localStorage.removeItem('auth_openavatarchat')
  }
  localStorage.removeItem('auth_robot')

  message.success('认证信息已保存')
  authModalVisible.value = false
}

const handleAuthCancel = (): void => {
  authModalVisible.value = false
}
</script>

<template>
  <header class="manager__header">
    <div>
      <div class="manager__title">OpenAvatarChat</div>
      <div class="manager__subtitle">实时会话列表 + 详情</div>
    </div>
    <div class="manager__header-actions">
      <Button size="small" type="text" @click="openAuthModal">
        <template #icon><SettingOutlined /></template>
        认证设置
      </Button>
      <div class="manager__status" :class="props.statusClassMap[props.status]">
        <span class="manager__status-dot" />
        <span>{{ props.statusTextMap[props.status] }}</span>
        <Button size="small" type="link" @click="handleReconnect">重新连接</Button>
      </div>
    </div>

    <!-- Auth 设置弹窗 -->
    <Modal
      v-model:open="authModalVisible"
      title="认证设置"
      :width="480"
      @ok="handleAuthSave"
      @cancel="handleAuthCancel"
    >
      <div class="auth-form">
        <div class="auth-form__item">
          <label class="auth-form__label">OpenAvatarChat Token</label>
          <Input.Password
            v-model:value="authOpenAvatarChat"
            placeholder="请输入 auth_openavatarchat"
            allow-clear
          />
          <div class="auth-form__hint">用于连接 OpenAvatarChat 服务的认证令牌</div>
        </div>
      </div>
    </Modal>
  </header>
</template>

<style scoped lang="less">
.manager__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.manager__header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.manager__title {
  font-size: 22px;
  font-weight: 700;
  color: #131928;
}

.manager__subtitle {
  color: #5f6b7a;
  font-size: 13px;
  margin-top: 4px;
}

.manager__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 12px;
  background: #f0f4ff;
  color: #27314f;
  font-size: 13px;
  border: 1px solid #dfe6f6;
  box-shadow: 0 4px 12px rgba(39, 49, 79, 0.08);
}

.manager__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  background: #8e95a3;
}

.manager__status.is-connecting .manager__status-dot {
  background: #f4a11e;
}

.manager__status.is-open .manager__status-dot {
  background: #34c759;
}

.manager__status.is-closed .manager__status-dot {
  background: #b0b8c4;
}

.manager__status.is-error .manager__status-dot {
  background: #ff4d4f;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;

  &__item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__label {
    font-weight: 500;
    color: #1f2937;
    font-size: 14px;
  }

  &__hint {
    font-size: 12px;
    color: #6b7280;
  }
}
</style>
