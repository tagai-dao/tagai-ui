import {ref} from "vue";
import type {UploadRequestOptions} from "element-plus";

export const useUploadImg = () => {
  const uploadType = ref<string>('logo')

  const addUploadImg = async (options: UploadRequestOptions, type: string) => {
    uploadType.value = type
    const reader = new FileReader()
    reader.readAsDataURL(options.file)
    reader.onload = (res) => {
    }
  }

  return {
    addUploadImg
  }
}
