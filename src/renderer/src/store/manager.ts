import dagre from 'dagre'
import { message } from 'ant-design-vue'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'

import { createDataToolWS, makeDataToolFileURL } from '@/apis'
import { WsEventTypes } from '@/interface/eventType'
import type {
  ChatDataEvent,
  ChatMessage,
  ChatRole,
  ConnectionStatus,
  CurrentConfig,
  CurrentConfigEvent,
  DataToolStream,
  FlowEdge,
  FlowNode,
  IncomingMessage,
  SessionMessage,
  SessionState,
  SignalEvent,
  SnapshotEvent,
  Timestamp,
} from '@/views/Manager/managerTypes'

export const statusTextMap: Record<ConnectionStatus, string> = {
  idle: '未连接',
  connecting: '连接中',
  open: '已连接',
  closed: '已关闭',
  error: '异常',
}

export const statusClassMap: Record<ConnectionStatus, string> = {
  idle: 'is-idle',
  connecting: 'is-connecting',
  open: 'is-open',
  closed: 'is-closed',
  error: 'is-error',
}

// Per-session flow data
type SessionFlowData = {
  handlerNodes: Record<string, FlowNode>
  signalEdges: Record<string, FlowEdge>
  activeStreams: Record<string, 'active' | 'inactive' | 'timeout'>
}

type ManagerState = {
  status: ConnectionStatus
  connectionError: string
  sessions: Record<string, SessionState>
  selectedSessionId: string | null
  currentConfig: CurrentConfig | null
  currentTime: number
  ticker?: number
  ws: ReturnType<typeof createDataToolWS> | null
  // Vue Flow data for signal visualization, keyed by session ID
  sessionFlowData: Record<string, SessionFlowData>
}

const mediaUrls: string[] = []
// Track pending status change timers
const pendingStatusTimers: Record<string, number> = {}
// Timeout threshold in milliseconds (10 seconds)
const TIMEOUT_THRESHOLD = 10_000
// Minimum active duration before showing inactive (200ms)
const MIN_ACTIVE_DURATION = 200
// Maximum number of sessions to keep
const MAX_SESSIONS = 20
// Session live threshold (1 minute)
const SESSION_LIVE_THRESHOLD = 60_000

