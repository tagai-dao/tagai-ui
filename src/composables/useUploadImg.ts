import {ref} from "vue";
import type {UploadRequestOptions} from "element-plus";

export const useUploadImg = () => {
  const uploadType = ref<string>('logo')
  const uploading = ref(false)
  const completedImgUrl = ref('')

  const addUploadImg = async (options: UploadRequestOptions, type: string) => {
    uploadType.value = type
    const reader = new FileReader()
    reader.readAsDataURL(options.file)
    // 可上传的文件
    // const img = options.file
    // let param = new FormData();
    // param.append("file", img);
    // if (img.size > 2048000) {
    //   reject(errCode.LARGE_IMG)
    //   return;
    // }
    // const config = {
    //   headers: {
    //     "Content-Type": "multipart/form-data",
    //   },
    // };
    // axios
    //   .post(QN_UPLOAD_URL, param, config)
    //   .then((res) => {
    //     resolve(res?.data?.url);
    //   })
    //   .catch((err) => {
    //     if (err.toJSON().message.indexOf('Request failed with status code 429') !== -1) {
    //       reject(errCode.OUT_OF_USAGE)
    //       return;
    //     }
    //     reject(errCode.UPLOAD_FAIL);
    //   });
  }

  return {
    uploading,
    completedImgUrl,
    addUploadImg
  }
}
