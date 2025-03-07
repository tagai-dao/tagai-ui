import { useClipboard } from "@vueuse/core";
import { ElNotification } from 'element-plus'
import {onDeactivated, onUnmounted, ref} from "vue";
import { useRouter } from "vue-router";

export const useTools = () => {
  const {copy, copied} = useClipboard()

  const onCopy = async (text: string) => {
    await copy(text)
    if(copied.value) {
      ElNotification({
        title: 'Title',
        duration: 5000,
        message: 'Copied!'
      })
    }
  }

  return {
    onCopy
  }
}


export const useTimer = () => {
  const timer = ref<ReturnType<typeof setTimeout>|undefined>(undefined)
  const setTimer = (cb: Function, delay=0) => {
    timer.value = setTimeout(() => {
      cb()
      clearTimeout(timer.value)
    }, delay)
  }
  onUnmounted(() => {
    clearTimeout(timer.value)
  })
  return {
    setTimer
  }
}

export const useInterval = () => {
  const interval = ref<number|undefined>();
  const setInter = (cb: Function, int=1) => {
    interval.value = setInterval(cb, int);
  }
  onUnmounted(() => {
    clearInterval(interval.value)
  })
  onDeactivated(() => {
    clearInterval(interval.value)
  })
  return {
    setInter,
    interval
  }
}

export const usePageRouter = () => {
  const router = useRouter()
  const goBack = async () => {
    if (!window.history.state.back) await router.replace('/')
    else router.back()
  }
  return {
    goBack
  }
}

export const usePageScroll = () => {
  const scroll = ref(0)
  const pageScroll = (ref: any) => {
    scroll.value = ref.scrollTop
  }

  const pageScrollTo = (ref: any, position?: number) => {
    if(position) ref.scrollTo({top: position, behavior: 'smooth'})
    else ref.scrollTo({top: scroll.value})
  }

  const pageScrollToTop = (ref: any) => {
    ref.scrollTo({top: 0, behavior: 'smooth'})
  }

  return {
    scroll,
    pageScroll,
    pageScrollTo,
    pageScrollToTop
  }
}
