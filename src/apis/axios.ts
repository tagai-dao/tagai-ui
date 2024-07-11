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

export function get(url: string, params?: Object) {
  return new Promise((resolve, reject) => {
    axios
      .get(url, {
        params: params
      })
      .then(res => {
        resolve(res.data);
      })
      .catch(err => {
        console.log("network err", err);
        if (err.response) {
          reject(err.response.status);
          return;
        } else {
          reject(500);
        }
      }).then(resolve);
  });
}

export function post(url: string, params?: object) {
  return new Promise((resolve, reject) => {
    axios
      .post(url, params)
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
