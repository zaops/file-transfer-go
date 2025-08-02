package web

import (
	"embed"
	"io/fs"
	"net/http"
)

// 嵌入静态文件
//
//go:embed all:static
var StaticFiles embed.FS

// StaticFileServer 创建静态文件服务器
func StaticFileServer() http.Handler {
	// 获取嵌入的文件系统
	staticFS, err := fs.Sub(StaticFiles, "static")
	if err != nil {
		panic(err)
	}

	return http.FileServer(http.FS(staticFS))
}

// FrontendFileServer 创建前端文件服务器
func FrontendFileServer() http.Handler {
	return &frontendHandler{}
}

// frontendHandler 处理前端文件请求，支持 SPA 路由
type frontendHandler struct{}

func (h *frontendHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// 返回一个简单的占位页面
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`
<!DOCTYPE html>
<html>
<head>
    <title>文件传输</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>文件传输服务</h1>
    <p>前端文件未嵌入，请先构建前端项目。</p>
    <p>运行以下命令构建前端：</p>
    <pre>cd chuan-next && yarn build:ssg</pre>
</body>
</html>
	`))
}
