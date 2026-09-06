import { inject, nextTick, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import '@/assets/profile-scroll.css'

const profileScrollKey: InjectionKey<Ref<HTMLElement | undefined>> = Symbol('profile-scroll')

export function useProfileScroll(activeTab: Ref<string>) {
  const profileScroller = ref<HTMLElement>()
  const profileTabs = ref<HTMLElement>()
  const profileContent = ref<HTMLElement>()
  // The app mounts separate desktop/mobile route trees. A global DOM query
  // can select the hidden tree; each profile must own its scroll parent.
  provide(profileScrollKey, profileScroller)
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
