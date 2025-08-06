package handlers

import (
	"encoding/json"
	"net/http"

	"chuan/internal/services"
)

type Handler struct {
	webrtcService *services.WebRTCService
}

func NewHandler() *Handler {
	return &Handler{
		webrtcService: services.NewWebRTCService(),
	}
}

// HandleWebRTCWebSocket 处理WebRTC信令WebSocket连接
func (h *Handler) HandleWebRTCWebSocket(w http.ResponseWriter, r *http.Request) {
	h.webrtcService.HandleWebSocket(w, r)
}

// CreateRoomHandler 创建房间API
func (h *Handler) CreateRoomHandler(w http.ResponseWriter, r *http.Request) {
	// 设置响应为JSON格式
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "方法不允许",
		})
		return
	}

	// 创建新房间
	code := h.webrtcService.CreateNewRoom()

	// 构建响应
	response := map[string]interface{}{
		"success": true,
		"code":    code,
		"message": "房间创建成功",
	}

	json.NewEncoder(w).Encode(response)
}

// RoomStatusHandler 获取WebRTC房间状态API
func (h *Handler) RoomStatusHandler(w http.ResponseWriter, r *http.Request) {
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

	// 获取WebRTC房间状态
	webrtcStatus := h.webrtcService.GetRoomStatus(code)

	// 如果房间不存在，返回不存在状态
	if !webrtcStatus["exists"].(bool) {
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
		"sender_online":   webrtcStatus["sender_online"],
		"receiver_online": webrtcStatus["receiver_online"],
		"created_at":      webrtcStatus["created_at"],
	}

	json.NewEncoder(w).Encode(response)
}
