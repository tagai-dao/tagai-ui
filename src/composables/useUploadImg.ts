import {ref} from "vue";
import type {UploadRequestOptions} from "element-plus";
import axios from "axios";
import { BACKEND_API_URL } from "@/config";
import errCode from "@/errCode";

export const useUploadImg = () => {
  const uploadType = ref<string>('logo')

  const addUploadImg = async (options: UploadRequestOptions, type: string) => {
    return new Promise(async (resolve, reject) => {
      uploadType.value = type
      const reader = new FileReader()
      reader.readAsDataURL(options.file)
      // 可上传的文件
      const img = options.file
      let param = new FormData();
      param.append("file", img);
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };
      axios
        .post(BACKEND_API_URL + '/qiniu/upload', param, config)
        .then((res) => {
          resolve(res?.data?.url);
        })
        .catch((err) => {
          reject(errCode.SERVER_ERROR);
        });
    })
  }

  return {
    addUploadImg
  }
}
