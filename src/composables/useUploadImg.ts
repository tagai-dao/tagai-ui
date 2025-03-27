import {ref} from "vue";
import type {UploadRequestOptions} from "element-plus";
import axios from "axios";
import errCode from "@/errCode";
import type {UploadRawFile} from "element-plus/es/components/upload/src/upload";
import { notify } from "@/utils/notify";

export const useUploadImg = () => {
  const uploading = ref(false)
  const completedImgUrl = ref('')
  const showOnlyPic = ref(false)
  const showPicSizeLimit = ref(false)

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
          console.log(data.size);
          let compressedData = await compressImage(data, 0.5, 600)
          console.log(compressedData.size);
          if (compressedData.size > 600*600) {
            compressedData = await compressImage(compressedData, 0.5, 600)
            if (compressedData.size > 600*600) {
              showPicSizeLimit.value = true
              return;
            }
          }
          completedImgUrl.value = await addUploadImg(compressedData)
          console.log('image url:', completedImgUrl.value);
        }else {
          showOnlyPic.value = true
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

  const addUploadImg = async (img: UploadRawFile | Blob):Promise<string> => {
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
          resolve((res?.data??''));
        })
        .catch((err) => {
          reject(errCode.SERVER_ERROR);
        });
    })
  }


  // 添加图片压缩函数
  const compressImage = (file: Blob, quality = 0.8, maxWidth = 1024): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          // 计算新的尺寸，保持宽高比
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // 转换为JPEG格式并控制质量
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // 如果压缩后的图片比原图还大，则返回原图
                if (blob.size > file.size) {
                  resolve(file);
                } else {
                  resolve(blob);
                }
              } else {
                resolve(file); // 压缩失败，返回原图
              }
            },
            'image/jpeg',
            quality
          );
        };
      };
    });
  };

  return {
    uploading,
    completedImgUrl,
    showPicSizeLimit,
    showOnlyPic,
    addUploadImg,
    cropperModalVisible,
    cropperImgSrc,
    openImageCropper,
    onCroppingAndUpload
  }
}
