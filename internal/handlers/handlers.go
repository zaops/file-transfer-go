package handlers

import (
	"encoding/json"
	"html/template"
	"net/http"
	"path/filepath"

	"chuan/internal/models"
	"chuan/internal/services"
)

type Handler struct {
	p2pService *services.P2PService
	templates  map[string]*template.Template
}

func NewHandler(p2pService *services.P2PService) *Handler {
	h := &Handler{
		p2pService: p2pService,
		templates:  make(map[string]*template.Template),
	}

	// 加载模板
	h.loadTemplates()
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

// CreateRoomHandler 创建房间API
func (h *Handler) CreateRoomHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Files []models.FileTransferInfo `json:"files"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "解析请求失败", http.StatusBadRequest)
		return
	}

	// 创建房间
	code := h.p2pService.CreateRoom(req.Files)

	response := map[string]interface{}{
		"success": true,
		"code":    code,
		"message": "房间创建成功",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetRoomInfoHandler 获取房间信息API
func (h *Handler) GetRoomInfoHandler(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "缺少取件码", http.StatusBadRequest)
		return
	}

	room, exists := h.p2pService.GetRoomByCode(code)
	if !exists {
		response := map[string]interface{}{
			"success": false,
			"message": "取件码不存在或已过期",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"files":   room.Files,
		"message": "房间信息获取成功",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetRoomStatusHandler 获取房间状态API
func (h *Handler) GetRoomStatusHandler(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "缺少取件码", http.StatusBadRequest)
		return
	}

	status, exists := h.p2pService.GetRoomStatusByCode(code)
	if !exists {
		response := map[string]interface{}{
			"success": false,
			"message": "取件码不存在或已过期",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"status":  status,
		"message": "房间状态获取成功",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdateRoomFilesHandler 更新房间文件列表API
func (h *Handler) UpdateRoomFilesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Code  string                    `json:"code"`
		Files []models.FileTransferInfo `json:"files"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "解析请求失败", http.StatusBadRequest)
		return
	}

	// 更新房间文件列表
	success := h.p2pService.UpdateRoomFiles(req.Code, req.Files)

	response := map[string]interface{}{
		"success": success,
	}

	if success {
		response["message"] = "文件列表更新成功"
	} else {
		response["message"] = "房间不存在或更新失败"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
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

	// 从URL路径中提取code
	path := r.URL.Path
	code := path[len("/api/get-text-content/"):]

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

// HandleP2PWebSocket 处理P2P WebSocket连接
func (h *Handler) HandleP2PWebSocket(w http.ResponseWriter, r *http.Request) {
	h.p2pService.HandleWebSocket(w, r)
}