export const useManagerStore = defineStore('managerStore', {
  state: (): ManagerState => ({
    status: 'idle',
    connectionError: '',
    sessions: {},
    selectedSessionId: null,
    currentConfig: null,
    currentTime: Date.now(),
    ticker: undefined,
    ws: null,
    sessionFlowData: {},
  }),
  getters: {
    sortedSessions(state): SessionState[] {
      return Object.values(state.sessions).sort((a, b) => {
        const aLive = state.currentTime - a.lastUpdated <= 60_000
        const bLive = state.currentTime - b.lastUpdated <= 60_000
        if (aLive !== bLive) return Number(bLive) - Number(aLive)
        return b.lastUpdated - a.lastUpdated
      })
    },
    activeSession(state): SessionState | undefined {
      return state.selectedSessionId
        ? state.sessions[state.selectedSessionId]
        : this.sortedSessions[0]
    },
    activeMessages(): SessionMessage[] {
      return this.activeSession?.messages || []
    },
    activeChatMessages(): ChatMessage[] {
      return this.activeSession?.chatMessages || []
    },
    activeFlowData(state): SessionFlowData {
      const sessionId = this.activeSession?.id
      if (!sessionId || !state.sessionFlowData[sessionId]) {
        return { handlerNodes: {}, signalEdges: {}, activeStreams: {} }
      }
      return state.sessionFlowData[sessionId]
    },
    flowNodes(): FlowNode[] {
      return Object.values(this.activeFlowData.handlerNodes)
    },
    flowEdges(): FlowEdge[] {
      return Object.values(this.activeFlowData.signalEdges)
    },
  },
  actions: {
    /**
     * Ensure session flow data exists for the given session ID
     */
    ensureSessionFlowData(sessionId: string): SessionFlowData {
      if (!this.sessionFlowData[sessionId]) {
        this.sessionFlowData = {
          ...this.sessionFlowData,
          [sessionId]: {
            handlerNodes: {},
            signalEdges: {},
            activeStreams: {},
          },
        }
      }
      return this.sessionFlowData[sessionId]
    },
    /**
     * Get session flow data (read-only, returns empty if not exists)
     */
    getSessionFlowData(sessionId: string): SessionFlowData {
      return (
        this.sessionFlowData[sessionId] || {
          handlerNodes: {},
          signalEdges: {},
          activeStreams: {},
        }
      )
    },
    start(): void {
      void this.connectWS()
      this.startTicker()
    },
    stop(): void {
      this.cleanupWS()
      this.cleanupMedia()
      this.stopTicker()
    },
    startTicker(): void {
      if (this.ticker !== undefined) return
      this.ticker = window.setInterval(() => {
        this.currentTime = Date.now()
        // Check for timeout nodes (active for more than 10 seconds)
        this.checkNodeTimeouts()
      }, 1000)
    },
    /**
     * Check for nodes that have been active for too long and mark them as timeout
     */
    checkNodeTimeouts(): void {
      const now = Date.now()
      // Check all sessions
      Object.keys(this.sessionFlowData).forEach((sessionId) => {
        this.checkSessionNodeTimeouts(sessionId, now)
      })
    },
    /**
     * Check timeout nodes for a specific session
     */
    checkSessionNodeTimeouts(sessionId: string, now: number): void {
      const flowData = this.sessionFlowData[sessionId]
      if (!flowData) return

      let hasChanges = false

      Object.keys(flowData.handlerNodes).forEach((nodeId) => {
        const node = flowData.handlerNodes[nodeId]
        if (
          node.data.status === 'active' &&
          node.data.activeStartTime &&
          now - node.data.activeStartTime > TIMEOUT_THRESHOLD
        ) {
          // Mark as timeout
          flowData.handlerNodes = {
            ...flowData.handlerNodes,
            [nodeId]: {
              ...node,
              data: {
                ...node.data,
                status: 'timeout',
              },
            },
          }
          flowData.activeStreams = {
            ...flowData.activeStreams,
            [nodeId]: 'timeout',
          }
          hasChanges = true
        }
      })

      // Update edges if there were changes
      if (hasChanges) {
        Object.keys(flowData.signalEdges).forEach((edgeId) => {
          const edge = flowData.signalEdges[edgeId]
          const sourceActive = flowData.activeStreams[edge.source] === 'active'
          const targetActive = flowData.activeStreams[edge.target] === 'active'
          flowData.signalEdges = {
            ...flowData.signalEdges,
            [edgeId]: {
              ...edge,
              animated: sourceActive && targetActive,
            },
          }
        })
        // Trigger reactivity
        this.sessionFlowData = { ...this.sessionFlowData, [sessionId]: { ...flowData } }
      }
    },
    stopTicker(): void {
      if (this.ticker !== undefined) {
        window.clearInterval(this.ticker)
        this.ticker = undefined
      }
    },
    /**
     * Re-layout nodes using dagre to ensure data flows left to right
     */
    layoutNodes(sessionId: string): void {
      const flowData = this.sessionFlowData[sessionId]
      if (!flowData) return

      const nodes = flowData.handlerNodes
      const edges = flowData.signalEdges

      if (Object.keys(nodes).length === 0) return

      // Create a new dagre graph
      const dagreGraph = new dagre.graphlib.Graph()
      dagreGraph.setDefaultEdgeLabel(() => ({}))

      // Set graph direction to LR (left to right)
      dagreGraph.setGraph({
        rankdir: 'LR', // Left to Right
        nodesep: 40, // Vertical separation between nodes
        ranksep: 30, // Horizontal separation between ranks/levels
        marginx: 20,
        marginy: 20,
      })

      // Node dimensions (smaller nodes)
      const NODE_WIDTH = 120
      const NODE_HEIGHT = 40

      // Add nodes to dagre graph
      Object.values(nodes).forEach((node) => {
        dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
      })

      // Add edges to dagre graph
      Object.values(edges).forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
      })

      // Run dagre layout algorithm
      dagre.layout(dagreGraph)

      // Update node positions from dagre results
      const updatedNodes: Record<string, FlowNode> = {}
      Object.values(nodes).forEach((node) => {
        const dagreNode = dagreGraph.node(node.id)
        if (dagreNode) {
          updatedNodes[node.id] = {
            ...node,
            position: {
              // Dagre returns center position, adjust to top-left for vue-flow
              x: dagreNode.x - NODE_WIDTH / 2,
              y: dagreNode.y - NODE_HEIGHT / 2,
            },
          }
        } else {
          updatedNodes[node.id] = node
        }
      })

      flowData.handlerNodes = updatedNodes
      // Trigger reactivity
      this.sessionFlowData = { ...this.sessionFlowData, [sessionId]: { ...flowData } }
    },
    selectSession(sessionId: string): void {
      this.selectedSessionId = sessionId
    },
    timestampToMs(ts: Timestamp): number {
      if (!ts) return Date.now()
      if (Array.isArray(ts)) {
        return ts[0] * 1000 + ts[1] / 1_000_000
      }
      return Math.round(ts)
    },
    ensureSession(sessionId: string, owner?: string): SessionState {
      const existing = this.sessions[sessionId]
      const next: SessionState = existing
        ? existing
        : ({
            id: sessionId,
            owner,
            messages: [],
            chatMessages: [],
            lastUpdated: Date.now(),
          } satisfies SessionState)
      if (!existing) {
        // Enforce session limit before adding new session
        this.enforceSessionLimit()
        this.sessions = { ...this.sessions, [sessionId]: next }
        // Always select the new session
        this.selectedSessionId = sessionId
      } else if (owner && !existing.owner) {
        this.sessions = { ...this.sessions, [sessionId]: { ...existing, owner } }
      }
      return this.sessions[sessionId] || next
    },
    upsertSession(session: SessionState): void {
      this.sessions = { ...this.sessions, [session.id]: session }
    },
    /**
     * Update session's lastUpdated timestamp
     */
    updateSessionLastUpdated(sessionId: string): void {
      const session = this.sessions[sessionId]
      if (session) {
        this.sessions = {
          ...this.sessions,
          [sessionId]: { ...session, lastUpdated: Date.now() },
        }
      }
    },
    /**
     * Remove a session by ID
     */
    removeSession(sessionId: string): void {
      if (!this.sessions[sessionId]) return

      // Remove session
      const remainingSessions = { ...this.sessions }
      delete remainingSessions[sessionId]
      this.sessions = remainingSessions

      // Remove associated flow data
      if (this.sessionFlowData[sessionId]) {
        const remainingFlowData = { ...this.sessionFlowData }
        delete remainingFlowData[sessionId]
        this.sessionFlowData = remainingFlowData
      }

      // Clear pending timers for this session
      Object.keys(pendingStatusTimers).forEach((key) => {
        if (key.startsWith(`${sessionId}:`)) {
          window.clearTimeout(pendingStatusTimers[key])
          delete pendingStatusTimers[key]
        }
      })

      // If removed session was selected, select another one
      if (this.selectedSessionId === sessionId) {
        const sortedSessions = this.sortedSessions
        this.selectedSessionId = sortedSessions.length > 0 ? sortedSessions[0].id : null
      }
    },
    /**
     * Enforce maximum session limit by removing inactive sessions
     */
    enforceSessionLimit(): void {
      const sessionCount = Object.keys(this.sessions).length
      // Need to reserve space for the new session being added
      if (sessionCount < MAX_SESSIONS) return

      const now = this.currentTime
      // Sort sessions: inactive first (by lastUpdated), then active
      const sortedForRemoval = Object.values(this.sessions).sort((a, b) => {
        const aLive = now - a.lastUpdated <= SESSION_LIVE_THRESHOLD
        const bLive = now - b.lastUpdated <= SESSION_LIVE_THRESHOLD
        // Inactive sessions come first (to be removed)
        if (aLive !== bLive) return Number(aLive) - Number(bLive)
        // Among same status, older ones come first
        return a.lastUpdated - b.lastUpdated
      })

      // Remove excess sessions (inactive ones first), +1 to make room for the new session
      const toRemoveCount = sessionCount - MAX_SESSIONS + 1
      for (let i = 0; i < toRemoveCount && i < sortedForRemoval.length; i++) {
        this.removeSession(sortedForRemoval[i].id)
      }
    },
    formatTs(ts: number): string {
      return new Date(ts).toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    },
    resolveRoleFromDataType(dataType?: ChatDataEvent['data_type']): ChatRole {
      return dataType?.startsWith('human') ? 'human' : 'avatar'
    },
    addChatMessage(sessionId: string, message: SessionMessage): void {
      const session = this.ensureSession(sessionId)
      const messages = session.chatMessages
      const targetStream = message.ref_streams?.[message.ref_streams?.length - 1] || message.stream
      if (targetStream) {
        let refMessage: ChatMessage | undefined
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          const item = messages[i]
          if (
            (item.type === 'chat_message' &&
              item.textStream?.stream_id === targetStream?.stream_id &&
              item.textStream?.builder_id === targetStream?.builder_id) ||
            (item.audioStream?.stream_id === targetStream?.stream_id &&
              item.audioStream?.builder_id === targetStream?.builder_id)
          ) {
            refMessage = item as ChatMessage
            break
          }
        }
        if (refMessage) {
          if (
            message.dataType === 'avatar_audio' ||
            message.dataType === 'human_audio' ||
            message.dataType === 'human_duplex_audio'
          ) {
            refMessage.audioUrl = message.filePath
              ? makeDataToolFileURL(message.filePath)
              : undefined
            refMessage.audioStream = {
              ...message.stream,
              stream_meta: message.stream_meta,
            } as DataToolStream
          } else if (
            message.dataType === 'avatar_text' ||
            message.dataType === 'human_text' ||
            message.dataType === 'human_duplex_text'
          ) {
            if (message.dataType === 'human_text') {
              refMessage.originalText += message.text || ''
            } else {
              refMessage.text += message.text || ''
              refMessage.textStream = {
                ...message.stream,
                stream_meta: message.stream_meta,
              } as DataToolStream
            }
          }
        } else {
          if (
            message.dataType === 'avatar_audio' ||
            message.dataType === 'human_audio' ||
            message.dataType === 'human_duplex_audio'
          ) {
            messages.push({
              type: 'chat_message',
              text: '',
              role: this.resolveRoleFromDataType(message.dataType),
              textStream: {},
              audioStream: {
                ...message.stream,
                stream_meta: message.stream_meta,
              } as DataToolStream,
              audioUrl: message.filePath ? makeDataToolFileURL(message.filePath) : undefined,
              timestamp: message.ts,
            })
          } else if (
            message.dataType === 'avatar_text' ||
            message.dataType === 'human_text' ||
            message.dataType === 'human_duplex_text'
          ) {
            messages.push({
              type: 'chat_message',
              text: message.text || '',
              role: this.resolveRoleFromDataType(message.dataType),
              textStream: { ...message.stream, stream_meta: message.stream_meta } as DataToolStream,
              audioStream: undefined,
              audioUrl: undefined,
              timestamp: message.ts,
            })
          }
        }
      }
    },
    /**
     * Update node status with optional delay
     */
    updateNodeStatus(
      sessionId: string,
      nodeId: string,
      status: 'active' | 'inactive' | 'timeout'
    ): void {
      const flowData = this.sessionFlowData[sessionId]
      if (!flowData) return

      const node = flowData.handlerNodes[nodeId]
      if (!node) return

      flowData.handlerNodes = {
        ...flowData.handlerNodes,
        [nodeId]: {
          ...node,
          data: {
            ...node.data,
            status,
            lastUpdated: Date.now(),
            activeStartTime: status === 'active' ? Date.now() : node.data.activeStartTime,
          },
        },
      }

      flowData.activeStreams = {
        ...flowData.activeStreams,
        [nodeId]: status,
      }

      // Update edges connected to this node
      Object.keys(flowData.signalEdges).forEach((edgeId) => {
        const edge = flowData.signalEdges[edgeId]
        if (edge.source === nodeId || edge.target === nodeId) {
          const sourceActive = flowData.activeStreams[edge.source] === 'active'
          const targetActive = flowData.activeStreams[edge.target] === 'active'
          flowData.signalEdges = {
            ...flowData.signalEdges,
            [edgeId]: {
              ...edge,
              animated: sourceActive && targetActive,
            },
          }
        }
      })

      // Trigger reactivity
      this.sessionFlowData = { ...this.sessionFlowData, [sessionId]: { ...flowData } }
    },
    addSignalMessage(sessionId: string, message: SignalEvent): void {
      const { type, source_type, source_name, stream } = message

      // Only process stream_begin and stream_end signals with source_type === 'handler'
      if (type !== 'stream_begin' && type !== 'stream_end') return
      if (source_type !== 'handler') return
      if (!source_name) return

      // Ensure session flow data exists
      const flowData = this.ensureSessionFlowData(sessionId)

      const isActive = type === 'stream_begin'
      // Use source_name as the unique key
      const nodeId = source_name
      const now = Date.now()

      // Timer key includes session ID for isolation
      const timerKey = `${sessionId}:${nodeId}`

      // Clear any pending timer for this node
      if (pendingStatusTimers[timerKey]) {
        window.clearTimeout(pendingStatusTimers[timerKey])
        delete pendingStatusTimers[timerKey]
      }

      // Update or create handler node
      if (flowData.handlerNodes[nodeId]) {
        if (isActive) {
          // stream_begin: immediately set to active and record start time
          flowData.handlerNodes = {
            ...flowData.handlerNodes,
            [nodeId]: {
              ...flowData.handlerNodes[nodeId],
              data: {
                ...flowData.handlerNodes[nodeId].data,
                status: 'active',
                activeStartTime: now,
                startTime: message.timestamp,
                endTime: undefined,
                lastUpdated: now,
              },
            },
          }
          flowData.activeStreams = { ...flowData.activeStreams, [source_name]: 'active' }
        } else {
          // stream_end: check if we need to delay
          const activeStartTime = flowData.handlerNodes[nodeId].data.activeStartTime || 0
          const activeDuration = now - activeStartTime
          flowData.handlerNodes[nodeId].data.endTime = message.timestamp
          if (activeDuration < MIN_ACTIVE_DURATION) {
            // Delay status change to ensure minimum visible duration
            const delay = MIN_ACTIVE_DURATION - activeDuration
            pendingStatusTimers[timerKey] = window.setTimeout(() => {
              this.updateNodeStatus(sessionId, nodeId, 'inactive')
              delete pendingStatusTimers[timerKey]
            }, delay)
          } else {
            // Immediately set to inactive
            this.updateNodeStatus(sessionId, nodeId, 'inactive')
          }
        }
      } else {
        // Create new node with auto-positioned layout
        const existingNodesCount = Object.keys(flowData.handlerNodes).length
        const newNode: FlowNode = {
          id: nodeId,
          type: 'handler',
          position: {
            x: 100 + (existingNodesCount % 4) * 200,
            y: 100 + Math.floor(existingNodesCount / 4) * 120,
          },
          data: {
            label: source_name,
            sourceType: source_type,
            sourceName: source_name,
            status: isActive ? 'active' : 'inactive',
            startTime: message.timestamp,
            endTime: undefined,
            activeStartTime: isActive ? now : undefined,
            lastUpdated: now,
          },
        }
        flowData.handlerNodes = { ...flowData.handlerNodes, [nodeId]: newNode }
        flowData.activeStreams = {
          ...flowData.activeStreams,
          [source_name]: isActive ? 'active' : 'inactive',
        }
      }

      // Helper function to create edge from producer to current node
      const createEdgeFromProducer = (producer: string, refStream?: DataToolStream): void => {
        // Check if producer node exists, if not create it
        if (!flowData.handlerNodes[producer]) {
          const existingNodesCount = Object.keys(flowData.handlerNodes).length
          const producerNode: FlowNode = {
            id: producer,
            type: 'handler',
            position: {
              x: 100 + (existingNodesCount % 4) * 200,
              y: 100 + Math.floor(existingNodesCount / 4) * 120,
            },
            data: {
              label: producer,
              sourceType: 'handler',
              sourceName: producer,
              status: 'inactive',
              lastUpdated: Date.now(),
            },
          }
          flowData.handlerNodes = { ...flowData.handlerNodes, [producer]: producerNode }
        }

        // Create edge from producer to current node
        const edgeId = `${producer}->${nodeId}`
        const producerIsActive = flowData.activeStreams[producer] === 'active'

        flowData.signalEdges = {
          ...flowData.signalEdges,
          [edgeId]: {
            id: edgeId,
            source: producer,
            target: nodeId,
            animated: producerIsActive && isActive,
            data: {
              refStreamId: refStream ? `${refStream.builder_id}-${refStream.stream_id}` : undefined,
            },
          },
        }
      }

      // Use stream.producer to find dependency relationship
      if (stream?.producer && stream.producer !== message.source_name) {
        createEdgeFromProducer(stream.producer || '', stream)
      }

      // Also check ref_streams for producer relationships
      const { ref_streams } = message
      if (stream?.producer === message.source_name && ref_streams && ref_streams.length > 0) {
        ref_streams.forEach((refStream) => {
          if (refStream.producer) {
            createEdgeFromProducer(refStream.producer || '', refStream)
          }
        })
      }

      // Update all edges connected to this node based on active status
      Object.keys(flowData.signalEdges).forEach((edgeId) => {
        const edge = flowData.signalEdges[edgeId]
        if (edge.source === nodeId || edge.target === nodeId) {
          const sourceActive = flowData.activeStreams[edge.source] === 'active'
          const targetActive = flowData.activeStreams[edge.target] === 'active'
          flowData.signalEdges = {
            ...flowData.signalEdges,
            [edgeId]: {
              ...edge,
              animated: sourceActive && targetActive,
            },
          }
        }
      })

      // Trigger reactivity
      this.sessionFlowData = { ...this.sessionFlowData, [sessionId]: { ...flowData } }

      // Re-layout nodes to ensure data flows left to right
      this.layoutNodes(sessionId)
    },
    /**
     * Handle heartbeat events for long-running streams to prevent timeout
     * Resets the activeStartTime for corresponding nodes to keep them active
     */
    handleHeartbeat(evt: ChatDataEvent): void {
      if (!evt.session_id) return

      const flowData = this.sessionFlowData[evt.session_id]
      if (!flowData) return

      const now = Date.now()
      let hasChanges = false

      // Helper to reset node's activeStartTime
      const keepNodeActive = (nodeId: string): void => {
        const node = flowData.handlerNodes[nodeId]
        if (node) {
          flowData.handlerNodes = {
            ...flowData.handlerNodes,
            [nodeId]: {
              ...node,
              data: {
                ...node.data,
                activeStartTime: now,
                status: 'active',
                lastUpdated: now,
              },
            },
          }
          hasChanges = true
        }
      }

      // Keep the stream's producer node active
      if (evt.stream?.producer) {
        keepNodeActive(evt.stream.producer)
      }

      // Also keep ref_streams' producer nodes active
      if (evt.ref_streams && evt.ref_streams.length > 0) {
        evt.ref_streams.forEach((refStream) => {
          if (refStream.producer) {
            keepNodeActive(refStream.producer)
          }
        })
      }

      // Trigger reactivity if any changes were made
      if (hasChanges) {
        this.sessionFlowData = { ...this.sessionFlowData, [evt.session_id]: { ...flowData } }
      }
    },
    handleChatData(evt: ChatDataEvent): void {
      if (!evt.session_id) return
      const ts = this.timestampToMs(evt.timestamp)
      const id = nanoid()

      // Update session lastUpdated time
      this.updateSessionLastUpdated(evt.session_id)

      if (evt.data?.kind === 'heartbeat') {
        this.handleHeartbeat(evt)
        return
      }
      const sessionMessage: SessionMessage = {
        id,
        kind: 'chat_data',
        ts,
        tsDisplay: this.formatTs(ts),
        sessionId: evt.session_id,
        dataType: evt.data_type,
        stream: evt.stream,
        ref_streams: evt?.ref_streams,
        text: evt.data?.text,
        filePath: evt.data?.file_path,
        meta: evt.meta,
        stream_meta: evt.stream_meta,
      }
      this.addChatMessage(evt.session_id, sessionMessage)
    },
    handleSignal(evt: SignalEvent): void {
      if (!evt.session_id) return
      // Update session lastUpdated time
      this.updateSessionLastUpdated(evt.session_id)
      this.addSignalMessage(evt.session_id, evt)
    },
    handleSnapshot(evt: SnapshotEvent): void {
      if (!Array.isArray(evt.items)) return
      evt.items.forEach((item) => this.handleIncoming(item))
    },
    handleCurrentConfig(evt: CurrentConfigEvent): void {
      this.currentConfig = evt.config || null
    },
    handleIncoming(msg: IncomingMessage | undefined): void {
      if (!msg || typeof msg !== 'object') return

      switch (msg.event) {
        case 'current_config':
          this.handleCurrentConfig(msg)
          break
        case 'snapshot':
          this.handleSnapshot(msg)
          break
        case 'chat_data':
          this.handleChatData(msg)
          break
        case 'signal':
          this.handleSignal(msg)
          break
        default:
          break
      }
    },
    cleanupWS(): void {
      this.ws?.stop()
      this.ws = null
    },
    cleanupMedia(): void {
      mediaUrls.forEach((url) => URL.revokeObjectURL(url))
      mediaUrls.length = 0
    },
    disconnect(): void {
      this.cleanupWS()
      this.status = 'closed'
    },
    /**
     * Send interrupt signal to server for the active session
     */
    sendInterrupt(): void {
      const sessionId = this.activeSession?.id
      if (!sessionId) {
        console.warn('No active session to interrupt')
        return
      }

      if (!this.ws || this.ws.engine?.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket is not connected')
        return
      }

      const interruptMessage = {
        event: 'interrupt',
        session_id: sessionId,
        timestamp: Date.now(),
      }

      this.ws.send(JSON.stringify(interruptMessage))
      console.log('Interrupt signal sent:', interruptMessage)
    },
    reconnect(): void {
      this.disconnect()
      void this.connectWS()
    },
    async connectWS(): Promise<void> {
      this.status = 'connecting'
      this.connectionError = ''
      this.cleanupWS()
      const nextWS = createDataToolWS()
      this.ws = nextWS
      nextWS.on(WsEventTypes.WS_OPEN, () => {
        this.status = 'open'
      })
      nextWS.on(WsEventTypes.WS_CLOSE, () => {
        this.status = 'closed'
      })
      nextWS.on(WsEventTypes.WS_ERROR, (err) => {
        this.status = 'error'
        this.connectionError = typeof err === 'string' ? err : err?.message || '连接异常'
        if (this.connectionError) {
          message.error(this.connectionError)
        }
      })
      nextWS.on(WsEventTypes.WS_MESSAGE, (data: Blob | string) => {
        if (typeof data !== 'string') return
        try {
          const parsed = JSON.parse(data) as IncomingMessage
          this.handleIncoming(parsed)
        } catch (error) {
          console.warn('数据工具消息解析失败', error)
        }
      })
    },
  },
})
