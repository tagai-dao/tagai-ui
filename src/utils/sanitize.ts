/**
 * HTML 消毒工具 - 防止 XSS 攻击
 */
import DOMPurify from 'dompurify';

/**
 * DOMPurify 配置 - 只允许安全的标签和属性
 */
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['br', 'img', 'text', 'span', 'a', 'b', 'i', 'u', 'strong', 'em'],
  ALLOWED_ATTR: ['class', 'src', 'alt', 'href', 'target', 'rel', 'onerror'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['onerror'],
};

/**
 * 消毒 HTML 字符串，移除潜在的 XSS 攻击代码
 * @param dirty 未消毒的 HTML 字符串
 * @returns 消毒后的安全 HTML 字符串
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, DOMPURIFY_CONFIG) as string;
}

/**
 * 转义 HTML 实体，防止 XSS
 * @param text 原始文本
 * @returns 转义后的文本
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 安全地处理用户输入的文本，用于 v-html
 * 1. 首先转义 HTML 实体
 * 2. 然后进行 emoji 等处理
 * 3. 最后用 DOMPurify 消毒
 */
export function sanitizeUserInput(text: string): string {
  if (!text) return '';
  // 先转义 HTML 实体
  const escaped = escapeHtml(text);
  // 再用 DOMPurify 消毒
  return sanitizeHtml(escaped);
}

export default {
  sanitizeHtml,
  escapeHtml,
  sanitizeUserInput,
};
