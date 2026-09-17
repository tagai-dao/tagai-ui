import { computed } from 'vue'
import { Capacitor } from '@capacitor/core'
import { useAccountStore } from '@/stores/web3'

/** App links keep their native flow; only anonymous web visitors see the CTA. */
export function useBlinkLoginPrompt() {
  const account = useAccountStore()
  return computed(() => !Capacitor.isNativePlatform() && !account.getAccountInfo?.twitterId)
}
