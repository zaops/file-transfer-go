/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出模式
  output: 'export',
  
  // 关闭服务端功能
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  
  // 图片优化配置
  images: {
    unoptimized: true,
  },
  
  // 环境变量配置
  env: {
    GO_BACKEND_URL: process.env.GO_BACKEND_URL,
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
  
  // 公共运行时配置
  publicRuntimeConfig: {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL,
    wsUrl: process.env.NEXT_PUBLIC_WS_URL,
  },

  // 禁用服务器端功能
  // 注意：在静态导出模式下，API 路由将不可用
}

module.exports = nextConfig
