<script setup lang="ts">
import { StreamState } from '@/interface/voiceChat';
import { computed, onUnmounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    streamState: StreamState;
    audioSourceCallback: () => MediaStream | null;
    icon: string;
    iconButtonColor: string;
    pulseColor: string;
    iconRadius: number;
  }>(),
  {
    streamState: StreamState.closed,
    iconButtonColor: 'var(--color-accent)',
    pulseColor: 'var(--color-accent)',
    iconRadius: 50,
  },
);

let audioContext: AudioContext;
let analyser: AnalyserNode;
let dataArray: Uint8Array;
let animationId: number;
let pulseScale = ref(1);
let pulseIntensity = ref(0);

watch(
  () => props.streamState,
  () => {
    if (props.streamState === 'open') setupAudioContext();
  },
);

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (audioContext) {
    audioContext.close();
  }
});

function setupAudioContext() {
  // @ts-ignore
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  const mediaStream = props.audioSourceCallback();
  if (mediaStream) {
    const source = audioContext.createMediaStreamSource(mediaStream);

    source.connect(analyser);

    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    updateVisualization();
  }
}

function updateVisualization() {
  analyser.getByteFrequencyData(dataArray);

  // Calculate average amplitude for pulse effect
  const average = Array.from(dataArray).reduce((a, b) => a + b, 0) / dataArray.length;
  const normalizedAverage = average / 255;
  pulseScale.value = 1 + normalizedAverage * 0.15;
  pulseIntensity.value = normalizedAverage;
  animationId = requestAnimationFrame(updateVisualization);
}

const maxPulseScale = computed(() => 1 + pulseIntensity.value * 10); // Scale from 1x to 3x based on intensity
</script>

<template>
  <div class="gradio-webrtc-icon-wrapper">
    <div class="gradio-webrtc-pulsing-icon-container">
      <template v-if="pulseIntensity > 0">
        <template v-for="(_, i) in Array(3)" :key="i">
          <div
            class="pulse-ring"
            :style="{
              background: pulseColor,
              'animation-delay': `${i * 0.4}s`,
              '--max-scale': maxPulseScale,
              opacity: 0.5 * pulseIntensity,
            }"
          />
        </template>
      </template>

      <div
        class="gradio-webrtc-pulsing-icon"
        :style="{ transform: `scale(${pulseScale})`, background: iconButtonColor }"
      >
        <template v-if="typeof icon === 'string'">
          <img
            :src="icon"
            alt="Audio visualization icon"
            class="icon-image"
            :style="{ 'border-radius': `${iconRadius}%` }"
          />
        </template>
        <template v-else-if="icon === undefined">
          <div></div>
        </template>
        <template v-else>
          <div>
            <component :is="icon" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.gradio-webrtc-icon-wrapper {
  position: relative;
  display: flex;
  max-height: 128px;
  justify-content: center;
  align-items: center;
}

.gradio-webrtc-pulsing-icon-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.gradio-webrtc-pulsing-icon {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  transition: transform 0.1s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2;
}

.icon-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  opacity: 0.5;
  min-width: 18px;
  min-height: 18px;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.5;
  }

  100% {
    transform: translate(-50%, -50%) scale(var(--max-scale, 3));
    opacity: 0;
  }
}
</style>
