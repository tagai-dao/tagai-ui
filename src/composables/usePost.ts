import { ref, computed, onMounted } from "vue";
import { IgnoreAuthor } from "@/config";
import type { Tweet } from "@/types";
import emptyAvatar from "@/assets/icons/icon-default-avatar.svg";
import { escapeHtml } from "@/utils/sanitize";
export const usePost = (tweet: Tweet) => {
  const urlReg =
    /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_#@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;
  const reg =
    /(https?:[^:<>"]*\/)([^:<>"]*)(\.((png!thumbnail)|(png)|(jpg)|(webp)))/g;
  // 匹配 Twitter 新格式图片 URL：https://pbs.twimg.com/media/HASH?format=jpg&name=...
  const twimgReg =
    /https?:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_-]+\?format=(?:jpg|png|webp)[^\s"<>]*/g;
  const urls = ref<string[]>([]);
  const imgurls = ref<string[]>([]);
  const blogRef = ref()

  const isHiddenPostUrl = (url: string) => {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      return parsedUrl.pathname.startsWith('/commerce') ||
        parsedUrl.hostname === 'x.com' ||
        parsedUrl.hostname === 'twitter.com'
    } catch (e) {
      return url.includes('/commerce/');
    }
  }

  const getReadableUrlLabel = (url: string) => {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      const hostname = parsedUrl.hostname.replace(/^www\./, '');
      const pathname = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname.replace(/\/$/, '');
      const search = pathname ? '' : parsedUrl.search;
      const label = `${hostname}${pathname}${search}`;
      return label.length > 56 ? `${label.slice(0, 53)}...` : label;
    } catch (e) {
      return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  }

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
    let rawContent = "";
    rawContent = tweet.content ?? '';
    rawContent = rawContent.replace(reg, "");
    const visibleUrls: string[] = [];
    for (let i = 0; i < urls.value.length; i++) {
      const url = urls.value[i]
      if (isHiddenPostUrl(url)) {
        rawContent = rawContent.replace(url, '');
      } else {
        visibleUrls.push(url)
      }
    }
    let content = escapeHtml(rawContent);
    content = content.replace(reg, "");
    for (let i = 0; i < visibleUrls.length; i++) {
      const url = visibleUrls[i]
      const label = getReadableUrlLabel(url);
      content = content.replace(
        escapeHtml(url),
        `<span data-url="${escapeHtml(url)}" title="${escapeHtml(url)}" class="inline-flex max-w-full align-baseline text-blue-500 text-14px hover:underline break-words">${escapeHtml(label)}</span>`
      )
    }
    return content;
  });

  const isIgnoreAccount = computed(() => {
    return IgnoreAuthor.indexOf(tweet?.twitterId ?? '') > 0;
  });

  const replaceEmptyImg = (e: any) => {
    e.target.src = emptyAvatar
  }

  const gotoTweet = (e: any) => {
    e.stopPropagation();
    const originalTweetId = tweet.originalXTweetId || tweet.tweetId;
    window.open(`https://x.com/i/web/status/${originalTweetId}`, '_blank', 'noopener,noreferrer')
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
      const info = JSON.parse(tweet?.pageInfo ?? '{}')
      if (!info.url) return
      window.open(info.url, '__blank')
    } catch (e) {
    }
  }

  const clickRetweetView = () => {
    try {
      const info = JSON.parse(tweet?.retweetInfo ?? '{}');
      if (!info.id) return
      window.open(`https://twitter.com/${info.author.username}/status/${info.id}`)
    } catch (e) {

    }
  }

  onMounted(() => {
    if (!tweet || !tweet.content) return;
    const urlsTemp = tweet.content?.match(urlReg) || [];
    const regMatches = tweet.content?.match(reg) || [];
    const twimgMatches = tweet.content?.match(twimgReg) || [];
    // 合并两种格式的图片 URL，去重
    imgurls.value = [...new Set([...regMatches, ...twimgMatches])];
    if (urlsTemp && imgurls.value) {
      urls.value = urlsTemp.filter((u: string) => imgurls.value.indexOf(u) < 0);
    } else if (urls) {
      urls.value = urlsTemp;
    }
    // steemitimages.com 代理已失效（返回 JSON），直接加载原始 URL
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
