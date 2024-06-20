import {computed, reactive, ref, withDefaults, defineProps} from "vue";
import {stringLength} from "@/utils/helper";

declare global {
  interface Window {
    clipboardData: any
  }
}

export const useCreateTweet = ({maxLength}: {maxLength: number}) => {
  const contentRef = ref();
  const contentEl = ref<string>("");
  const showClear = ref<boolean>(false);
  const contentRange = ref<Range | null>(null);
  const emojiPopover = ref();
  const tweetLength = ref<number>(0)

  const leftWordsLength = computed(() => {
    return maxLength - tweetLength.value
  })

  const maxLengthLimit = (diff: number) => {
    const range = document.createRange()
    const sel = window.getSelection()
    const offset = sel?.anchorOffset
    const node = sel?.anchorNode
    const text = node?.textContent
    range.selectNodeContents(node!)
    sel?.removeAllRanges()
    sel?.addRange(range)
    sel?.extend(node!, offset)
    document.execCommand('delete', false)
    document.execCommand(
      'insertText',
      false,
      text?.substring(0, offset??0 - diff)
    )
  }

  const onPaste = (e:Event) => {
    onPasteEmojiContent(e)
    formatElToTextContent(contentRef.value)
    const diff = tweetLength.value - maxLength;
    if(diff>0) maxLengthLimit(diff)
  }

  const contentInput = (e:any) => {
    formatElToTextContent(contentRef.value)
    const diff = e?.target?.innerText?.length - maxLength;
    if(diff>0) maxLengthLimit(diff)
    showClear.value = e.target.textContent.length>0
  }
  const getBlur = () => {
    const sel = window.getSelection();
    contentRange.value = sel?.getRangeAt(0) || null;
  }
  const selectEmoji = (e: any) => {
    if(leftWordsLength.value<2) {
      emojiPopover.value?.hide()
      return;
    }
    const newNode = document.createElement("img");
    newNode.alt = e.i;
    newNode.src = e.imgSrc;
    newNode.className = "inline-block w-5 h-5 mx-0.5";
    if (!contentRange.value) return;
    contentRange.value?.insertNode(newNode);
    emojiPopover.value?.hide();
    showClear.value = true
    tweetLength.value += 2
  };

  const formatElToTextContent = (tempEl: Element) => {
    const el = tempEl.cloneNode(true) as HTMLElement
    el.innerHTML = el.innerHTML.replaceAll('<div>', '\n')
    el.innerHTML =el.innerHTML.replaceAll('</div>', '\n')
    el.innerHTML =el.innerHTML.replaceAll('<br>', '')
    let content = ''
    let contentLength = 0;
    for(let i of el.childNodes) {
      if(i.nodeName==='#text') {
        contentLength += stringLength(i.textContent??'');
        content += i.textContent
      } else if(i.nodeName === 'IMG') {
        contentLength+=2;
        content += (i as any).alt
      }
    }
    tweetLength.value = contentLength
    return content
  }


  const formatEmojiText = (str: string) => {
    if (!str || str.trim().length===0) return ''
    const regStr = /[\uD83C|\uD83D|\uD83E][\uDC00-\uDFFF][\u200D|\uFE0F]|[\uD83C|\uD83D|\uD83E][\uDC00-\uDFFF]|[0-9|*|#]\uFE0F\u20E3|[0-9|#]\u20E3|[\u203C-\u3299]\uFE0F\u200D|[\u203C-\u3299]\uFE0F|[\u2122-\u2B55]|\u303D|[\A9|\AE]\u3030|\uA9|\uAE|\u3030/ig;
    str = str.replace(regStr, (char: any) => {
      let code = char?.codePointAt(char)?.toString(16)
      if(code.length<4) code = code + '-20e3'
      return `<img class="w-5 h-5 mx-0.5 inline-block" src="/emoji/svg/${code}.svg" onerror="showAltText(this)" alt="${char}"/><text class="hidden">${char}</text>`
    });
    return str
  }

  const onPasteEmojiContent = (e: any) => {
    e.preventDefault()
    let text
    let clp = e.clipboardData
    if (clp === undefined || clp === null) {
      text = '' || window.clipboardData?.getData('text')
      if (text !== "") {
        text = formatEmojiText(text)
        let newNode = document.createElement('div')
        newNode.innerHTML = text;
        window?.getSelection()?.getRangeAt(0).insertNode(newNode)
      }
    } else {
      text = clp.getData('text/plain') || ''
      if (text !== "") {
        text = formatEmojiText(text)
        document.execCommand('insertHtml', false, text)
      }
    }
  }

  return {
    tweetLength,
    showClear,
    contentRef,
    contentEl,
    leftWordsLength,
    contentInput,
    getBlur,
    onPaste,
    selectEmoji,
    formatElToTextContent
  }
}
