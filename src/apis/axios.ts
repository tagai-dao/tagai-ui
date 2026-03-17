import axios from "axios";
import axiosRetry from "axios-retry";
import { useAccountStore } from '@/stores/web3';

axiosRetry(axios, { retries: 3 });

axios.defaults.timeout = 30000;

axios.interceptors.request.use(
  config => {
    const accStore = useAccountStore();
    const accountInfo = accStore.getAccountInfo;
    if (accountInfo && accountInfo.accessToken) {
      config.headers['AccessToken'] = accountInfo.accessToken;
    }
    return config;
  },
  error => {
    return Promise.reject(error)
  }
)

export function get(url: string, params?: Object, config?: any) {
  return new Promise((resolve, reject) => {
    axios
      .get(url, {
        params: params,
        ...config
      })
      .then(res => {
        resolve(res.data);
      })
      .catch(err => {
        console.log("network err", err);
        if (err.response) {
          // 返回完整的错误信息，包括状态码和响应数据
          const errorInfo = {
            status: err.response.status,
            data: err.response.data,
            message: err.response.data?.message || err.message || 'Network error'
          };
          console.error('API Error:', errorInfo);
          reject(errorInfo);
          return;
        } else {
          reject({ status: 500, message: err.message || 'Network error' });
        }
      });
  });
}

export function post(url: string, params?: object, config?: any) {
  return new Promise((resolve, reject) => {
    axios
      .post(url, params, config)
      .then(res => {
        if (res.data.jwt) {
          const accStore = useAccountStore();
          accStore.setAccount({
            ...accStore.getAccountInfo,
            accessToken: res.data.jwt
          })
          return resolve(res.data.data)
        }

        resolve(res.data);
      })
      .catch(err => {
        if (err.response) {
          reject(err.response.status);
          return;
        }
        reject(500);
      });
  });
}

export function put(url: string, params?: object) {
  return new Promise((resolve, reject) => {
    axios
      .put(url, params)
      .then(res => {
        resolve(res.data);
      })
      .catch(err => {
        if (err.response) {
          reject(err.response.status);
          return;
        }
        reject(500);
      });
  });
}
