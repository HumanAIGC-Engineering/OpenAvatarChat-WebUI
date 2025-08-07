export function getDevices(): Promise<MediaDeviceInfo[]> {
  return navigator.mediaDevices.enumerateDevices()
}

export function handleError(error: string): void {
  throw new Error(error)
}

export function setLocalStream(
  local_stream: MediaStream | null,
  video_source: HTMLVideoElement,
): void {
  video_source.srcObject = local_stream
  video_source.muted = true
  video_source.play()
}

export async function getStream(
  audio: boolean | { deviceId: { exact: string } },
  video: boolean | { deviceId: { exact: string } },
  track_constraints?: {
    video: MediaTrackConstraints | boolean
    audio: MediaTrackConstraints | boolean
  },
): Promise<MediaStream> {
  const video_fallback_constraints = (track_constraints as any)?.video ||
    track_constraints || {
      width: { ideal: 500 },
      height: { ideal: 500 },
    }
  const audio_fallback_constraints = (track_constraints as any)?.audio ||
    track_constraints || {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }
  const constraints = {
    video:
      typeof video === 'object'
        ? { ...video, ...video_fallback_constraints }
        : video,
    audio:
      typeof audio === 'object'
        ? { ...audio, ...audio_fallback_constraints }
        : audio,
  }
  console.log(constraints, 'constraints')
  return navigator.mediaDevices
    .getUserMedia(constraints)
    .then((local_stream: MediaStream) => {
      console.log(local_stream)
      return local_stream
    })
}

export function setAvailableDevices(
  devices: MediaDeviceInfo[],
  kind: 'videoinput' | 'audioinput' = 'videoinput',
): MediaDeviceInfo[] {
  const cameras = devices.filter(
    (device: MediaDeviceInfo) => device.kind === kind,
  )

  return cameras
}

let video_track: MediaStreamTrack | null = null
let audio_track: MediaStreamTrack | null = null

export function createSimulatedVideoTrack(width = 1, height = 1) {
  // if (video_track) return video_track
  // 创建一个 canvas 元素
  const canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  canvas.width = width || 500
  canvas.height = height || 500
  canvas.style.width = '1px'
  canvas.style.height = '1px'
  canvas.style.position = 'fixed'
  canvas.style.visibility = 'hidden'
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

  ctx.fillStyle = `hsl(0,0, 0, 1)` // 动态颜色
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const time = 0
  // 在 canvas 上绘制动画内容
  function drawFrame() {
    // ctx.fillStyle = `rgb(0, ${(Date.now() / 10) % 360}, 1)`; // 动态颜色
    ctx.fillStyle = `rgb(255, 255, 255)` // 动态颜色

    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // ctx.font = 'bold 50px Arial';
    // ctx.fillStyle = `rgb(0, 0, 0)`;
    // ctx.fillText(String(time++), 100, 100)
    requestAnimationFrame(drawFrame)
  }
  drawFrame()

  // 捕获 canvas 的视频流
  const stream = canvas.captureStream(30) // 30 FPS
  video_track = stream.getVideoTracks()[0] // 返回视频轨道
  video_track.stop = () => {
    canvas.remove()
  }
  video_track.onended = () => {
    video_track?.stop()
  }
  return video_track
}

export function createSimulatedAudioTrack() {
  if (audio_track) return audio_track
  // @ts-ignore webkitAudioContext兼容
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const oscillator = audioContext.createOscillator()
  oscillator.frequency.setValueAtTime(0, audioContext.currentTime)

  const gainNode = audioContext.createGain()
  gainNode.gain.setValueAtTime(0, audioContext.currentTime)

  const destination = audioContext.createMediaStreamDestination()
  oscillator.connect(gainNode)
  gainNode.connect(destination)
  oscillator.start()

  audio_track = destination.stream.getAudioTracks()[0]
  audio_track.stop = () => {
    audioContext.close()
  }
  audio_track.onended = () => {
    audio_track?.stop()
  }
  return audio_track
}
