// heartbeat-worker.js - 心跳 Worker，不受浏览器后台限制

let heartbeatInterval = null

self.onmessage = function (e) {
  const { type, interval } = e.data

  switch (type) {
    case 'start':
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
      }
      heartbeatInterval = setInterval(() => {
        self.postMessage({ type: 'heartbeat' })
      }, interval || 10000)
      break

    case 'stop':
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
        heartbeatInterval = null
      }
      break
  }
}
