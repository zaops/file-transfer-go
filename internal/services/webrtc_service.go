package services

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type WebRTCService struct {
	rooms    map[string]*WebRTCRoom
	roomsMux sync.RWMutex
	upgrader websocket.Upgrader
}

type WebRTCRoom struct {
	Code      string
	Sender    *WebRTCClient
	Receiver  *WebRTCClient
	CreatedAt time.Time
	LastOffer *WebRTCMessage // 保存最后的offer消息
}

type WebRTCClient struct {
	ID         string
	Role       string // "sender" or "receiver"
	Connection *websocket.Conn
	Room       string
}

func NewWebRTCService() *WebRTCService {
	return &WebRTCService{
		rooms:    make(map[string]*WebRTCRoom),
		roomsMux: sync.RWMutex{},
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // 允许所有来源，生产环境应当限制
			},
		},
	}
}

type WebRTCMessage struct {
	Type    string      `json:"type"`
	From    string      `json:"from"`
	To      string      `json:"to"`
	Payload interface{} `json:"payload"`
}

// HandleWebSocket 处理WebRTC信令WebSocket连接
func (ws *WebRTCService) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := ws.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebRTC WebSocket升级失败: %v", err)
		return
	}
	defer conn.Close()

	// 获取房间码和角色
	code := r.URL.Query().Get("code")
	role := r.URL.Query().Get("role")

	if code == "" || (role != "sender" && role != "receiver") {
		log.Printf("WebRTC连接参数无效: code=%s, role=%s", code, role)
		return
	}

	// 生成客户端ID
	clientID := ws.generateClientID()
	client := &WebRTCClient{
		ID:         clientID,
		Role:       role,
		Connection: conn,
		Room:       code,
	}

	// 添加客户端到房间
	ws.addClientToRoom(code, client)
	log.Printf("WebRTC %s连接到房间: %s (客户端ID: %s)", role, code, clientID)

	// 连接关闭时清理
	defer func() {
		ws.removeClientFromRoom(code, clientID)
		log.Printf("WebRTC客户端断开连接: %s (房间: %s)", clientID, code)
	}()

	// 处理消息
	for {
		var msg WebRTCMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Printf("读取WebRTC WebSocket消息失败: %v", err)
			break
		}

		msg.From = clientID
		log.Printf("收到WebRTC信令: 类型=%s, 来自=%s, 房间=%s", msg.Type, clientID, code)

		// 转发信令消息给对方
		ws.forwardMessage(code, clientID, &msg)
	}
}

// 添加客户端到房间
func (ws *WebRTCService) addClientToRoom(code string, client *WebRTCClient) {
	ws.roomsMux.Lock()
	defer ws.roomsMux.Unlock()

	room := ws.rooms[code]
	if room == nil {
		room = &WebRTCRoom{
			Code:      code,
			CreatedAt: time.Now(),
		}
		ws.rooms[code] = room
	}

	if client.Role == "sender" {
		room.Sender = client
	} else {
		room.Receiver = client
		// 如果接收方连接，且有保存的offer，立即发送给接收方
		if room.LastOffer != nil {
			log.Printf("向新连接的接收方发送保存的offer")
			err := client.Connection.WriteJSON(room.LastOffer)
			if err != nil {
				log.Printf("发送保存的offer失败: %v", err)
			}
		}
	}
}

// 从房间移除客户端
func (ws *WebRTCService) removeClientFromRoom(code string, clientID string) {
	ws.roomsMux.Lock()
	defer ws.roomsMux.Unlock()

	room := ws.rooms[code]
	if room == nil {
		return
	}

	if room.Sender != nil && room.Sender.ID == clientID {
		room.Sender = nil
	}
	if room.Receiver != nil && room.Receiver.ID == clientID {
		room.Receiver = nil
	}

	// 如果房间为空，删除房间
	if room.Sender == nil && room.Receiver == nil {
		delete(ws.rooms, code)
		log.Printf("清理WebRTC房间: %s", code)
	}
}

// 转发信令消息
func (ws *WebRTCService) forwardMessage(roomCode string, fromClientID string, msg *WebRTCMessage) {
	ws.roomsMux.Lock()
	defer ws.roomsMux.Unlock()

	room := ws.rooms[roomCode]
	if room == nil {
		return
	}

	// 如果是offer消息，保存起来
	if msg.Type == "offer" {
		room.LastOffer = msg
		log.Printf("保存offer消息，等待接收方连接")
	}

	var targetClient *WebRTCClient
	if room.Sender != nil && room.Sender.ID == fromClientID {
		// 消息来自sender，转发给receiver
		targetClient = room.Receiver
	} else if room.Receiver != nil && room.Receiver.ID == fromClientID {
		// 消息来自receiver，转发给sender
		targetClient = room.Sender
	}

	if targetClient != nil && targetClient.Connection != nil {
		msg.To = targetClient.ID
		err := targetClient.Connection.WriteJSON(msg)
		if err != nil {
			log.Printf("转发WebRTC信令失败: %v", err)
		} else {
			log.Printf("转发WebRTC信令: 类型=%s, 从=%s到=%s", msg.Type, fromClientID, targetClient.ID)
		}
	} else {
		log.Printf("目标客户端不在线，消息类型=%s", msg.Type)
	}
}

// 生成客户端ID
func (ws *WebRTCService) generateClientID() string {
	return fmt.Sprintf("webrtc_client_%d", rand.Int63())
}

// 获取房间状态
func (ws *WebRTCService) GetRoomStatus(code string) map[string]interface{} {
	ws.roomsMux.RLock()
	defer ws.roomsMux.RUnlock()

	room := ws.rooms[code]
	if room == nil {
		return map[string]interface{}{
			"exists": false,
		}
	}

	return map[string]interface{}{
		"exists":          true,
		"sender_online":   room.Sender != nil,
		"receiver_online": room.Receiver != nil,
		"created_at":      room.CreatedAt,
	}
}
