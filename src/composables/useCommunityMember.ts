import type { CommunityMember } from "@/types";
import { computed, ref } from "vue";
import { MAX_VP, VP_RECOVER_DAY } from "@/config";
import { getUserPredictVP } from "@/apis/api";

export const useCommunityMember = (member: CommunityMember) => {
    const predictVP = computed(() => {
        if (member.lastUpdateVPStamp == 0) return 200;
        let vp = (member.predictVP + (Date.now() - member.lastUpdateVPStamp) * MAX_VP / (86400000 * VP_RECOVER_DAY))
        return vp > MAX_VP ? MAX_VP : vp
    })

    async function checkPredictVP() {
        const data: any = await getUserPredictVP(member.twitterId, member.communityId)
        if (data) {
            member.predictVP = data.predictVP
            member.lastUpdateVPStamp = data.lastUpdateVPStamp
        }
    }
    return {
        predictVP,
        checkPredictVP
    }
}