import {computed, reactive, ref, withDefaults, defineProps} from "vue";
import {stringLength} from "@/utils/helper";
import { useAccountStore } from "@/stores/web3";

export const useAccount = () => {
    const accountMismatch = computed(() => {
        const accStore = useAccountStore()
        if (!accStore.ethConnectAddress) {
            return false
        }
        return accStore.getAccountInfo?.ethAddr != accStore.ethConnectAddress
    })

    return {
        accountMismatch
    }
}