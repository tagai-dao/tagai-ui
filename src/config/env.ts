/**
 * 环境变量配置管理
 * 统一管理所有 Vite 环境变量，提供类型安全和验证
 */

interface EnvConfig {
  // 环境信息
  readonly isDev: boolean;
  readonly isProd: boolean;
  readonly mode: string;

  // API 配置
  readonly apiBaseUrl: string;
  readonly wsBaseUrl: string;

  // 1inch DEX
  readonly oneInchApiKey: string | undefined;
  readonly useMockQuote: boolean;

  // Privy
  readonly privyAppId: string | undefined;

  // RPC 节点
  readonly rpcUrls: {
    readonly bsc: string | undefined;
    readonly ethereum: string | undefined;
    readonly base: string | undefined;
    readonly optimism: string | undefined;
    readonly arbitrum: string | undefined;
  };

  // 调试
  readonly debug: boolean;
}

/**
 * 解析环境变量，提供类型安全的访问
 */
function parseEnvConfig(): EnvConfig {
  const mode = import.meta.env.MODE || 'development';
  const isDev = mode === 'development';
  const isProd = mode === 'production';

  return {
    isDev,
    isProd,
    mode,

    // API 配置
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:9901',
    wsBaseUrl: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:3100',

    // 1inch DEX
    oneInchApiKey: import.meta.env.VITE_ONEINCH_API_KEY || undefined,
    useMockQuote: import.meta.env.VITE_USE_MOCK_QUOTE === 'true',

    // Privy
    privyAppId: import.meta.env.VITE_PRIVY_APP_ID || undefined,

    // RPC 节点
    rpcUrls: {
      bsc: import.meta.env.VITE_BSC_RPC_URL || undefined,
      ethereum: import.meta.env.VITE_ETHEREUM_RPC_URL || undefined,
      base: import.meta.env.VITE_BASE_RPC_URL || undefined,
      optimism: import.meta.env.VITE_OPTIMISM_RPC_URL || undefined,
      arbitrum: import.meta.env.VITE_ARBITRUM_RPC_URL || undefined,
    },

    // 调试
    debug: import.meta.env.VITE_DEBUG === 'true' || isDev,
  };
}

/**
 * 环境配置单例
 */
export const envConfig = parseEnvConfig();

/**
 * 验证关键配置是否存在
 */
export function validateEnvConfig(): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 检查 1inch API Key
  if (!envConfig.oneInchApiKey && !envConfig.useMockQuote) {
    warnings.push('VITE_ONEINCH_API_KEY not set - SwapToken will use mock data');
  }

  // 生产环境额外检查
  if (envConfig.isProd) {
    if (!envConfig.oneInchApiKey) {
      errors.push('VITE_ONEINCH_API_KEY is required in production for SwapToken feature');
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * 在开发模式下打印配置摘要
 */
export function logEnvConfig(): void {
  if (!envConfig.isDev && !envConfig.debug) return;

  const validation = validateEnvConfig();

  console.group('🔧 Environment Configuration');
  console.log('Mode:', envConfig.mode);
  console.log('API Base URL:', envConfig.apiBaseUrl);
  console.log('WS Base URL:', envConfig.wsBaseUrl);
  console.log('1inch API Key:', envConfig.oneInchApiKey ? '✅ Set' : '❌ Not set');
  console.log('Mock Quote:', envConfig.useMockQuote ? 'Enabled' : 'Disabled');
  console.log('Debug:', envConfig.debug ? 'Enabled' : 'Disabled');

  if (validation.warnings.length > 0) {
    console.warn('⚠️ Warnings:', validation.warnings);
  }

  if (validation.errors.length > 0) {
    console.error('❌ Errors:', validation.errors);
  }

  console.groupEnd();
}

/**
 * 安全地获取敏感配置（用于日志）
 */
export function getSafeConfigSummary(): Record<string, unknown> {
  return {
    mode: envConfig.mode,
    apiBaseUrl: envConfig.apiBaseUrl,
    hasOneInchKey: !!envConfig.oneInchApiKey,
    useMockQuote: envConfig.useMockQuote,
    debug: envConfig.debug,
  };
}

export default envConfig;
