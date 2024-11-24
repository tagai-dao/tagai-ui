const SpaceRex = /https:\/\/(twitter|x)\.com\/i\/spaces\/([0-9a-z-A-Z]+)(\/\w)?/
import { useAccountStore } from '@/stores/web3'
import { tweetWithSpace } from '@/apis/api'

export enum InvalidSpaceCurationType {
    OK,
    NOT_YOUR_SPACE,
    HAS_CREATED,
    INVALID_LINK,
    SPACE_IS_STARTED,
    SPACE_IS_ENDED
}

export const useSpace = () => {
    
    const getSpaceIdFromUrl = (url: string) => {
        if (!url) return null;
        const group = url.match(SpaceRex);
        if (group) {
            const spaceId = group[2]
            return spaceId;
        }
    }

    const userTweetWithSpace = async (text: string, tick: string, spaceId: string) => {
        await tweetWithSpace(useAccountStore().getAccountInfo.twitterId, text, tick, spaceId);
        return true;
      };
    return {
        getSpaceIdFromUrl,
        userTweetWithSpace
    }
}