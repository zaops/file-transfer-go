/** @type {import('next').NextConfig} */
const nextConfig = {
  // 编译器配置 - 在生产环境中去掉 console.log
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn', 'info'], // 保留 console.error, console.warn, console.info
    } : false,
  },

  // 环境变量配置
  env: {
    GO_BACKEND_URL: process.env.GO_BACKEND_URL,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
  
  // 公共运行时配置
  publicRuntimeConfig: {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL,
    wsUrl: process.env.NEXT_PUBLIC_WS_URL,
  },

  // 服务器端运行时配置
  serverRuntimeConfig: {
    goBackendUrl: process.env.GO_BACKEND_URL,
  },

  // 重写规则 - 仅在非静态导出模式下启用
  ...(!process.env.NEXT_EXPORT && {
    async rewrites() {
      return [
        {
          source: '/api/proxy/:path*',
          destination: `${process.env.GO_BACKEND_URL}/api/:path*`,
        },
      ]
    },
  }),

  // 输出配置 - 根据环境变量决定输出模式
  ...(process.env.NEXT_EXPORT === 'true' ? {
    output: 'export',
    trailingSlash: true,
    skipTrailingSlashRedirect: true,
    // 静态导出时禁用不兼容的功能
    experimental: {},
  } : {
    // 标准模式配置
    // output: 'standalone', // 可选：用于 Docker 部署
    experimental: {
      serverActions: {
        allowedOrigins: ['localhost:3000', 'localhost:8080'],
      },
    },
  }),
  
  // 图片优化配置
  images: {
    unoptimized: process.env.NEXT_EXPORT === 'true',
  },
  
  // 实验性功能在上面配置中已处理
  
  // 优化配置
  poweredByHeader: false,
  
  // 压缩配置
  compress: true,
}

module.exports = nextConfig
