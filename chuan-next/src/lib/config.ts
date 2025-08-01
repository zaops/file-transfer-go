/**
 * 环境配置管理
 */

export const config = {
  // 环境判断
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  
  // API配置
  api: {
    // 后端API地址 (服务器端使用)
    backendUrl: process.env.GO_BACKEND_URL || 'http://localhost:8080',
    
    // 前端API基础URL (客户端使用)
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
    
    // WebSocket地址
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws',
  },
  
  // 超时配置
  timeout: {
    api: 30000, // 30秒
    ws: 60000,  // 60秒
  },
  
  // 重试配置
  retry: {
    max: 3,
    delay: 1000,
  },
}

/**
 * 获取后端API完整URL
 * @param path API路径
 * @returns 完整的API URL
 */
export function getBackendUrl(path: string): string {
  const baseUrl = config.api.backendUrl.replace(/\/$/, '')
  const apiPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${apiPath}`
}

/**
 * 获取前端API完整URL
 * @param path API路径
 * @returns 完整的API URL
 */
export function getApiUrl(path: string): string {
  const baseUrl = config.api.baseUrl.replace(/\/$/, '')
  const apiPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${apiPath}`
}

/**
 * 获取WebSocket URL
 * @returns WebSocket连接地址
 */
export function getWsUrl(): string {
  return config.api.wsUrl
}

/**
 * 环境配置调试信息
 */
export function getEnvInfo() {
  return {
    environment: process.env.NODE_ENV,
    backendUrl: config.api.backendUrl,
    baseUrl: config.api.baseUrl,
    wsUrl: config.api.wsUrl,
    isDev: config.isDev,
    isProd: config.isProd,
  }
}
