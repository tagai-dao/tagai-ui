import axios from "axios";
import axiosRetry from "axios-retry";
import { useAccountStore } from '@/stores/web3';
import { BACKEND_API_URL } from '@/config';

axiosRetry(axios, { retries: 3 });

axios.defaults.timeout = 30000;

// 标记是否正在刷新 token
let isRefreshing = false;
// 存储等待 token 刷新的请求队列
let refreshSubscribers: Array<(token: string) => void> = [];

// 添加订阅者到队列
function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

// 通知所有订阅者 token 已刷新
function onRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

// 刷新 token 的独立函数（避免循环依赖）
async function refreshAccessToken(twitterId: string) {
  try {
    const response = await axios.post(BACKEND_API_URL + '/auth/refresh', { twitterId });
    return response.data;
  } catch (error) {
    console.error('[Auth] Refresh token request failed:', error);
    throw error;
  }
}

axios.interceptors.request.use(
  config => {
    const accStore = useAccountStore();
    const accountInfo = accStore.getAccountInfo;
    if (accountInfo && accountInfo.accessToken) {
      // 后端期望小写的 accesstoken
      config.headers['accesstoken'] = accountInfo.accessToken;
    }
    return config;
  },
  error => {
    return Promise.reject(error)
  }
)

// 添加响应拦截器处理 401 错误
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // 如果是 401 错误且不是 refresh token 请求本身
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
      const accStore = useAccountStore();
      const accountInfo = accStore.getAccountInfo;
      
      if (!accountInfo?.twitterId) {
        // 没有登录信息，直接拒绝
        return Promise.reject(error);
      }
      
      if (isRefreshing) {
        // 如果正在刷新 token，将请求加入队列
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers['accesstoken'] = token;
            resolve(axios(originalRequest));
          });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        // 尝试刷新 token
        console.log('[Auth] Token expired, refreshing...');
        const newToken: any = await refreshAccessToken(accountInfo.twitterId);
        
        if (newToken && (newToken.accessToken || newToken.jwt)) {
          const token = newToken.accessToken || newToken.jwt;
          // 更新 store 中的 token
          accStore.setAccount({
            ...accountInfo,
            accessToken: token
          });
          
          // 更新原请求的 header
          originalRequest.headers['accesstoken'] = token;
          
          // 通知所有等待的请求
          onRefreshed(token);
          
          console.log('[Auth] Token refreshed successfully');
          
          // 重试原请求
          return axios(originalRequest);
        } else {
          throw new Error('Failed to refresh token');
        }
      } catch (refreshError) {
        console.error('[Auth] Token refresh failed:', refreshError);
        
        // Token 刷新失败，清空登录状态
        accStore.clear();
        
        // 跳转到登录页面或显示登录模态框
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          if (currentPath !== '/') {
            localStorage.setItem('current-route', currentPath);
          }
        }
        
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
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

export function del(url: string, data?: object) {
  return new Promise((resolve, reject) => {
    axios
      .delete(url, data ? { data } : undefined)
      .then(res => {
        if (res.data?.jwt) {
          const accStore = useAccountStore();
          accStore.setAccount({
            ...accStore.getAccountInfo,
            accessToken: res.data.jwt
          });
          return resolve(res.data.data);
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
