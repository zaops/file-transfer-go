# 川 - P2P文件传输系统

一个基于WebRTC技术的点对点文件传输系统，支持无服务器中转的直接文件传输。

## ✨ 功能特性

### 🚀 核心功能
- **纯P2P传输**：文件直接在浏览器间传输，无需上传到服务器
- **取件码机制**：6位随机取件码，简单易用
- **实时传输**：支持大文件高速传输，64KB分块优化
- **多文件支持**：可同时选择和传输多个文件
- **拖拽上传**：支持文件拖拽选择

### 🛡️ 安全特性
- **端到端加密**：WebRTC内置加密，数据传输安全
- **临时连接**：传输完成后自动清理连接
- **无文件存储**：服务器不存储任何文件内容
- **房间隔离**：每个取件码对应独立的传输房间

### 🌐 技术特性
- **WebRTC DataChannel**：高效的浏览器间直连
- **国内STUN优化**：使用阿里云、腾讯云等国内STUN服务器
- **断线重连**：WebSocket连接自动重连机制
- **传输进度**：实时显示文件传输进度
- **跨平台兼容**：支持现代浏览器（Chrome、Firefox、Safari、Edge）

## 🏗️ 系统架构

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│   发送方浏览器   │◄────────┤   信令服务器   ├────────►│   接收方浏览器   │
│                │         │              │         │                │
│  ┌───────────┐  │         │ ┌──────────┐ │         │  ┌───────────┐  │
│  │ 文件选择  │  │         │ │ WebSocket│ │         │  │ 取件码输入│  │
│  └───────────┘  │         │ │   信令   │ │         │  └───────────┘  │
│  ┌───────────┐  │         │ └──────────┘ │         │  ┌───────────┐  │
│  │ 生成取件码│  │         │ ┌──────────┐ │         │  │ 文件接收  │  │
│  └───────────┘  │         │ │ 房间管理 │ │         │  └───────────┘  │
│                │         │ └──────────┘ │         │                │
└─────────────────┘         └──────────────┘         └─────────────────┘
         │                                                     │
         └─────────────────── WebRTC P2P 连接 ──────────────────┘
                              (文件直接传输)
```

## 🛠️ 技术栈

### 后端
- **Go 1.21+**：高性能Web服务器
- **Chi Router**：轻量级HTTP路由
- **Gorilla WebSocket**：WebSocket连接管理
- **标准库**：HTML模板、JSON处理等

### 前端
- **原生JavaScript**：无框架依赖
- **WebRTC API**：浏览器P2P通信
- **Tailwind CSS**：现代化UI样式
- **模块化设计**：分离的JS文件结构

### 基础设施
- **Docker支持**：容器化部署
- **Nginx代理**：生产环境反向代理
- **STUN服务器**：NAT穿透支持

## 📁 项目结构

```
chuan/
├── cmd/
│   └── main.go                 # 程序入口
├── internal/
│   ├── handlers/
│   │   └── handlers.go         # HTTP请求处理
│   ├── models/
│   │   └── models.go           # 数据模型定义
│   └── services/
│       ├── file_service.go     # 文件服务（预留）
│       ├── memory_store.go     # 内存存储
│       ├── p2p_service.go      # P2P连接管理
│       └── webrtc_service.go   # WebRTC服务（预留）
├── web/
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css       # 样式文件
│   │   └── js/
│   │       ├── common.js       # 通用工具函数
│   │       ├── p2p-transfer.js # P2P传输核心逻辑
│   │       ├── webrtc-connection.js # WebRTC连接管理
│   │       └── file-transfer.js # 文件传输处理
│   └── templates/
│       ├── base.html           # 基础模板
│       ├── index.html          # 主页面
│       ├── upload.html         # 上传页面（预留）
│       └── video.html          # 视频传输页面
├── uploads/                    # 上传目录（预留）
├── bin/
│   └── chuan                   # 编译后的可执行文件
├── docker-compose.yml          # Docker Compose配置
├── Dockerfile                  # Docker镜像构建
├── nginx.conf                  # Nginx配置
├── Makefile                    # 构建脚本
├── deploy.sh                   # 部署脚本
├── go.mod                      # Go模块定义
├── go.sum                      # Go模块校验
└── README.md                   # 项目文档
```

## 🚀 快速开始

### 本地开发

1. **克隆项目**
```bash
git clone <repository-url>
cd chuan
```

2. **安装依赖**
```bash
go mod tidy
```

3. **启动服务**
```bash
go run cmd/main.go
```

4. **访问应用**
```
打开浏览器访问: http://localhost:8080
```

### 使用Make命令

```bash
# 运行开发服务器
make run

