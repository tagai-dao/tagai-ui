import { useClipboard } from "@vueuse/core";
import { ElNotification } from 'element-plus'
import { onUnmounted, ref } from "vue";
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
  const timer = ref<number|undefined>(undefined)
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
