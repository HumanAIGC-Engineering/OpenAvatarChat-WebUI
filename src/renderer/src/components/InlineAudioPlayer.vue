<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useSSL, serverOrigin } from '@renderer/apis/base'

const props = withDefaults(
  defineProps<{
    src: string
    dark?: boolean
  }>(),
  { dark: false }
)

const emit = defineEmits<{
  (e: 'download'): void
}>()
const downloadAudio = (): void => {
  emit('download')
}

const audioEl = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const isLoaded = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const blobUrl = ref<string | null>(null)

// 规范化 URL：添加协议头
const normalizeUrl = (url: string): string => {
  if (!url) return url
  // 已经有协议头的直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  // 以 / 开头的是相对路径，拼接 serverOrigin
  if (url.startsWith('/')) {
    return `${serverOrigin}${url}`
  }
  // 其他情况添加协议头
  const protocol = useSSL ? 'https://' : 'http://'
  return `${protocol}${url}`
}

// 带认证的音频加载
const loadAudioWithAuth = async (): Promise<void> => {
  const fullUrl = normalizeUrl(props.src)

  try {
    const token = localStorage.getItem('auth_openavatarchat')
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await window.fetch(fullUrl, { headers })

    if (!response.ok) {
      throw new Error(`Failed to load audio: ${response.status}`)
    }

    const blob = await response.blob()
    // 清理旧的 blob URL
    if (blobUrl.value) {
      URL.revokeObjectURL(blobUrl.value)
    }
    blobUrl.value = URL.createObjectURL(blob)

    if (audioEl.value) {
      audioEl.value.src = blobUrl.value
      audioEl.value.load()
    }
  } catch (e) {
    console.error('加载音频失败，回落到原始URL:', e)
    // 回落到原始 URL
    if (audioEl.value) {
      audioEl.value.src = fullUrl
      audioEl.value.load()
    }
  }
}

// 组件卸载时清理 blob URL
onUnmounted(() => {
  if (blobUrl.value) {
    URL.revokeObjectURL(blobUrl.value)
  }
})

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const progress = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

const displayTime = computed(() => {
  return `${formatTime(currentTime.value)} / ${formatTime(duration.value)}`
})

const handleLoadedMetadata = (): void => {
  if (audioEl.value) {
    duration.value = audioEl.value.duration
    isLoaded.value = true
  }
}

const handleTimeUpdate = (): void => {
  if (audioEl.value) {
    currentTime.value = audioEl.value.currentTime
  }
}

const handleEnded = (): void => {
  isPlaying.value = false
  currentTime.value = 0
  if (audioEl.value) {
    audioEl.value.currentTime = 0
  }
}

const isLoading = ref(false)

const togglePlay = async (): Promise<void> => {
  if (!audioEl.value || isLoading.value) return

  // 首次点击时通过认证加载音频
  if (!isLoaded.value && !blobUrl.value) {
    isLoading.value = true
    await loadAudioWithAuth()
    isLoading.value = false
  }

  if (isPlaying.value) {
    audioEl.value.pause()
    isPlaying.value = false
  } else {
    try {
      await audioEl.value.play()
      isPlaying.value = true
    } catch (e) {
      console.error('播放失败:', e)
    }
  }
}

const handleProgressClick = (e: MouseEvent): void => {
  if (!audioEl.value || duration.value === 0) return
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percentage = Math.max(0, Math.min(x / rect.width, 1))
  const newTime = percentage * duration.value
  audioEl.value.currentTime = newTime
  currentTime.value = newTime
}
</script>

<template>
  <span class="audio-player" :class="{ 'is-dark': props.dark }">
    <audio
      ref="audioEl"
      preload="none"
      @loadedmetadata="handleLoadedMetadata"
      @timeupdate="handleTimeUpdate"
      @ended="handleEnded"
    />

    <button class="audio-player__btn" type="button" :disabled="isLoading" @click="togglePlay">
      <span v-if="isLoading" class="audio-player__loading">⏳</span>
      <svg
        v-else-if="!isPlaying"
        class="audio-player__icon"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
      <svg v-else class="audio-player__icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
      </svg>
    </button>

    <div class="audio-player__progress" @click="handleProgressClick">
      <div class="audio-player__track">
        <div class="audio-player__fill" :style="{ width: `${progress}%` }" />
      </div>
    </div>

    <span class="audio-player__time">{{ displayTime }}</span>
    <span class="audio-player__download" @click="downloadAudio">📥</span>
  </span>
</template>

<style scoped lang="less">
.audio-player {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0px 8px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  font-size: 12px;
  user-select: none;
  vertical-align: middle;
  max-width: 180px;
  min-width: 140px;
}

.audio-player__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #6366f1;
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease;
  margin-right: 4px;
  &:hover {
    background: #4f46e5;
  }

  &:active {
    transform: scale(0.95);
  }
}

.audio-player__icon {
  width: 12px;
  height: 12px;
}

.audio-player__loading {
  font-size: 10px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.audio-player__progress {
  flex: 1;
  height: 16px;
  display: flex;
  align-items: center;
  cursor: pointer;
  min-width: 40px;
}

.audio-player__track {
  position: relative;
  width: 100%;
  height: 3px;
  background: rgba(0, 0, 0, 0.12);
  border-radius: 2px;
}

.audio-player__fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: #6366f1;
  border-radius: 2px;
  transition: width 0.05s linear;
}

.audio-player__time {
  color: rgba(0, 0, 0, 0.5);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
}

// 深色背景变体
.audio-player.is-dark {
  background: rgba(255, 255, 255, 0.15);

  .audio-player__track {
    background: rgba(255, 255, 255, 0.25);
  }

  .audio-player__fill {
    background: #fff;
  }

  .audio-player__time {
    color: rgba(255, 255, 255, 0.7);
  }

  .audio-player__btn {
    background: rgba(255, 255, 255, 0.9);
    color: #6366f1;

    &:hover {
      background: #fff;
    }
  }
}
.audio-player__download {
  cursor: pointer;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.5);
  &:hover {
    color: #6366f1;
  }
}
</style>
