import { inject, nextTick, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import '@/assets/profile-scroll.css'

const profileScrollKey: InjectionKey<Ref<HTMLElement | undefined>> = Symbol('profile-scroll')

export function useProfileScroll(activeTab: Ref<string>, listScroller?: Ref<HTMLElement | undefined>, scrollContainer?: Ref<HTMLElement | undefined>) {
  const profileScroller = scrollContainer ?? ref<HTMLElement>()
  const profileTabs = ref<HTMLElement>()
  const profileContent = ref<HTMLElement>()
  // Each view owns its scroll parent. Wallet can supply a different list
  // scroller on desktop while retaining the same sticky mobile page behavior.
  provide(profileScrollKey, listScroller ?? profileScroller)
  watch(activeTab, async () => {
    await nextTick()
    const scroller = profileScroller.value
    const tabs = profileTabs.value
    const content = profileContent.value
    if (!scroller || !tabs || !content) return
    const contentStart = Math.max(0, content.offsetTop - tabs.offsetHeight)
    scroller.scrollTop = Math.min(scroller.scrollTop, contentStart)
  })
  return { profileScroller, profileTabs, profileContent }
}

export function useProfileScrollParent(): Ref<HTMLElement | undefined> {
  return inject(profileScrollKey, ref<HTMLElement>())
}
