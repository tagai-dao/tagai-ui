/**
 * 配置模块入口
 * 统一导出所有配置
 */

export { envConfig, validateEnvConfig, logEnvConfig, getSafeConfigSummary } from './env';
export { 
  ALLOWED_ORIGINS,
  isOriginAllowed,
  APPROVAL_CONFIG,
  RATE_LIMIT_CONFIG,
  CONFIRMATION_CONFIG,
  ADDRESS_VALIDATION,
  CSP_CONFIG,
  SESSION_CONFIG,
} from './security';

// 在应用启动时自动验证配置
import { logEnvConfig } from './env';

// 开发环境自动打印配置
if (import.meta.env.DEV) {
  logEnvConfig();
}
