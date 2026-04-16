/* eslint-disable @typescript-eslint/explicit-function-return-type */
class MicProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const { targetSampleRate = 16000 } = options.processorOptions || {}
    this.targetSampleRate = targetSampleRate
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) {
      return true
    }

    const channelData = input[0]
    const ratio = sampleRate / this.targetSampleRate
    const length = Math.floor(channelData.length / ratio)
    const pcm = new Int16Array(length)

    for (let i = 0; i < length; i++) {
      const start = Math.floor(i * ratio)
      const end = Math.floor((i + 1) * ratio)
      let sum = 0
      let count = 0
      for (let j = start; j < end && j < channelData.length; j++) {
        sum += channelData[j]
        count++
      }
      const sample = count ? sum / count : 0
      const clamped = Math.max(-1, Math.min(1, sample))
      pcm[i] = clamped * 0x7fff
    }

    this.port.postMessage({ pcm }, [pcm.buffer])
    return true
  }
}

registerProcessor('mic-processor', MicProcessor)
