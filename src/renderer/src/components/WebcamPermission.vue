<script setup lang="ts">
import { useMediaStore } from '@/store/media'
import { VideoCameraOutlined } from '@ant-design/icons-vue'
import { onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    autoAccess?: boolean
  }>(),
  {
    autoAccess: false,
  }
)
const mediaState = useMediaStore()
const accessClick = async (): Promise<void> => {
  mediaState.accessDevice()
}
onMounted(() => {
  if (props.autoAccess) {
    accessClick() //自动获取权限
  }
})

const text = '点击允许访问摄像头和麦克风'
</script>

<template>
  <div v-show="!autoAccess" class="access-wrap" @click="accessClick">
    <span class="icon-wrap">
      <VideoCameraOutlined />
    </span>
    {{ text }}
  </div>
</template>
<style lang="less" scoped>
.access-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.icon-wrap {
  width: 30px;
  font-size: 40px;
}
</style>
