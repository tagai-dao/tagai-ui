import { ref, computed, onMounted } from "vue";
import { IgnoreAuthor } from "@/config";
export const usePost = (props: any) => {
  const urlReg =
    /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_#@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;
  const reg =
    /(https?:[^:<>"]*\/)([^:<>"]*)(\.((png!thumbnail)|(png)|(jpg)|(webp)))/g;
  const urls = ref<Array<string>>([]);
  const imgurls = ref<Array<string>>([]);

  const profileImg = computed(() => {
    if (!props.post.profile) return null;
    if (props.post.profile) {
      return props.post.profile?.replace("normal", "200x200");
    } else {
      return (
        "https://profile-images.heywallet.com/" + props.post.twitterId
      );
    }
  });

  const steemUrl = computed(() => {
    return `https://steemit.com/wormhole3/@${props.post.steemId}/${props.post.postId}`;
  });

  const content = computed(() => {
    let content = "";
    if (props.post.longContentStatus === 1) {
      for (let c of JSON.parse(props.post.content)) {
        if (c && c !== "null" && c !== "undefined") {
          content += c + "\n";
        }
      }
    } else {
      content = props.post.content;
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
    return IgnoreAuthor.indexOf(props.tweet.twitterId) > 0;
  });

  onMounted(() => {
    if (!props.post) return;
    const urls = props.post.content?.replace(" ", "")
      .replace("\r", "")
      .replace("\t", "")
      .match(urlReg);
    imgurls.value = props.post.content?.replace(" ", "")
      .replace("\r", "")
      .replace("\t", "")
      .match(reg);
    if (urls && imgurls.value) {
      urls.value = urls.filter((u: string) => imgurls.value.indexOf(u) < 0);
    } else if (urls) {
      urls.value = urls;
    }
    imgurls.value = imgurls.value?.map(
      (u) => "https://steemitimages.com/0x0/" + u
    );
  });

  return {
    profileImg,
    content,
    urls,
    imgurls,
    steemUrl,
    IgnoreAuthor,
    isIgnoreAccount,
  };
};
