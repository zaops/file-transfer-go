package web

import (
	"embed"
	"io"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// 前端文件嵌入 - 这个路径会在构建脚本中被替换
//
//go:embed frontend/*
var FrontendFiles embed.FS

// hasFrontendFiles 检查是否有前端文件
func hasFrontendFiles() bool {
	entries, err := FrontendFiles.ReadDir("frontend")
	if err != nil {
		return false
	}
	return len(entries) > 0
}

// CreateFrontendHandler 创建前端文件处理器
func CreateFrontendHandler() http.Handler {
	if !hasFrontendFiles() {
		return &placeholderHandler{}
	}

	frontendFS, err := fs.Sub(FrontendFiles, "frontend")
	if err != nil {
		return &placeholderHandler{}
	}

	return &spaHandler{fs: frontendFS}
}

// placeholderHandler 占位处理器
type placeholderHandler struct{}

func (h *placeholderHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <title>文件传输服务</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 20px; }
        .status { padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; margin: 20px 0; }
        .commands { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
        pre { margin: 0; overflow-x: auto; }
        .api-list { margin: 20px 0; }
        .api-item { margin: 10px 0; padding: 10px; background: #e3f2fd; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 文件传输服务</h1>
        
        <div class="status">
            ⚠️ 前端界面未构建，当前显示的是后端 API 服务。
        </div>
        
        <h2>📋 可用的 API 接口</h2>
        <div class="api-list">
            <div class="api-item"><strong>POST</strong> /api/create-text-room - 创建文本传输房间</div>
            <div class="api-item"><strong>GET</strong> /api/get-text-content/* - 获取文本内容</div>
            <div class="api-item"><strong>WebSocket</strong> /ws/webrtc - WebRTC 信令连接</div>
        </div>
        
        <h2>🛠️ 构建前端</h2>
        <div class="commands">
            <pre># 进入前端目录
cd chuan-next

# 安装依赖
yarn install

# 构建静态文件
yarn build:ssg

# 重新构建 Go 项目以嵌入前端文件
cd ..
go build -o file-transfer-server ./cmd</pre>
        </div>
        
        <p><strong>提示:</strong> 构建完成后刷新页面即可看到完整的前端界面。</p>
    </div>
</body>
</html>
	`))
}

// spaHandler SPA 应用处理器
type spaHandler struct {
	fs fs.FS
}

func (h *spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// 清理路径
	upath := strings.TrimPrefix(r.URL.Path, "/")
	if upath == "" {
		upath = "index.html"
	}

	// 尝试打开请求的文件
	file, err := h.fs.Open(upath)
	if err != nil {
		// 文件不存在，对于 SPA 应用返回 index.html
		h.serveIndexHTML(w, r)
		return
	}
	defer file.Close()

	// 获取文件信息
	stat, err := file.Stat()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 如果是目录，查找 index.html
	if stat.IsDir() {
		indexPath := path.Join(upath, "index.html")
		indexFile, err := h.fs.Open(indexPath)
		if err != nil {
			h.serveIndexHTML(w, r)
			return
		}
		defer indexFile.Close()

		h.serveFile(w, r, "index.html", indexFile)
		return
	}

	// 服务静态文件
	h.serveFile(w, r, stat.Name(), file)
}

// serveIndexHTML 服务 index.html 文件
func (h *spaHandler) serveIndexHTML(w http.ResponseWriter, r *http.Request) {
	file, err := h.fs.Open("index.html")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer file.Close()

	h.serveFile(w, r, "index.html", file)
}

// serveFile 服务文件
func (h *spaHandler) serveFile(w http.ResponseWriter, r *http.Request, filename string, file fs.File) {
	// 设置 Content-Type
	setContentType(w, filename)

	// 获取文件信息
	stat, err := file.Stat()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 读取文件内容
	content, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 设置缓存头
	if shouldCache(filename) {
		w.Header().Set("Cache-Control", "public, max-age=31536000") // 1年
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}

	// 服务内容
	http.ServeContent(w, r, filename, stat.ModTime(), strings.NewReader(string(content)))
}

// setContentType 设置 Content-Type
func setContentType(w http.ResponseWriter, filename string) {
	ext := path.Ext(filename)
	switch ext {
	case ".html":
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	case ".css":
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
	case ".js":
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	case ".json":
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".jpg", ".jpeg":
		w.Header().Set("Content-Type", "image/jpeg")
	case ".gif":
		w.Header().Set("Content-Type", "image/gif")
	case ".svg":
		w.Header().Set("Content-Type", "image/svg+xml")
	case ".ico":
		w.Header().Set("Content-Type", "image/x-icon")
	case ".woff":
		w.Header().Set("Content-Type", "font/woff")
	case ".woff2":
		w.Header().Set("Content-Type", "font/woff2")
	case ".ttf":
		w.Header().Set("Content-Type", "font/ttf")
	case ".txt":
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}
}

// shouldCache 判断文件是否应该被缓存
func shouldCache(filename string) bool {
	ext := path.Ext(filename)
	switch ext {
	case ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf":
		return true
	default:
		return false
	}
}