# 构建可执行文件
make build

# 清理构建文件
make clean

# 运行测试
make test
```

### Docker部署

1. **构建镜像**
```bash
docker build -t chuan .
```

2. **运行容器**
```bash
docker run -p 8080:8080 chuan
```

3. **使用Docker Compose**
```bash
docker-compose up -d
```

## 📖 使用说明

### 发送文件

1. 访问主页面
2. 点击选择文件或拖拽文件到上传区域
3. 点击"生成取件码"按钮
4. 分享6位取件码给接收方
5. 等待接收方连接并开始传输

### 接收文件

1. 访问主页面
2. 在"输入取件码"区域输入6位取件码
3. 系统自动连接并显示文件列表
4. 等待P2P连接建立（显示绿色状态）
5. 点击"下载"按钮开始接收文件

### 传输状态说明

- 🟡 **等待连接**：正在建立WebSocket连接
- 🟢 **P2P已连接**：可以开始文件传输
- 🔴 **连接失败**：请检查网络或重试

## ⚙️ 配置说明

### 环境变量

- `PORT`：服务器端口（默认8080）
- `HOST`：服务器主机（默认localhost）

### STUN服务器配置

系统默认使用以下STUN服务器（按优先级）：

1. `stun:stun.chat.bilibili.com:3478` - 哔哩哔哩
2. `stun:stun.voipbuster.com` - VoIP服务
3. `stun:stun.voipstunt.com` - VoIP服务
4. `stun:stun.qq.com:3478` - 腾讯QQ
5. `stun:stun.l.google.com:19302` - Google（备用）

## 🔧 高级配置

### 传输参数优化

在 `file-transfer.js` 中可调整以下参数：

```javascript
const chunkSize = 65536;        // 分块大小（64KB）
const transmissionDelay = 1;    // 传输间隔（1ms）
const maxRetransmits = 3;       // 最大重传次数
const maxPacketLifeTime = 3000; // 数据包最大生存时间
```

### 连接超时设置

在 `webrtc-connection.js` 中可调整：

```javascript
const connectionTimeout = 60000; // 连接超时（60秒）
```

## 🐛 故障排除

### 常见问题

1. **P2P连接失败**
   - 检查防火墙设置
   - 确认浏览器支持WebRTC
   - 尝试使用不同的STUN服务器

2. **文件传输中断**
   - 检查网络连接稳定性
   - 避免浏览器标签页切换到后台
   - 大文件传输建议分批进行

3. **取件码无效**
   - 确认取件码输入正确（6位大写字母数字）
   - 检查房间是否已过期（默认1小时）
   - 确认发送方仍在线

### 调试模式

打开浏览器开发者工具（F12），查看Console标签页获取详细日志信息。

## 🚀 生产部署

### Nginx配置

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### systemd服务

创建 `/etc/systemd/system/chuan.service`：

```ini
[Unit]
Description=Chuan P2P File Transfer Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/chuan
ExecStart=/opt/chuan/bin/chuan
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl enable chuan
sudo systemctl start chuan
```

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 开发计划

### v1.1 计划功能
- [ ] 文件传输加密增强
- [ ] 传输速度优化
- [ ] 移动端适配改进
- [ ] 批量文件操作

### v1.2 计划功能
- [ ] 用户认证系统
- [ ] 传输历史记录
- [ ] 文件预览功能
- [ ] API接口开放

### v2.0 计划功能
- [ ] 视频通话功能完善
- [ ] 屏幕共享支持
- [ ] 多人会议室
- [ ] 云存储集成

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [WebRTC](https://webrtc.org/) - 实时通信技术
- [Go](https://golang.org/) - 后端开发语言
- [Tailwind CSS](https://tailwindcss.com/) - UI样式框架
- [Chi Router](https://go-chi.io/) - Go HTTP路由库

## 📞 联系方式

- 项目主页：[GitHub Repository]
- 问题反馈：[GitHub Issues]

---

⭐ 如果这个项目对你有帮助，请给它一个星标！
