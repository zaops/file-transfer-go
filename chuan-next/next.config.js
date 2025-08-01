/** @type {import('next').NextConfig} */
const nextConfig = {
  // 环境变量配置
  env: {
    GO_BACKEND_URL: process.env.GO_BACKEND_URL,
  },
  
  // 公共运行时配置
  publicRuntimeConfig: {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    wsUrl: process.env.NEXT_PUBLIC_WS_URL,
  },

  // 服务器端运行时配置
  serverRuntimeConfig: {
    goBackendUrl: process.env.GO_BACKEND_URL,
  },

  // 重写规则 - 可选，用于代理API请求
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${process.env.GO_BACKEND_URL}/api/:path*`,
      },
    ]
  },

  // 输出配置
  output: 'standalone',
  
  // 实验性功能
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:8080'],
    },
  },
}

module.exports = nextConfig
