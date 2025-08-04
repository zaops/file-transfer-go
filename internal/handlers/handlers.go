package handlers

import (
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"path/filepath"
	"time"

	"chuan/internal/models"
	"chuan/internal/services"
)

type Handler struct {
	p2pService    *services.P2PService
	webrtcService *services.WebRTCService
	templates     map[string]*template.Template
}

func NewHandler(p2pService *services.P2PService) *Handler {
	h := &Handler{
		p2pService:    p2pService,
		webrtcService: services.NewWebRTCService(),
		templates:     make(map[string]*template.Template),
	}

	// 加载模板
	// h.loadTemplates()
	return h
}

// 加载模板
func (h *Handler) loadTemplates() {
	templateDir := "web/templates"

	// 加载基础模板
	baseTemplate := filepath.Join(templateDir, "base.html")

	// 加载各个页面模板
	templates := []string{"index.html"}

	for _, tmplName := range templates {
		tmplPath := filepath.Join(templateDir, tmplName)
		tmpl, err := template.ParseFiles(baseTemplate, tmplPath)
		if err != nil {
			panic("加载模板失败: " + err.Error())
		}
		h.templates[tmplName] = tmpl
		println("模板加载成功:", tmplName)
	}
}

// IndexHandler 首页处理器
func (h *Handler) IndexHandler(w http.ResponseWriter, r *http.Request) {
	tmpl, exists := h.templates["index.html"]
	if !exists {
		http.Error(w, "模板不存在", http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{
		"Title": "P2P文件传输",
	}

	if err := tmpl.Execute(w, data); err != nil {
		http.Error(w, "渲染模板失败: "+err.Error(), http.StatusInternalServerError)
		return
	}
}

// CreateTextRoomHandler 创建文字传输房间API
func (h *Handler) CreateTextRoomHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Text string `json:"text"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "解析请求失败", http.StatusBadRequest)
		return
	}

	if req.Text == "" {
		http.Error(w, "文本内容不能为空", http.StatusBadRequest)
		return
	}

	if len(req.Text) > 50000 {
		http.Error(w, "文本内容过长，最大支持50,000字符", http.StatusBadRequest)
		return
	}

	// 创建文字传输房间
	code := h.p2pService.CreateTextRoom(req.Text)

	response := map[string]interface{}{
		"success": true,
		"code":    code,
		"message": "文字传输房间创建成功",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetTextContentHandler 获取文字内容API
func (h *Handler) GetTextContentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" || len(code) != 6 {
		http.Error(w, "请提供正确的6位房间码", http.StatusBadRequest)
		return
	}

	// 获取文字内容
	text, exists := h.p2pService.GetTextContent(code)
	if !exists {
		http.Error(w, "房间不存在或已过期", http.StatusNotFound)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"text":    text,
		"message": "文字内容获取成功",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleWebRTCWebSocket 处理WebRTC信令WebSocket连接
func (h *Handler) HandleWebRTCWebSocket(w http.ResponseWriter, r *http.Request) {
	h.webrtcService.HandleWebSocket(w, r)
}

// CreateRoomHandler 创建文件传输房间API
func (h *Handler) CreateRoomHandler(w http.ResponseWriter, r *http.Request) {
	// 设置响应为JSON格式
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "方法不允许",
		})
		return
	}

	var req struct {
		Files []struct {
			Name         string `json:"name"`
			Size         int64  `json:"size"`
			Type         string `json:"type"`
			LastModified int64  `json:"lastModified"`
		} `json:"files"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "解析请求失败",
			"error":   err.Error(),
		})
		return
	}

	if len(req.Files) == 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "至少需要选择一个文件",
		})
		return
	}

	// 验证文件信息
	for _, file := range req.Files {
		if file.Name == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "文件名不能为空",
			})
			return
		}
		if file.Size <= 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "文件大小必须大于0",
			})
			return
		}

	}

	// 转换文件信息
	var fileInfos []models.FileTransferInfo
	for i, file := range req.Files {
		fileInfos = append(fileInfos, models.FileTransferInfo{
			ID:           fmt.Sprintf("file_%d_%d", time.Now().Unix(), i),
			Name:         file.Name,
			Size:         file.Size,
			Type:         file.Type,
			LastModified: file.LastModified,
		})
	}

	// 创建文件传输房间
	code := h.p2pService.CreateRoom(fileInfos)

	response := map[string]interface{}{
		"success": true,
		"code":    code,
		"message": "文件传输房间创建成功",
		"files":   fileInfos,
	}

	json.NewEncoder(w).Encode(response)
}

// RoomInfoHandler 获取房间信息API
func (h *Handler) RoomInfoHandler(w http.ResponseWriter, r *http.Request) {
	// 设置响应为JSON格式
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "方法不允许",
		})
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" || len(code) != 6 {

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "请提供正确的6位房间码",
		})
		return
	}

	// 获取房间信息
	room, exists := h.p2pService.GetRoomByCode(code)
	if !exists {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "房间不存在或已过期",
		})
		return
	}

	// 构建响应
	response := map[string]interface{}{
		"success": true,
		"message": "房间信息获取成功",
		"room": map[string]interface{}{
			"code":         room.Code,
			"files":        room.Files,
			"file_count":   len(room.Files),
			"is_text_room": room.IsTextRoom,
			"created_at":   room.CreatedAt,
		},
	}

	json.NewEncoder(w).Encode(response)
}

// WebRTCRoomStatusHandler 获取WebRTC房间状态API
func (h *Handler) WebRTCRoomStatusHandler(w http.ResponseWriter, r *http.Request) {
	// 设置响应为JSON格式
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "方法不允许",
		})
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" || len(code) != 6 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "请提供正确的6位房间码",
		})
		return
	}

	// 获取WebRTC房间状态
	status := h.webrtcService.GetRoomStatus(code)

	if !status["exists"].(bool) {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "房间不存在",
		})
		return
	}

	// 构建响应
	response := map[string]interface{}{
		"success":         true,
		"message":         "房间状态获取成功",
		"exists":          status["exists"],
		"sender_online":   status["sender_online"],
		"receiver_online": status["receiver_online"],
		"created_at":      status["created_at"],
	}

	json.NewEncoder(w).Encode(response)
}
