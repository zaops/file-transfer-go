/**
 * API 调用工具函数
 * 统一处理开发模式和静态模式下的API调用
 */

import { config, getApiUrl, getDirectBackendUrl, getWsUrl } from './config';

/**
 * 统一的 fetch 函数，自动处理不同环境下的API调用
 */
export async function apiFetch(
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> {
  let url: string;
  
  // 检查是否在客户端
  const isClient = typeof window !== 'undefined';
  
  // 检查是否为静态导出模式 - 修复开发模式判断
  const isStaticExport = 
    process.env.NEXT_EXPORT === 'true' ||
    (process.env.NODE_ENV === 'production' && isClient && !window.location.origin.includes('localhost:3000'));
  
  if (isClient) {
    if (isStaticExport) {
      // 静态模式：直接调用后端
      url = getDirectBackendUrl(endpoint);
    } else {
      // 开发模式：通过 Next.js API 路由
      url = getApiUrl(endpoint);
    }
  } else {
    // 服务器端：直接调用后端
    url = getDirectBackendUrl(endpoint);
  }

  console.log(`[API] 模式检查: isClient=${isClient}, isStatic=${isStaticExport}`);
  console.log(`[API] 调用: ${endpoint} -> ${url}`);
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * GET 请求
 */
export async function apiGet(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return apiFetch(endpoint, {
    ...options,
    method: 'GET',
  });
}

/**
 * POST 请求
 */
export async function apiPost(
  endpoint: string, 
  data?: any, 
  options: RequestInit = {}
): Promise<Response> {
  return apiFetch(endpoint, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT 请求
 */
export async function apiPut(
  endpoint: string, 
  data?: any, 
  options: RequestInit = {}
): Promise<Response> {
  return apiFetch(endpoint, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE 请求
 */
export async function apiDelete(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return apiFetch(endpoint, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * 文件上传请求
 */
export async function apiUpload(
  endpoint: string, 
  formData: FormData, 
  options: RequestInit = {}
): Promise<Response> {
  // 文件上传不设置 Content-Type，让浏览器自动设置
  const { headers, ...restOptions } = options;
  
  return apiFetch(endpoint, {
    ...restOptions,
    method: 'POST',
    body: formData,
    headers: headers, // 不包含 Content-Type
  });
}

/**
 * 获取 WebSocket URL
 */
export function getWebSocketUrl(): string {
  return getWsUrl(); // 使用实时获取的 WebSocket URL
}

/**
 * 显示当前API配置信息（调试用）
 */
export function debugApiConfig() {
  const isClient = typeof window !== 'undefined';
  const isStaticExport = 
    process.env.NEXT_EXPORT === 'true' ||
    process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_BASE_URL?.includes('localhost:3000') ||
    (isClient && !window.location.pathname.startsWith('/api/'));
  
  console.log('[API Debug] 配置信息:', {
    isClient,
    isStaticExport,
    config: config.api,
    environment: process.env.NODE_ENV,
    nextExport: process.env.NEXT_EXPORT,
    currentUrl: isClient ? window.location.href : 'server-side',
  });
}
