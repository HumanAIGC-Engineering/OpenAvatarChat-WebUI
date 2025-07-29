<template>
  <component
    :is="icon"
    class="icon"
    :style="{ fontSize: fontSize + 'px', color }"
  ></component>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    color?: string
    fontSize?: number
    icon: any
  }>(),
  {}
)
const emit = defineEmits([])
</script>

<style scoped lang="less">
.icon {
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
  fill: currentColor;
  overflow: hidden;
  color: inherit;
  font-size: inherit;
}
</style>
