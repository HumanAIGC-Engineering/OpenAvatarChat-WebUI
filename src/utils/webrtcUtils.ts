export function createPeerConnection(
  pc: RTCPeerConnection,
  node: {
    srcObject: any
    volume: number
    muted: boolean
    autoplay: boolean
    play: () => Promise<any>
  },
) {
  // register some listeners to help debugging
  pc.addEventListener(
    'icegatheringstatechange',
    () => {
      console.debug(pc.iceGatheringState)
    },
    false,
  )

  pc.addEventListener(
    'iceconnectionstatechange',
    () => {
      console.debug(pc.iceConnectionState)
    },
    false,
  )

  pc.addEventListener(
    'signalingstatechange',
    () => {
      console.debug(pc.signalingState)
    },
    false,
  )

  // connect audio / video from server to local
  pc.addEventListener('track', (evt) => {
    console.debug('track event listener')
    if (node && node.srcObject !== evt.streams[0]) {
      console.debug('streams', evt.streams)
      node.srcObject = evt.streams[0]
      console.debug('node.srcOject', node.srcObject)
      if (evt.track.kind === 'audio') {
        node.volume = 1.0 // Ensure volume is up
        node.muted = false
        node.autoplay = true
        // Attempt to play (needed for some browsers)
        node.play().catch((e) => console.debug('Autoplay failed:', e))
      }
    }
  })

  return pc
}

export async function start(
  stream: MediaStream,
  pc: RTCPeerConnection,
  node: {
    srcObject: any
    volume: number
    muted: boolean
    autoplay: boolean
    play: () => Promise<any>
  },
  server_fn: any,
  webrtc_id: string,
  modality: 'video' | 'audio' = 'video',
  on_change_cb: (msg: 'change' | 'tick') => void = () => {},
  rtp_params = {},
  additional_message_cb: (msg: object) => void = () => {},
  reject_cb: (msg: object) => void = () => {},
) {
  pc = createPeerConnection(pc, node)
  const data_channel = pc.createDataChannel('text')

  data_channel.onopen = () => {
    console.debug('Data channel is open')
    data_channel.send('handshake')
    data_channel.send(JSON.stringify({ type: 'init' }))
  }

  data_channel.onmessage = (event) => {
    console.debug('Received message:', event.data)
    let event_json
    try {
      event_json = JSON.parse(event.data)
    } catch (e) {
      console.debug('Error parsing JSON')
    }
    if (
      event.data === 'change' ||
      event.data === 'tick' ||
      event.data === 'stopword' ||
      event_json?.type === 'warning' ||
      event_json?.type === 'error' ||
      event_json?.type === 'send_input' ||
      event_json?.type === 'fetch_output' ||
      event_json?.type === 'stopword' ||
      event_json?.type === 'end_stream'
    ) {
      on_change_cb(event_json ?? event.data)
    }
    additional_message_cb(event_json ?? event.data)
  }

  if (stream) {
    stream.getTracks().forEach(async (track) => {
      console.debug('Track stream callback', track)
      const sender = pc.addTrack(track, stream)
      const params = sender.getParameters()
      const updated_params = { ...params, ...rtp_params }
      await sender.setParameters(updated_params)
      console.debug('sender params', sender.getParameters())
    })
  } else {
    console.debug('Creating transceiver!')
    pc.addTransceiver(modality, { direction: 'recvonly' })
  }

  await negotiate(pc, server_fn, webrtc_id, reject_cb)
  const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
  console.log('sender', sender)
  return [pc, data_channel] as const
}

function make_offer(
  server_fn: any,
  body: { sdp: string; type: RTCSdpType; webrtc_id: string },
  reject_cb: (msg: object) => void = () => {},
): Promise<any> {
  return new Promise((resolve, reject) => {
    server_fn(body).then((data: any) => {
      console.debug('data', data)
      if (data?.status === 'failed') {
        reject_cb(data)
        console.debug('rejecting')
        reject('error')
      }
      resolve(data)
    })
  })
}

async function negotiate(
  pc: RTCPeerConnection,
  server_fn: any,
  webrtc_id: string,
  reject_cb: (msg: object) => void = () => {},
): Promise<void> {
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      console.debug('Sending ICE candidate', candidate)
      server_fn({
        candidate: candidate.toJSON(),
        webrtc_id,
        type: 'ice-candidate',
      }).catch((err: any) => console.error('Error sending ICE candidate:', err))
    }
  }

  return pc
    .createOffer()
    .then((offer) => {
      return pc.setLocalDescription(offer)
    })
    .then(() => {
      const offer = pc.localDescription!
      return make_offer(
        server_fn,
        {
          sdp: offer.sdp,
          type: offer.type,
          webrtc_id,
        },
        reject_cb,
      )
    })
    .then((response) => {
      return response
    })
    .then((answer) => {
      return pc.setRemoteDescription(answer)
    })
}

export function stop(pc: RTCPeerConnection) {
  console.debug('Stopping peer connection')
  // close transceivers
  if (pc.getTransceivers) {
    pc.getTransceivers().forEach((transceiver) => {
      if (transceiver.stop) {
        transceiver.stop()
      }
    })
  }

  // close local audio / video
  if (pc.getSenders()) {
    pc.getSenders().forEach((sender) => {
      console.log('sender', sender)
      if (sender.track && sender.track.stop) sender.track.stop()
    })
  }

  // close peer connection
  setTimeout(() => {
    pc.close()
  }, 500)
}

export async function setupWebRTC(
  stream: MediaStream,
  peerConnection: RTCPeerConnection,
  remoteNode: HTMLVideoElement,
) {
  //  Send audio-video stream to server
  stream.getTracks().forEach(async (track) => {
    const sender = peerConnection.addTrack(track, stream)
  })

  peerConnection.addEventListener('track', (evt) => {
    if (remoteNode && remoteNode.srcObject !== evt.streams[0]) {
      remoteNode.srcObject = evt.streams[0]
    }
  })

  // Create data channel (needed!)
  const dataChannel = peerConnection.createDataChannel('text')

  // Create and send offer
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)

  const webrtc_id = Math.random().toString(36).substring(7)

  // Send ICE candidates to server
  // (especially needed when server is behind firewall)
  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      console.debug('Sending ICE candidate', candidate)
      fetch('/webrtc/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: candidate.toJSON(),
          webrtc_id,
          type: 'ice-candidate',
        }),
      })
    }
  }

  // Send offer to server
  const response = await fetch('/webrtc/offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sdp: offer.sdp,
      type: offer.type,
      webrtc_id,
    }),
  })

  // Handle server response
  const serverResponse = await response.json()
  await peerConnection.setRemoteDescription(serverResponse)
  return [dataChannel, webrtc_id]
}
