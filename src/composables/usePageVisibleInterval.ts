import { onActivated, onDeactivated, onMounted, onUnmounted } from 'vue'

type PageVisibleIntervalOptions = {
  /** 轮询间隔（毫秒），默认 20s */
  intervalMs?: number
  /** 返回 false 时跳过本次 tick 且不启动定时器 */
  enabled?: () => boolean
  /** 挂载后是否立即执行一次，默认 true */
  immediate?: boolean
}

/**
 * 页面可见时轮询；切到后台 tab 或 KeepAlive 失活时自动停止，回到前台再恢复。
 */
export const usePageVisibleInterval = (
  cb: () => void,
  options?: PageVisibleIntervalOptions,
) => {
  const intervalMs = options?.intervalMs ?? 20_000
  let timer: ReturnType<typeof setInterval> | null = null
  let listening = false

  const canRun = () =>
    !document.hidden && (options?.enabled?.() ?? true)

  const tick = () => {
    if (canRun()) cb()
  }

  const stop = () => {
    if (timer) clearInterval(timer)
    timer = null
  }

  const start = () => {
    stop()
    if (!canRun()) return
    timer = setInterval(tick, intervalMs)
  }

  const onVisibility = () => {
    if (document.hidden) stop()
    else {
      tick()
      start()
    }
  }

  const setup = () => {
    if (listening) return
    listening = true
    document.addEventListener('visibilitychange', onVisibility)
    if (options?.immediate !== false) tick()
    start()
  }

  const teardown = () => {
    if (!listening) return
    listening = false
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
  }

  onMounted(setup)
  onUnmounted(teardown)
  onActivated(setup)
  onDeactivated(teardown)
}
