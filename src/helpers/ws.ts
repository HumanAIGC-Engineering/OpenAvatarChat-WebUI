import EventEmitter from 'eventemitter3'
import { WsEventTypes } from '../interface/eventType'

export class WS extends EventEmitter {
  engine: WebSocket | undefined

  private _inited = false

  constructor(url: string) {
    super()
    this._init(url)
  }
  private _init(url: string) {
    if (this._inited) {
      return
    }
    this._inited = true
    this.engine = new WebSocket(url)
    this.engine.addEventListener('error', (event) => {
      this.emit(WsEventTypes.WS_ERROR, event)
    })
    this.engine.addEventListener('open', () => {
      this.emit(WsEventTypes.WS_OPEN)
    })
    this.engine.addEventListener('message', (event) => {
      this.emit(WsEventTypes.WS_MESSAGE, event.data)
    })
    this.engine.addEventListener('close', () => {
      this.emit(WsEventTypes.WS_CLOSE)
    })
  }
  send(data: string | Int8Array | Uint8Array) {
    this.engine?.send(data)
  }
  stop() {
    this.emit(WsEventTypes.WS_CLOSE)
    this._inited = false
    this.engine?.close()
  }
}
