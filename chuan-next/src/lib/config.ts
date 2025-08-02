/**
 * 环境配置管理
 */

// 安全的环境变量访问
const getEnv = (key: string, defaultValue: string = '') => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || defaultValue;
    }
  } catch {
    // 在浏览器环境中忽略错误
  }
  return defaultValue;
};

export const config = {
  // 环境判断
  isDev: getEnv('NODE_ENV') === 'development',
  isProd: getEnv('NODE_ENV') === 'production',
  isStatic: typeof window !== 'undefined', // 客户端运行时认为是静态模式
  
  // API配置
  api: {
    // 后端API地址 (服务器端使用)
    backendUrl: getEnv('GO_BACKEND_URL', 'http://localhost:8080'),
    
    // 前端API基础URL (客户端使用) - 开发模式下调用 Next.js API 路由
    baseUrl: getEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3000'),
    
    // 直接后端URL (客户端在静态模式下使用)
    directBackendUrl: getEnv('NEXT_PUBLIC_BACKEND_URL', 'http://localhost:8080'),
    
    // WebSocket地址
    wsUrl: getEnv('NEXT_PUBLIC_WS_URL', 'ws://localhost:8080/ws'),
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
 * 获取前端API完整URL (通过 Next.js API 路由)
 * @param path API路径
 * @returns 完整的API URL
 */
export function getApiUrl(path: string): string {
  const baseUrl = config.api.baseUrl.replace(/\/$/, '')
  const apiPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${apiPath}`
}

/**
 * 获取直接后端URL (客户端直接调用后端)
 * @param path API路径
 * @returns 完整的API URL
 */
export function getDirectBackendUrl(path: string): string {
  const baseUrl = config.api.directBackendUrl.replace(/\/$/, '')
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
    environment: getEnv('NODE_ENV'),
    backendUrl: config.api.backendUrl,
    baseUrl: config.api.baseUrl,
    directBackendUrl: config.api.directBackendUrl,
    wsUrl: config.api.wsUrl,
    isDev: config.isDev,
    isProd: config.isProd,
    isStatic: config.isStatic,
  }
}
