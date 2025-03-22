import { ref, computed, onMounted } from "vue";
import { IgnoreAuthor } from "@/config";
import type {Tweet} from "@/types";
import emptyAvatar from "@/assets/icons/icon-default-avatar.svg";
export const usePost = (tweet: Tweet) => {
  const urlReg =
    /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_#@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;
  const reg =
    /(https?:[^:<>"]*\/)([^:<>"]*)(\.((png!thumbnail)|(png)|(jpg)|(webp)))/g;
  const urls = ref<string[]>([]);
  const imgurls = ref<string[]>([]);
  const blogRef = ref()

  const profileImg = computed(() => {
    if (!tweet.profile) return '';
    if (tweet.profile) {
      return tweet.profile
      return tweet.profile?.replace("normal", "200x200");
    } else {
      return (
        "https://profile-images.heywallet.com/" + tweet.twitterId
      );
    }
  });

  const steemUrl = computed(() => {
    return `https://steemit.com/wormhole3/@${tweet.steemId}/${tweet.tweetId}`;
  });

  const content = computed(() => {
    let content = "";
    content = tweet.content??'';
    content = content.replace(reg, "");
    let tempContent = ''
    for (let i = 0 ; i < urls.value.length; i++) {
      const url = urls.value[i]
      const strList = content.split(url)
      if (url.startsWith(window.location.origin + '/commerce') || url.startsWith('https://x.com') || url.startsWith('https://twitter.com')) {
        // content = content.replaceAll(url, '');
        tempContent += `${strList[0]}`
      }else {
        tempContent += `${strList[0]}<span data-url="${url}" class="text-blue-500 text-14px break-all">${url}</span>`
      }
      content = strList.slice(1).join(url)
    }
    return tempContent || content;
  });

  const isIgnoreAccount = computed(() => {
    return IgnoreAuthor.indexOf(tweet?.twitterId??'') > 0;
  });

  const replaceEmptyImg = (e: any) => {
    e.target.src = emptyAvatar
  }

  const gotoTweet = (e: any) => {
    e.stopPropagation();
    window.open(`https://twitter.com/${tweet.twitterUsername}/status/${tweet.tweetId}`)
  }

  const clickContent = (e: any) => {
    if (e.target.dataset.url) {
      window.open(e.target.dataset.url, '_blank')
    } else {
      blogRef.value.click()
    }
  }

  const clickLinkView = () => {
    try {
      const info = JSON.parse(tweet?.pageInfo??'{}')
      if(!info.url) return
      window.open(info.url, '__blank')
    } catch (e) {
    }
  }

  const clickRetweetView = () => {
    try {
      const info = JSON.parse(tweet?.retweetInfo??'{}');
      if(!info.id) return
      window.open(`https://twitter.com/${info.author.username}/status/${info.id}`)
    } catch (e) {

    }
  }

  onMounted(() => {
    if (!tweet || !tweet.content) return;
    const urlsTemp = tweet.content?.match(urlReg) || [];
    imgurls.value = tweet.content?.match(reg) || [];
    if (urlsTemp && imgurls.value) {
      urls.value = urlsTemp.filter((u: string) => imgurls.value.indexOf(u) < 0);
    } else if (urls) {
      urls.value = urlsTemp;
    }
    imgurls.value = imgurls.value?.map(
      (u) => "https://steemitimages.com/0x0/" + u
    );
  });

  return {
    blogRef,
    profileImg,
    content,
    urls,
    imgurls,
    steemUrl,
    IgnoreAuthor,
    isIgnoreAccount,
    replaceEmptyImg,
    gotoTweet,
    clickContent,
    clickLinkView,
    clickRetweetView
  };
};
