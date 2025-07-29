import { ref, onUnmounted } from 'vue';
import { privy } from '@/utils/privy';

export function usePrivyIframe() {
  const iframeRef = ref<HTMLIFrameElement | null>(null);
  const messageListener = ref<((e: any) => void) | null>(null);
  const isInitialized = ref(false);

  // 初始化 Privy iframe
  async function initPrivyIframe() {
    if (isInitialized.value) {
      console.log('Privy iframe already initialized');
      return;
    }

    try {
      const url = privy.embeddedWallet.getURL();
      console.log('Privy embedded wallet URL:', url);

      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = 'none';
      
      // 等待 iframe 加载完成后再设置消息传递器
      iframe.onload = () => {
        setTimeout(() => {
          try {
            if (iframe.contentWindow) {
              privy.setMessagePoster(iframe.contentWindow as any);
              
              // 创建消息监听器
              messageListener.value = (e: any) => {
                try {
                  privy.embeddedWallet.onMessage(e.data);
                } catch (error) {
                  console.warn('Error handling privy message:', error);
                }
              };
              
              window.addEventListener('message', messageListener.value);
              console.log('Privy iframe message listener set up successfully');
              isInitialized.value = true;
            }
          } catch (error) {
            console.error('Error setting up privy message poster:', error);
          }
        }, 100);
      };
      
      document.body.appendChild(iframe);
      iframeRef.value = iframe;
    } catch (error) {
      console.error('Error initializing privy embedded wallet:', error);
      throw error;
    }
  }

  // 清理资源
  function cleanupPrivyResources() {
    try {
      // 移除消息监听器
      if (messageListener.value) {
        window.removeEventListener('message', messageListener.value);
        messageListener.value = null;
      }
      
      // 移除 iframe
      if (iframeRef.value && iframeRef.value.parentNode) {
        iframeRef.value.parentNode.removeChild(iframeRef.value);
        iframeRef.value = null;
      }
      
      isInitialized.value = false;
    } catch (error) {
      console.error('Error cleaning up privy resources:', error);
    }
  }

  // 等待 iframe 初始化完成
  async function waitForInitialization(timeout = 5000) {
    const startTime = Date.now();
    
    while (!isInitialized.value && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!isInitialized.value) {
      throw new Error('Privy iframe initialization timeout');
    }
    
    return true;
  }

  // 自动清理
  onUnmounted(() => {
    cleanupPrivyResources();
  });

  return {
    iframeRef,
    isInitialized,
    initPrivyIframe,
    cleanupPrivyResources,
    waitForInitialization
  };
} 