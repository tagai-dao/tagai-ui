import axios from "axios";
import axiosRetry from "axios-retry";
import { useAccountStore } from '@/stores/web3';
import { useChainStore } from '@/stores/chain';

axiosRetry(axios, { retries: 2 });

axios.defaults.timeout = 30000;
axios.defaults.headers.common['Cache-Control'] = 'no-cache';
axios.defaults.headers.common['Pragma'] = 'no-cache';

axios.interceptors.request.use(
  config => {
    const accStore = useAccountStore();
    const accountInfo = accStore.getAccountInfo;
    if (accountInfo && accountInfo.accessToken) {
      config.headers['AccessToken'] = accountInfo.accessToken;
      // Some unauthenticated bootstrap calls carry a dedicated bearer token
      // (for example Privy's token during email login). Do not overwrite it
      // with a possibly stale TagAI session.
      if (!config.headers['Authorization']) {
        config.headers['Authorization'] = `Bearer ${accountInfo.accessToken}`;
      }
    }
    // 登录身份与链无关；网关仅用显式 chainId 将业务请求路由到对应实例。
    config.headers['X-Chain-Id'] = String(useChainStore().activeChainId);
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
          reject({
            status: err.response.status,
            data: err.response.data,
            message: err.response.data?.message || err.response.data?.error || err.response.data?.m || err.message || 'Network error'
          });
          return;
        }
        reject({ status: 500, message: err.message || 'Network error' });
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
