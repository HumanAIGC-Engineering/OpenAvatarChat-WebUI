<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    message: string,
    role: string,
    style?: string
  }>(),
  {}
)
</script>

<template>
  <div :class="['answer-message-container', role]" :style="style">
    <div class="answer-message-text">
      {{ message }}
    </div>
  </div>
</template>

<style scoped lang="less">
.answer-message-container {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  color: #26244c;

  &.human {
    background: #dddddd99;
    // margin-left: 20px;
    margin-right: 0;
  }

  &.avatar {
    background: #9189fa;
    color: #ffffff;
    // margin-right: 20px;
  }
}
</style>
