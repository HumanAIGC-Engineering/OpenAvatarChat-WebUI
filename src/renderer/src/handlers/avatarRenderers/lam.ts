// @ts-ignore for lam render
import { TYVoiceChatState } from '@renderer/interface/voiceChat'
import * as GaussianSplats3D from 'gaussian-splat-renderer-for-lam'

interface LAMRendererOptions {
  container: HTMLDivElement
  assetsPath: string
  getChatState: () => TYVoiceChatState
  getExpressionData: () => any
  downloadProgress: (percent: number) => void
  loadProgress: (percent: number) => void
}
export class LAMRenderer {
  private _avatarDivEle: HTMLDivElement
  private _assetsPath: string
  private _getChatState: () => TYVoiceChatState
  private _getExpressionData: () => any
  private _downloadProgress: (percent: number) => void
  private _loadProgress: (percent: number) => void
  constructor(options: LAMRendererOptions) {
    const {
      container,
      assetsPath,
      getChatState,
      getExpressionData,
      downloadProgress,
      loadProgress,
    } = options
    this._avatarDivEle = container
    this._assetsPath = assetsPath
    this._getChatState = getChatState
    this._getExpressionData = getExpressionData
    this._downloadProgress = downloadProgress
    this._loadProgress = loadProgress
  }

  async getInstance() {
    return await GaussianSplats3D.GaussianSplatRenderer.getInstance(
      this._avatarDivEle,
      this._assetsPath,
      {
        getChatState: this._getChatState,
        getExpressionData: this._getExpressionData,
        downloadProgress: this._downloadProgress,
        loadProgress: this._loadProgress,
      }
    )
  }
}
