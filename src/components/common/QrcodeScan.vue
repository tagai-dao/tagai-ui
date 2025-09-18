<script setup lang="ts">
import { ref } from "vue";
import { QrcodeCapture, QrcodeStream } from "vue-qrcode-reader";
import { isAddress } from "viem";

const emit = defineEmits(['close', 'scanAddress']);

const onError = (err) => {
  console.error(err)
}

const onDetect = (detectedCodes) => {
  for(let code of detectedCodes) {
    if(isAddress(code.rawValue)) {
      emit('scanAddress', code.rawValue)
      break
    }
  }
}
const onClose = () => {
  emit('close')
}

</script>

<template>

  <div class="absolute top-0 left-0 w-full h-full overflow-hidden">
    <div class="w-full h-full">
      <qrcode-stream @detect="onDetect" @error="onError">
        <div class="absolute top-0 left-0 w-full h-full flex flex-col justify-center items-center pb-20">
          <button @click="onClose" class="absolute left-8 top-10">
            <span class="text-white text-lg">取消</span>
          </button>
          <img class="w-[300px] h-[300px]" src="~@/assets/icons/icon-qr-scan.svg" alt="">
        </div>
      </qrcode-stream>
    </div>

  </div>
</template>

<style scoped>

</style>
