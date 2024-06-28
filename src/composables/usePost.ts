import { ref, computed, onMounted } from "vue";
import { IgnoreAuthor } from "@/config";
import type {Tweet} from "@/types";
import emptyAvatar from "@/assets/icons/icon-default-avatar.svg";
export const usePost = (props: {tweet: Tweet}) => {
  const urlReg =
    /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_#@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;
  const reg =
    /(https?:[^:<>"]*\/)([^:<>"]*)(\.((png!thumbnail)|(png)|(jpg)|(webp)))/g;
  const urls = ref<string[]>([]);
  const imgurls = ref<string[]>([]);
  const blogRef = ref()

  const profileImg = computed(() => {
    if (!props.tweet.profile) return null;
    if (props.tweet.profile) {
      return props.tweet.profile?.replace("normal", "200x200");
    } else {
      return (
        "https://profile-images.heywallet.com/" + props.tweet.twitterId
      );
    }
  });

  const steemUrl = computed(() => {
    return `https://steemit.com/wormhole3/@${props.tweet.steemId}/${props.tweet.postId}`;
  });

  const content = computed(() => {
    let content = "";
    if (props.tweet.longContentStatus === 1) {
      for (let c of JSON.parse(props.tweet.content??'{}')) {
        if (c && c !== "null" && c !== "undefined") {
          content += c + "\n";
        }
      }
    } else {
      content = props.tweet.content??'';
    }
    content = content.replace(reg, "");
    for (let url of urls.value) {
      content = content.replace(
        url,
        `<span data-url="${url}" class="text-blue-500 text-14px break-all">${url}</span>`
      );
    }
    return content;
  });

  const isIgnoreAccount = computed(() => {
    return IgnoreAuthor.indexOf(props.tweet?.twitterId??'') > 0;
  });

  const replaceEmptyImg = (e: any) => {
    e.target.src = emptyAvatar
  }

  const gotoTweet = (e: any) => {
    e.stopPropagation();
    window.open(`https://twitter.com/${props.tweet.twitterUsername}/status/${props.tweet.tweetId}`)
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
      const info = JSON.parse(props.tweet?.pageInfo??'{}')
      if(!info.url) return
      window.open(info.url, '__blank')
    } catch (e) {
    }
  }

  const clickRetweetView = () => {
    try {
      const info = JSON.parse(props.tweet?.retweetInfo??'{}');
      if(!info.id) return
      window.open(`https://twitter.com/${info.author.username}/status/${info.id}`)
    } catch (e) {

    }
  }

  onMounted(() => {
    if (!props.tweet || !props.tweet.content) return;
    const urlsTemp = props.tweet.content?.replace(" ", "")
      .replace("\r", "")
      .replace("\t", "")
      .match(urlReg) || [];
    imgurls.value = props.tweet.content?.replace(" ", "")
      .replace("\r", "")
      .replace("\t", "")
      .match(reg) || [];
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
