package services

import (
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"sync"
	"time"

	"chuan/internal/models"

	"github.com/gorilla/websocket"
)

type FileTransferRoom struct {
	ID        string
	Code      string                    // 取件码
	Files     []models.FileTransferInfo // 待传输文件信息
	Sender    *websocket.Conn           // 发送方连接
	Receiver  *websocket.Conn           // 接收方连接
	CreatedAt time.Time                 // 创建时间
	mutex     sync.RWMutex
}

type P2PService struct {
	rooms    map[string]*FileTransferRoom // 使用取件码作为key
	roomsMux sync.RWMutex
	upgrader websocket.Upgrader
}

func NewP2PService() *P2PService {
	service := &P2PService{
		rooms:    make(map[string]*FileTransferRoom),
		roomsMux: sync.RWMutex{},
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // 允许所有来源，生产环境应当限制
			},
		},
	}

	// 启动房间清理任务
	go service.cleanupExpiredRooms()

	return service
}

// CreateRoom 创建新房间并返回取件码
func (p *P2PService) CreateRoom(files []models.FileTransferInfo) string {
	code := generatePickupCode()

	p.roomsMux.Lock()
	defer p.roomsMux.Unlock()

	room := &FileTransferRoom{
		ID:        "room_" + code,
		Code:      code,
		Files:     files,
		CreatedAt: time.Now(),
	}

	p.rooms[code] = room
	log.Printf("创建房间，取件码: %s，文件数量: %d", code, len(files))

	return code
}

// GetRoomByCode 根据取件码获取房间
func (p *P2PService) GetRoomByCode(code string) (*FileTransferRoom, bool) {
	p.roomsMux.RLock()
	defer p.roomsMux.RUnlock()

	room, exists := p.rooms[code]
	return room, exists
}

// HandleWebSocket 处理WebSocket连接
func (p *P2PService) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := p.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket升级失败: %v", err)
		return
	}
	defer conn.Close()

	// 获取取件码和角色
	code := r.URL.Query().Get("code")
	role := r.URL.Query().Get("role") // "sender" or "receiver"

	if code == "" || (role != "sender" && role != "receiver") {
		log.Printf("缺少取件码或角色参数")
		return
	}

	// 获取房间
	room, exists := p.GetRoomByCode(code)
	if !exists {
		log.Printf("房间不存在: %s", code)
		return
	}

	// 设置连接
	room.mutex.Lock()
	if role == "sender" {
		room.Sender = conn
		log.Printf("发送方连接到房间: %s", code)
	} else {
		room.Receiver = conn
		log.Printf("接收方连接到房间: %s", code)

		// 发送文件列表给接收方
		filesMsg := models.VideoMessage{
			Type:    "file-list",
			Payload: map[string]interface{}{"files": room.Files},
		}
		if err := conn.WriteJSON(filesMsg); err != nil {
			log.Printf("发送文件列表失败: %v", err)
		}

		// 通知发送方接收方已连接
		if room.Sender != nil {
			readyMsg := models.VideoMessage{
				Type:    "receiver-ready",
				Payload: map[string]interface{}{},
			}
			if err := room.Sender.WriteJSON(readyMsg); err != nil {
				log.Printf("发送接收方就绪消息失败: %v", err)
			}
		}
	}
	room.mutex.Unlock() // 连接关闭时清理
	defer func() {
		room.mutex.Lock()
		if role == "sender" {
			room.Sender = nil
		} else {
			room.Receiver = nil
		}
		room.mutex.Unlock()

		// 如果双方都断开连接，删除房间
		p.cleanupRoom(code)
	}()

	// 处理消息
	for {
		var msg models.VideoMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Printf("读取WebSocket消息失败: %v", err)
			break
		}

		log.Printf("收到WebSocket消息: 类型=%s, 来自=%s, 房间=%s", msg.Type, role, code)

		// 转发消息到对方
		p.forwardMessage(room, role, msg)
	}
}

// forwardMessage 转发消息到对方
func (p *P2PService) forwardMessage(room *FileTransferRoom, senderRole string, msg models.VideoMessage) {
	room.mutex.RLock()
	defer room.mutex.RUnlock()

	var targetConn *websocket.Conn
	var targetRole string
	if senderRole == "sender" && room.Receiver != nil {
		targetConn = room.Receiver
		targetRole = "receiver"
	} else if senderRole == "receiver" && room.Sender != nil {
		targetConn = room.Sender
		targetRole = "sender"
	}

	if targetConn != nil {
		log.Printf("转发消息: 类型=%s, 从%s到%s", msg.Type, senderRole, targetRole)
		if err := targetConn.WriteJSON(msg); err != nil {
			log.Printf("转发消息失败: %v", err)
		} else {
			log.Printf("消息转发成功: 类型=%s", msg.Type)
		}
	} else {
		log.Printf("无法转发消息: 目标连接不存在, 发送方=%s", senderRole)
	}
}

// cleanupRoom 清理房间
func (p *P2PService) cleanupRoom(code string) {
	p.roomsMux.Lock()
	defer p.roomsMux.Unlock()

	if room, exists := p.rooms[code]; exists {
		room.mutex.RLock()
		bothDisconnected := room.Sender == nil && room.Receiver == nil
		room.mutex.RUnlock()

		if bothDisconnected {
			delete(p.rooms, code)
			log.Printf("清理房间: %s", code)
		}
	}
}

// cleanupExpiredRooms 定期清理过期房间
func (p *P2PService) cleanupExpiredRooms() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		p.roomsMux.Lock()
		now := time.Now()
		for code, room := range p.rooms {
			// 房间存在超过1小时则删除
			if now.Sub(room.CreatedAt) > time.Hour {
				delete(p.rooms, code)
				log.Printf("清理过期房间: %s", code)
			}
		}
		p.roomsMux.Unlock()
	}
}

// generatePickupCode 生成6位取件码
func generatePickupCode() string {
	rand.Seed(time.Now().UnixNano())
	code := rand.Intn(900000) + 100000
	return strconv.Itoa(code)
}

// GetRoomStats 获取房间统计信息
func (p *P2PService) GetRoomStats() map[string]interface{} {
	p.roomsMux.RLock()
	defer p.roomsMux.RUnlock()

	stats := map[string]interface{}{
		"total_rooms": len(p.rooms),
		"rooms":       make([]map[string]interface{}, 0),
	}

	for code, room := range p.rooms {
		room.mutex.RLock()
		roomInfo := map[string]interface{}{
			"code":         code,
			"file_count":   len(room.Files),
			"has_sender":   room.Sender != nil,
			"has_receiver": room.Receiver != nil,
			"created_at":   room.CreatedAt,
		}
		room.mutex.RUnlock()
		stats["rooms"] = append(stats["rooms"].([]map[string]interface{}), roomInfo)
	}

	return stats
}
