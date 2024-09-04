import {type Ref, ref} from "vue";
import type {UploadRequestOptions} from "element-plus";
import axios from "axios";
import { BACKEND_API_URL } from "@/config";
import errCode from "@/errCode";
import type {UploadRawFile} from "element-plus/es/components/upload/src/upload";
import { notify } from "@/utils/notify";

export const useUploadImg = () => {
  const uploading = ref(false)
  const completedImgUrl = ref('')

  const cropperModalVisible = ref(false)
  const cropperImgSrc = ref<string| ArrayBuffer | null>(null)

  const openImageCropper = (options: UploadRequestOptions) => {
    const reader = new FileReader()
    reader.readAsDataURL(options.file)
    reader.onload = (res) => {
      cropperImgSrc.value = res.target?.result??null
      cropperModalVisible.value = true
    }
  }

  const onCroppingAndUpload = async (cropperRef: any) => {
    uploading.value = true
    cropperModalVisible.value = false
    cropperRef?.getCropBlob(async (data: any) => {
      try {
        if (data.type.startsWith('image')) {
          completedImgUrl.value = await addUploadImg(data)
          console.log('image url:', completedImgUrl.value);
        }else {
          notify({message: 'Only support image type file'})
        }
        uploading.value = false
      } catch (error) {
        console.error(error)
        notify({message: 'Upload fail, please retry', type: 'error'})
      }finally {
        uploading.value = false
      }
    })
  }

  const addUploadImg = async (img: UploadRawFile):Promise<string> => {
    return new Promise(async (resolve, reject) => {
      let param = new FormData();
      param.append("file", img);
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };
      axios
        .put('https://upload.wormhole3.io/files/upload?fileName=' + Date.now() + Math.ceil(Math.random() * 1000) + '.' + img.type.split('/')[1] + '&path=tiptag&bucket=tiptag', param, config)
        .then((res) => {
          resolve(res?.data??'');
        })
        .catch((err) => {
          reject(errCode.SERVER_ERROR);
        });
    })
  }

  return {
    uploading,
    completedImgUrl,
    addUploadImg,
    cropperModalVisible,
    cropperImgSrc,
    openImageCropper,
    onCroppingAndUpload
  }
}
