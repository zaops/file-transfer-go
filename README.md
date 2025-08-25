# 文件快传 - P2P文件传输工具


**安全、快速、简单的点对点文件传输解决方案 - 无需注册，即传即用**

[在线体验](https://transfer.52python.cn) • [GitHub](https://github.com/MatrixSeven/file-transfer-go)

![项目演示](img.png)



## ✨ 核心功能[端到端数据传输完全基于WebRTC的P2P直连]
<div align="center">

![React](https://img.shields.io/badge/React-18-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)
![Go](https://img.shields.io/badge/Go-1.22-blue.svg)
![WebRTC](https://img.shields.io/badge/WebRTC-green.svg)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-blue.svg)

</div>

- 📁 **文件传输** - 支持多文件同时传输
- 📝 **文字传输** - 快速分享文本内容
- 🖥️ **桌面共享** - 实时屏幕共享
- 🔗 **连接状态同步** - 实时连接状态UI同步
- 🔒 **端到端加密** - 数据传输安全，服务器不存储文件
- 📱 **响应式设计** - 完美适配手机、平板、电脑
- 🖥️ **多平台支持** - 支持linux/macos/win 单文件部署

## 🔄 最近更新日志

### 2025-08-24
- ✅ **文件传输 ACK 确认支持** - 实现了可靠的数据传输机制，每个数据块都需要接收方确认
- ✅ **修复组件渲染后重复注册/解绑 bug** - 解决了 React 组件重复渲染导致的处理器反复注册问题
- ✅ **修复进度显示 Infinity% 问题** - 解决了除零错误和进度闪烁问题

### 2025-08-14
- ✅ **分离UI组件，统一UI状态** - 重构UI架构，提高代码复用性和可维护性
- ✅ **共享底层链接** - 优化WebRTC连接管理，支持多个业务模块共享连接
- ✅ **远程桌面支持** - 新增实时屏幕共享功能
- ✅ **修复 WebRTC 连接状态异常** - 增强了连接状态错误处理和恢复能力

## 🚀 技术栈



**前端** - Next.js 15 + React 18 + TypeScript + Tailwind CSS  
**后端** - Go + WebSocket + 内存存储  
**传输** - WebRTC DataChannel + P2P直连

## 📦 快速部署

```bash
git clone https://github.com/MatrixSeven/file-transfer-go.git
cd file-transfer-go
./build-fullstack.sh 
./dist/file-transfer-go
```

访问 http://localhost:8080 开始使用

## 🎯 使用方法

### 发送文件
1. 选择文件 → 生成取件码 → 分享6位码

### 文字传输
1. 输入文字内容 → 生成取件码 → 分享给对方

### 桌面共享
1. 点击共享桌面 → 生成取件码 → 对方输入码观看

## 📊 项目架构

```
发送方 ←─── WebSocket信令 ───→ 服务器 ←─── WebSocket信令 ───→ 接收方
   │                                                            │
   └────────────── WebRTC P2P直连传输 ──────────────────────────┘
```

## 🛠️ 本地开发

```bash
# 后端
make dev

# 前端
cd chuan-next && yarn && yarn dev
```

## 📄 许可证

MIT License

---

<div align="center">

⭐ 如果觉得这个项目对你有帮助，请给个星标！

[![Star History Chart](https://api.star-history.com/svg?repos=MatrixSeven/file-transfer-go&type=timeline)]

</div>
