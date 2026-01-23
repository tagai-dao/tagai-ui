// tagai-ui/src/sdk/miniapp-core/src/actions/Ready.ts
// Ready action - signal mini app is ready to display

export type ReadyOptions = {
  /**
   * Disable native gestures like back swipe on iOS
   */
  disableNativeGestures?: boolean
}

export const DEFAULT_READY_OPTIONS: ReadyOptions = {
  disableNativeGestures: false,
}

export namespace Ready {
  export type Ready = (options?: ReadyOptions) => Promise<void>
}
