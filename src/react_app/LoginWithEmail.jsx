import { useState, useMemo, useCallback } from "react";
import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import { privyEmailLogin } from "../apis/api.ts";

import emitter from "@/utils/emitter.ts";
import debounce from "lodash.debounce";

export default function LoginWithEmail() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email"); // 'email' | 'code' | 'loading'
  const [isLoading, setIsLoading] = useState(false);
  const { logout, getAccessToken } = usePrivy();
  
  const { sendCode, loginWithCode, state } = useLoginWithEmail({
    onComplete: async (params) => {
      console.log('Email login completed:', {
        user: params.user,
        isNewUser: params.isNewUser,
        wasAlreadyAuthenticated: params.wasAlreadyAuthenticated,
        loginMethod: params.loginMethod,
        loginAccount: params.loginAccount
      });
      
      try {
        // 处理登录成功后的逻辑
        await handleLoginSuccess(params);
      } catch (error) {
        console.error('handle login success fail', error)
        emitter.emit('authError', error);
      } finally {
        try {
          setIsLoading(false);
        } catch (error) {
          
        }
      }
    },
    onError: (error) => {
      console.error('Email login failed:', error);
      emitter.emit('authError', error);
      try {
        setIsLoading(false);
      } catch (error) {
        
      }
    }
  });
  
  const handleSendCode = useCallback(async () => {
    setIsLoading(true);
    try {
      try {
        window.localStorage.setItem('lastLoginTime', '0');
        await logout();
      } catch (error) {
        console.error('Failed to logout:', error);
      }
      await sendCode({ email });
      setStep("code");
    } catch (error) {
      console.error('Failed to send code:', error);
      emitter.emit('authError', error);
    } finally {
      setIsLoading(false);
    }
  }, [email])

  const handleLoginWithCode = useCallback(async () => {
    setIsLoading(true);
    try {
      await loginWithCode({ code });
    } catch (error) {
      console.error('Failed to login with code:', error);
      emitter.emit('authError', error);
      setIsLoading(false);
    }
  }, [code])

  const handleLoginSuccess = useCallback(async (loginParams) => {
    const { user, isNewUser, wasAlreadyAuthenticated, loginMethod, loginAccount } = loginParams;

    // 根据用户状态执行不同的逻辑
    if (isNewUser) {
      console.log('欢迎新用户！', user);
      // 可以在这里添加新用户引导逻辑
      // 例如：显示欢迎消息、设置默认偏好等
    } else {
      console.log('欢迎回来！', user);
      // 可以在这里添加现有用户的欢迎逻辑
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("Failed to get Privy access token");
    }

    const loginEmail = email.trim().toLowerCase();
    const userInfo = await privyEmailLogin(accessToken, loginEmail);

    // LoginWithEmail lives inside the login modal and is unmounted as soon as
    // authSuccess closes it. Hand wallet creation/binding to the persistent
    // AuthLoading coordinator before publishing the application login.
    emitter.emit("privyWalletBindingRequested", {
      identity: loginEmail,
      accountType: 1,
      userInfo,
    });

    emitter.emit("authSuccess", userInfo);
    // 嵌入式钱包由 Privy createOnLogin 创建；walletProvider 由 AuthLoading 监听 wallets 统一派发
  }, [email, getAccessToken]);

  const handleBackToEmail = () => {
    setStep("email");
    setCode("");
  };

  const debounceEmailInput = useMemo(() => debounce((value) => {
    const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if(regex.test(value)) setEmail(value.trim().toLowerCase())
    else setEmail('')
  }, 1000), []);

  const debounceCodeInput = useMemo(() => debounce((value) => {
    const regex = /^\d{6}$/
    if(regex.test(value)) setCode(value)
    else setCode('')
  }, 1000), [])

  return (
    <div className="w-full space-y-4">
      {/* 邮箱输入步骤 */}
      {step === "email" && (
        <div className="space-y-4">
          <div className="w-full h-12 px-4 border border-gray-300 rounded-full flex items-center justify-between">
            <input
              type="email"
              placeholder="Input Email address"
              onChange={(e) => debounceEmailInput(e.target.value)}
              className="flex-1"
              disabled={isLoading}
            />
            
            <button
              onClick={handleSendCode}
              disabled={!email.trim() || isLoading}
              className={` rounded-full text-xm font-medium transition-all duration-200 flex items-center justify-center ${
                email.trim() && !isLoading
                  ? 'text-orange-normal hover:text-orange-normal-hover hover:bg-orange-light cursor-pointer'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <div className="animate-spin">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3 h-3">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="31.416" strokeDashoffset="31.416">
                      <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                      <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                </div>
              ) : (
                "Get code"
              )}
            </button>
          </div>
        </div>
      )}

      {/* 验证码输入步骤 */}
      {step === "code" && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              Code has been sent to <span className="font-medium text-orange-normal">{email}</span>
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Input 6-digit code"
              onChange={(e) => debounceCodeInput(e.target.value)}
              className="w-full h-12 px-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-center text-lg tracking-widest"
              disabled={isLoading}
              maxLength={6}
            />
            
            <div className="flex gap-2">
              <button
                onClick={handleBackToEmail}
                disabled={isLoading}
                className="flex-1 h-12 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
              >
                Back
              </button>
              
              <button
                onClick={handleLoginWithCode}
                disabled={!code.trim() || isLoading}
                className="flex-1 h-12 bg-gradient-primary rounded-full flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all duration-200"
              >
                <span className="text-white text-h5">
                  {isLoading ? "Login..." : "Login"}
                </span>
                {isLoading && (
                  <div className="animate-spin">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="31.416" strokeDashoffset="31.416">
                        <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                        <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                      </circle>
                    </svg>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 状态显示 */}
      {/* {state.status === "error" && (
        <div className="text-center text-red-500 text-sm">
          Login failed, please try again
        </div>
      )} */}
    </div>
  );
}
