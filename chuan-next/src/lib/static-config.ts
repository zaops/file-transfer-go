/**
 * 静态生成配置文件
 * 定义哪些页面需要静态生成，哪些需要服务端渲染
 */

// 静态页面配置
export const staticPages = [
  '/',          // 首页
  '/about',     // 关于页面（如果有）
  '/help',      // 帮助页面（如果有）
]

// 动态页面配置（需要服务端渲染的页面）
export const dynamicPages = [
  '/room/[id]', // 房间页面（如果有）
]

// API 路由配置（这些在静态导出模式下不可用）
export const apiRoutes = [
  '/api/create-room',
  '/api/create-text-room',
  '/api/get-text-content',
  '/api/room-info',
  '/api/room-status',
  '/api/update-files',
]

// 客户端API配置（用于静态导出时的客户端请求）
export const clientApiConfig = {
  // 直接连接到 Go 后端 - 动态获取当前域名
  baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
  wsUrl: typeof window !== 'undefined' 
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws` 
    : '',
}
