package services

import (
	"log"
	"net/http"
	"sync"

	"chuan/internal/models"

	"github.com/gorilla/websocket"
)

type WebRTCService struct {
	clients    map[string]*websocket.Conn
	clientsMux sync.RWMutex
	upgrader   websocket.Upgrader
}

func NewWebRTCService() *WebRTCService {
	return &WebRTCService{
		clients:    make(map[string]*websocket.Conn),
		clientsMux: sync.RWMutex{},
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // 允许所有来源，生产环境应当限制
			},
		},
	}
}

// HandleWebSocket 处理WebSocket连接
func (ws *WebRTCService) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := ws.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket升级失败: %v", err)
		return
	}
	defer conn.Close()

	// 为客户端生成唯一ID
	clientID := ws.generateClientID()

	// 添加客户端到连接池
	ws.clientsMux.Lock()
	ws.clients[clientID] = conn
	ws.clientsMux.Unlock()

	// 连接关闭时清理
	defer func() {
		ws.clientsMux.Lock()
		delete(ws.clients, clientID)
		ws.clientsMux.Unlock()
	}()

	// 发送欢迎消息
	welcomeMsg := models.VideoMessage{
		Type:    "welcome",
		Payload: map[string]string{"clientId": clientID},
	}
	ws.sendMessage(conn, welcomeMsg)

	// 处理消息
	for {
		var msg models.VideoMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Printf("读取WebSocket消息失败: %v", err)
			break
		}

		switch msg.Type {
		case "offer":
			ws.handleOffer(clientID, msg)
		case "answer":
			ws.handleAnswer(clientID, msg)
		case "ice-candidate":
			ws.handleICECandidate(clientID, msg)
		case "join-room":
			ws.handleJoinRoom(clientID, msg)
		case "leave-room":
			ws.handleLeaveRoom(clientID, msg)
		default:
			log.Printf("未知消息类型: %s", msg.Type)
		}
	}
}

// handleOffer 处理WebRTC Offer
func (ws *WebRTCService) handleOffer(clientID string, msg models.VideoMessage) {
	// 广播offer到其他客户端
	ws.broadcastToOthers(clientID, msg)
}

// handleAnswer 处理WebRTC Answer
func (ws *WebRTCService) handleAnswer(clientID string, msg models.VideoMessage) {
	// 广播answer到其他客户端
	ws.broadcastToOthers(clientID, msg)
}

// handleICECandidate 处理ICE candidate
func (ws *WebRTCService) handleICECandidate(clientID string, msg models.VideoMessage) {
	// 广播ICE candidate到其他客户端
	ws.broadcastToOthers(clientID, msg)
}

// handleJoinRoom 处理加入房间
func (ws *WebRTCService) handleJoinRoom(clientID string, msg models.VideoMessage) {
	// TODO: 实现房间管理逻辑
	log.Printf("客户端 %s 加入房间", clientID)
}

// handleLeaveRoom 处理离开房间
func (ws *WebRTCService) handleLeaveRoom(clientID string, msg models.VideoMessage) {
	// TODO: 实现房间管理逻辑
	log.Printf("客户端 %s 离开房间", clientID)
}

// broadcastToOthers 向其他客户端广播消息
func (ws *WebRTCService) broadcastToOthers(senderID string, msg models.VideoMessage) {
	ws.clientsMux.RLock()
	defer ws.clientsMux.RUnlock()

	for clientID, conn := range ws.clients {
		if clientID != senderID {
			ws.sendMessage(conn, msg)
		}
	}
}

// sendMessage 发送消息到WebSocket连接
func (ws *WebRTCService) sendMessage(conn *websocket.Conn, msg models.VideoMessage) {
	if err := conn.WriteJSON(msg); err != nil {
		log.Printf("发送WebSocket消息失败: %v", err)
	}
}

// generateClientID 生成客户端ID
func (ws *WebRTCService) generateClientID() string {
	// 简单的ID生成，生产环境应使用更安全的方法
	return "client_" + randomString(8)
}

// CreateOffer 创建WebRTC Offer
func (ws *WebRTCService) CreateOffer() (*models.WebRTCOffer, error) {
	// TODO: 实现WebRTC Offer创建
	return &models.WebRTCOffer{
		SDP:  "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n...", // 示例SDP
		Type: "offer",
	}, nil
}

// CreateAnswer 创建WebRTC Answer
func (ws *WebRTCService) CreateAnswer(offer *models.WebRTCOffer) (*models.WebRTCAnswer, error) {
	// TODO: 实现WebRTC Answer创建
	return &models.WebRTCAnswer{
		SDP:  "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n...", // 示例SDP
		Type: "answer",
	}, nil
}

// AddICECandidate 添加ICE候选
func (ws *WebRTCService) AddICECandidate(candidate *models.WebRTCICECandidate) error {
	// TODO: 实现ICE候选处理
	return nil
}

// randomString 生成随机字符串
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[i%len(charset)]
	}
	return string(b)
}
