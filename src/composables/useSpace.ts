const SpaceRex = /https:\/\/(twitter|x)\.com\/i\/spaces\/([0-9a-z-A-Z]+)(\/\w)?/
const regex_hive_tag = /#hive-[0-9]{4,7}/
const regex_tweet_link = new RegExp("https://twitter.com/([a-zA-Z0-9\_]+)/status/([0-9]+)[/]?$")
const { useAccountStore } = require('@/stores/web3')
const { tweetWithSpace } = require('@/apis/api')

export enum InvalidSpaceCurationType {
    OK,
    NOT_YOUR_SPACE,
    HAS_CREATED,
    INVALID_LINK,
    SPACE_IS_STARTED
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