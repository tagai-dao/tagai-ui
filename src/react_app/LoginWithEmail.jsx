import { useEffect, useState, useMemo, useCallback } from "react";
import { useLoginWithEmail, useWallets, useCreateWallet, usePrivy } from "@privy-io/react-auth";
import emitter from "@/utils/emitter.ts";
import debounce from "lodash.debounce";

export default function LoginWithEmail() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email"); // 'email' | 'code' | 'loading'
  const [isLoading, setIsLoading] = useState(false);
  const { logout } = usePrivy();
  
  const { sendCode, loginWithCode, state } = useLoginWithEmail({
    onComplete: async (params) => {
      console.log('Email login completed:', {
        user: params.user,
        isNewUser: params.isNewUser,
        wasAlreadyAuthenticated: params.wasAlreadyAuthenticated,
        loginMethod: params.loginMethod,
        loginAccount: params.loginAccount
      });
      
      // 处理登录成功后的逻辑
      await handleLoginSuccess(params);
    },
    onError: (error) => {
      console.error('Email login failed:', error);
      emitter.emit('authError', error);
      setIsLoading(false);
    }
  });
  
  const { wallets, ready } = useWallets();
  const { createWallet } = useCreateWallet({
    onSuccess: async ({ wallet }) => {
      console.log('Embedded wallet created successfully:', wallet);
      const provider = await wallet.getEthereumProvider();
      emitter.emit('walletProvider', provider)
      setIsLoading(false);
    },
    onError: (error) => {
      console.error('Failed to create embedded wallet:', error);
      emitter.emit('authError', error);
      setIsLoading(false);
    }
  });

  // 处理钱包状态变化
  useEffect(() => {
    if (ready && wallets.length > 0) {
      console.log('Email Wallets available:', wallets);
      const privyWallet = wallets.find(wallet => wallet.walletClientType === 'privy');
      if (privyWallet) {
        console.log('Email privyWallet', privyWallet)
        privyWallet.getEthereumProvider().then(provider => {
          emitter.emit('walletProvider', provider);
        });
      }
    }
  }, [ready, wallets]);

  const handleSendCode = useCallback(async () => {
    setIsLoading(true);
    try {
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
        await logout();
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

    emitter.emit('authSuccess', {
      email,
      type: 'email'
    })

    // 检查是否已有 embedded wallet
    const hasEmbeddedWallet = wallets.some(wallet =>
      wallet.walletClientType === 'privy' &&
      wallet.chainType === 'ethereum'
    );

    if (hasEmbeddedWallet) {
      const provider = await wallets.find((wallet) => wallet.walletClientType === 'privy' && wallet.chainType === 'ethereum').getEthereumProvider()
      emitter.emit('walletProvider', provider)
      setIsLoading(false);
    } else {
      // 如果没有钱包，创建一个新的
      console.log('Creating new embedded wallet for email user');
      await createWallet();
    }
  }, [wallets])

  const handleBackToEmail = () => {
    setStep("email");
    setCode("");
  };

  const debounceEmailInput = useMemo(() => debounce((value) => {
    const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if(regex.test(value)) setEmail(value)
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
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Input Email address"
              onChange={(e) => debounceEmailInput(e.target.value)}
              className="w-full h-12 px-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              disabled={isLoading}
            />
            
            <button
              onClick={handleSendCode}
              disabled={!email.trim() || isLoading}
              className="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all duration-200"
            >
              <span className="text-white text-h5">
                {isLoading ? "Sending..." : "Send Code"}
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
      {state.status === "error" && (
        <div className="text-center text-red-500 text-sm">
          Login failed, please try again
        </div>
      )}
    </div>
  );
}