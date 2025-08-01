# 传传传 - 跨平台文件传输工具

> 简单、快速、安全的点对点文件传输解决方案

## ✨ 核心功能

- 📁 **文件传输** - 支持多文件同时传输，断点续传
- 📝 **文字传输** - 快速分享文本内容  
- 🖥️ **桌面共享** - 实时屏幕共享（开发中）
- 🔗 **URL路由** - 支持直链分享特定功能

## 🚀 技术栈

- **前端**: Next.js 15 + React 18 + TypeScript + Tailwind CSS
- **后端**: Go + WebSocket + Gin框架
- **部署**: Docker + Docker Compose

## 📦 快速开始

### 本地开发

```bash
# 克隆项目
git clone https://github.com/MatrixSeven/file-transfer-go.git
cd file-transfer-go

# 启动后端服务
make dev

# 启动前端服务
cd chuan-next
npm install
npm run dev
```

### Docker部署

```bash
# 一键启动所有服务
docker-compose up -d

# 访问应用
open http://localhost:8080
```

## 🎯 URL参数

支持通过URL直接跳转到特定功能：

```
/?type=file&mode=send     # 文件传输-发送
/?type=text&mode=receive  # 文字传输-接收  
/?type=desktop&mode=send  # 桌面共享-共享
```

## 🌟 特色

- ⚡ **零配置** - 无需注册登录，即开即用
- 🔒 **端到端** - 点对点传输，服务器不存储文件
- 📱 **响应式** - 完美适配手机、平板、电脑
- 🎨 **现代UI** - 精美的毛玻璃效果界面

## 📄 许可证

MIT License
