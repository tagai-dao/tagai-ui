/**
 * 安全配置
 * 集中管理所有安全相关的配置和常量
 */

import { envConfig } from './env';

/**
 * 允许的 postMessage origins
 */
export const ALLOWED_ORIGINS: readonly string[] = [
  // 本地开发
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  // 生产环境 (从环境变量读取)
  ...(import.meta.env.VITE_ALLOWED_ORIGINS?.split(',').filter(Boolean) || []),
] as const;

/**
 * 验证 origin 是否在白名单中
 */
export function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  
  // 精确匹配
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  
  // 开发环境允许 localhost
  if (envConfig.isDev && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return true;
  }
  
  return false;
}

/**
 * 代币授权安全配置
 */
export const APPROVAL_CONFIG = {
  // 授权倍数：授权实际所需金额的 N 倍，减少频繁授权
  MULTIPLIER: 2n,
  
  // 最大授权金额（可选限制）
  // MAX_APPROVAL: BigInt('1000000000000000000000000'), // 1M tokens
  
  // 是否允许无限授权（生产环境应该禁用）
  ALLOW_UNLIMITED: false,
} as const;

/**
 * Rate Limiting 配置（前端）
 */
export const RATE_LIMIT_CONFIG = {
  // API 调用间隔（毫秒）
  MIN_INTERVAL_MS: 100,
  
  // 防抖延迟（毫秒）
  DEBOUNCE_MS: 300,
  
  // 重试配置
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

/**
 * 敏感操作确认配置
 */
export const CONFIRMATION_CONFIG = {
  // 大额转账阈值（ETH）
  LARGE_TRANSFER_THRESHOLD: 1,
  
  // 需要二次确认的操作
  REQUIRE_CONFIRMATION: [
    'transfer',
    'approve',
    'swap',
    'stake',
    'unstake',
  ] as const,
} as const;

/**
 * 地址验证规则
 */
export const ADDRESS_VALIDATION = {
  // 零地址
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000' as const,
  
  // 已知危险地址（合约漏洞、钓鱼等）
  BLOCKED_ADDRESSES: [] as readonly string[],
  
  // 验证地址是否安全
  isAddressSafe(address: string): { safe: boolean; reason?: string } {
    const normalizedAddress = address.toLowerCase();
    
    // 检查零地址
    if (normalizedAddress === this.ZERO_ADDRESS.toLowerCase()) {
      return { safe: false, reason: 'Cannot interact with zero address' };
    }
    
    // 检查黑名单
    if (this.BLOCKED_ADDRESSES.some(a => a.toLowerCase() === normalizedAddress)) {
      return { safe: false, reason: 'Address is blocked for security reasons' };
    }
    
    return { safe: true };
  },
} as const;

/**
 * 内容安全策略
 */
export const CSP_CONFIG = {
  // DOMPurify 允许的标签
  ALLOWED_TAGS: ['br', 'img', 'text', 'span', 'a', 'b', 'i', 'u', 'strong', 'em'] as const,
  
  // DOMPurify 允许的属性
  ALLOWED_ATTRS: ['class', 'src', 'alt', 'href', 'target', 'rel', 'onerror'] as const,
} as const;

/**
 * 会话安全配置
 */
export const SESSION_CONFIG = {
  // Token 刷新阈值（过期前多久刷新，秒）
  TOKEN_REFRESH_THRESHOLD: 300, // 5 分钟
  
  // 最大会话时长（秒）
  MAX_SESSION_DURATION: 24 * 60 * 60, // 24 小时
  
  // 空闲超时（秒）
  IDLE_TIMEOUT: 30 * 60, // 30 分钟
} as const;

export default {
  ALLOWED_ORIGINS,
  isOriginAllowed,
  APPROVAL_CONFIG,
  RATE_LIMIT_CONFIG,
  CONFIRMATION_CONFIG,
  ADDRESS_VALIDATION,
  CSP_CONFIG,
  SESSION_CONFIG,
};
