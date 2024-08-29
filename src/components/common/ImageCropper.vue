<script setup lang="ts">
import 'vue-cropper/dist/index.css'
import { VueCropper }  from "vue-cropper"
import {onMounted, ref} from "vue";

const props = defineProps({
  className: String,
  cropperImgSrc: String
})

const emit = defineEmits(['onCancel', 'onConfirm'])
const cropperRef = ref(null)

onMounted(() => {
  console.log(cropperRef.value)
})
</script>

<template>
  <div class="cropper-container max-h-full h-500px bg-blockBg light:bg-white light:shadow-color1A">
    <canvas id="cropper-canvas"></canvas>
    <VueCropper
        ref="cropperRef"
        :class="className"
        :autoCrop="true"
        :img="cropperImgSrc"
        :auto-crop-width="800"
        :auto-crop-height="800"
        :fixed="true"
        :centerBox="true"
        fixedBox
        outputType="png"
        mode="cover"
    ></VueCropper>
  </div>
  <div class="flex justify-center items-center gap-5 py-5 font-semibold text-white">
    <button class="h-10 w-[100px] border-2 border-orange-normal text-orange-normal rounded-full"
            @click="$emit('onCancel')">Cancel</button>
    <button class="h-10 w-[100px] bg-gradient-primary rounded-full"
            @click="$emit('onConfirm', $refs.cropperRef)">Complete</button>
  </div>
</template>

<style scoped>

</style>
