package services

import (
	"crypto/rand"
	"fmt"
	"log"
	mathrand "math/rand"
	"net/http"
	"strconv"
	"sync"
	"time"

	"chuan/internal/models"

	"github.com/gorilla/websocket"
)

type FileTransferRoom struct {
	ID        string
	Code      string                        // 取件码
	Files     []models.FileTransferInfo     // 待传输文件信息
	Clients   map[string]*models.ClientInfo // 所有连接的客户端 (客户端ID -> ClientInfo)
	CreatedAt time.Time                     // 创建时间
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
		Clients:   make(map[string]*models.ClientInfo),
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

// generateClientID 生成客户端唯一标识
func generateClientID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("client_%x", b)
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

	// 生成客户端ID并创建客户端信息
	clientID := generateClientID()
	client := &models.ClientInfo{
		ID:         clientID,
		Role:       role,
		Connection: conn,
		JoinedAt:   time.Now(),
		UserAgent:  r.Header.Get("User-Agent"),
	}

	// 将客户端加入房间
	room.mutex.Lock()
	room.Clients[clientID] = client
	log.Printf("%s连接到房间: %s (客户端ID: %s)", role, code, clientID)

	// 如果是接收方，发送文件列表
	if role == "receiver" {
		filesMsg := models.VideoMessage{
			Type:    "file-list",
			Payload: map[string]interface{}{"files": room.Files},
		}
		if err := conn.WriteJSON(filesMsg); err != nil {
			log.Printf("发送文件列表失败: %v", err)
		}

		// 通知所有发送方有新的接收方加入
		p.notifyClients(room, "sender", models.VideoMessage{
			Type: "new-receiver",
			Payload: map[string]interface{}{
				"client_id": clientID,
				"joined_at": client.JoinedAt,
			},
		})
	} else if role == "sender" {
		// 通知所有接收方有新的发送方加入
		p.notifyClients(room, "receiver", models.VideoMessage{
			Type: "new-sender",
			Payload: map[string]interface{}{
				"client_id": clientID,
				"joined_at": client.JoinedAt,
			},
		})
	}

	// 发送房间状态给所有客户端
	p.broadcastRoomStatus(room)
	room.mutex.Unlock()

	// 连接关闭时清理
	defer func() {
		room.mutex.Lock()
		delete(room.Clients, clientID)
		log.Printf("客户端断开连接: %s (房间: %s)", clientID, code)

		// 通知其他客户端有人离开
		p.notifyClients(room, "", models.VideoMessage{
			Type: "client-left",
			Payload: map[string]interface{}{
				"client_id": clientID,
				"role":      role,
			},
		})

		// 发送更新后的房间状态
		p.broadcastRoomStatus(room)
		room.mutex.Unlock()

		// 如果房间没有客户端了，清理房间
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

		log.Printf("收到WebSocket消息: 类型=%s, 来自=%s, 房间=%s", msg.Type, clientID, code)

		// 处理特殊消息类型
		switch msg.Type {
		case "file-request":
			// 处理文件请求
			p.handleFileRequest(room, clientID, msg)
		case "file-info", "file-chunk", "file-complete":
			// 处理文件传输相关消息，直接转发给接收方
			p.forwardMessage(room, clientID, msg)
		default:
			// 转发消息到对应的客户端
			p.forwardMessage(room, clientID, msg)
		}
	}
}

// notifyClients 通知指定角色的客户端
func (p *P2PService) notifyClients(room *FileTransferRoom, role string, msg models.VideoMessage) {
	for _, client := range room.Clients {
		if role == "" || client.Role == role {
			if err := client.Connection.WriteJSON(msg); err != nil {
				log.Printf("发送消息到客户端失败 %s: %v", client.ID, err)
			}
		}
	}
}

// broadcastRoomStatus 广播房间状态给所有客户端
func (p *P2PService) broadcastRoomStatus(room *FileTransferRoom) {
	status := p.getRoomStatus(room)
	statusMsg := models.VideoMessage{
		Type:    "room-status",
		Payload: status,
	}

	for _, client := range room.Clients {
		if err := client.Connection.WriteJSON(statusMsg); err != nil {
			log.Printf("发送房间状态失败 %s: %v", client.ID, err)
		}
	}
}

// getRoomStatus 获取房间状态
func (p *P2PService) getRoomStatus(room *FileTransferRoom) models.RoomStatus {
	senderCount := 0
	receiverCount := 0
	clients := make([]models.ClientInfo, 0, len(room.Clients))

	for _, client := range room.Clients {
		// 创建不包含连接的客户端信息副本
		clientCopy := models.ClientInfo{
			ID:        client.ID,
			Role:      client.Role,
			JoinedAt:  client.JoinedAt,
			UserAgent: client.UserAgent,
		}
		clients = append(clients, clientCopy)

		if client.Role == "sender" {
			senderCount++
		} else if client.Role == "receiver" {
			receiverCount++
		}
	}

	return models.RoomStatus{
		Code:          room.Code,
		FileCount:     len(room.Files),
		SenderCount:   senderCount,
		ReceiverCount: receiverCount,
		Clients:       clients,
		CreatedAt:     room.CreatedAt,
	}
}

// handleFileRequest 处理文件请求
func (p *P2PService) handleFileRequest(room *FileTransferRoom, clientID string, msg models.VideoMessage) {
	// 获取请求的文件ID
	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("无效的文件请求消息格式")
		return
	}

	fileID, ok := payload["file_id"].(string)
	if !ok {
		log.Printf("缺少文件ID")
		return
	}

	// 转发文件请求给所有发送方
	requestMsg := models.VideoMessage{
		Type: "file-request",
		Payload: map[string]interface{}{
			"file_id":    fileID,
			"requester":  clientID,
			"request_id": payload["request_id"],
		},
	}

	p.notifyClients(room, "sender", requestMsg)
}

// forwardMessage 转发消息到指定客户端或所有对应角色的客户端
func (p *P2PService) forwardMessage(room *FileTransferRoom, senderClientID string, msg models.VideoMessage) {
	room.mutex.RLock()
	defer room.mutex.RUnlock()

	senderClient, exists := room.Clients[senderClientID]
	if !exists {
		log.Printf("发送方客户端不存在: %s", senderClientID)
		return
	}

	// 检查消息是否指定了目标客户端
	if payload, ok := msg.Payload.(map[string]interface{}); ok {
		if targetID, hasTarget := payload["target_client"].(string); hasTarget {
			// 发送给指定客户端
			if targetClient, exists := room.Clients[targetID]; exists {
				log.Printf("转发消息: 类型=%s, 从%s到%s", msg.Type, senderClientID, targetID)
				if err := targetClient.Connection.WriteJSON(msg); err != nil {
					log.Printf("转发消息失败: %v", err)
				}
				return
			}
		}
	}

	// 否则根据角色转发给对应的客户端
	targetRole := ""
	if senderClient.Role == "sender" {
		targetRole = "receiver"
	} else if senderClient.Role == "receiver" {
		targetRole = "sender"
	}

	if targetRole != "" {
		log.Printf("广播消息: 类型=%s, 从%s到所有%s", msg.Type, senderClient.Role, targetRole)
		p.notifyClients(room, targetRole, msg)
	}
}

// cleanupRoom 清理房间
func (p *P2PService) cleanupRoom(code string) {
	p.roomsMux.Lock()
	defer p.roomsMux.Unlock()

	if room, exists := p.rooms[code]; exists {
		room.mutex.RLock()
		noClients := len(room.Clients) == 0
		room.mutex.RUnlock()

		if noClients {
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
	mathrand.Seed(time.Now().UnixNano())
	code := mathrand.Intn(900000) + 100000
	return strconv.Itoa(code)
}

// GetRoomStatusByCode 根据取件码获取房间状态
func (p *P2PService) GetRoomStatusByCode(code string) (models.RoomStatus, bool) {
	p.roomsMux.RLock()
	defer p.roomsMux.RUnlock()

	room, exists := p.rooms[code]
	if !exists {
		return models.RoomStatus{}, false
	}

	room.mutex.RLock()
	status := p.getRoomStatus(room)
	room.mutex.RUnlock()

	return status, true
}
func (p *P2PService) GetRoomStats() map[string]interface{} {
	p.roomsMux.RLock()
	defer p.roomsMux.RUnlock()

	stats := map[string]interface{}{
		"total_rooms": len(p.rooms),
		"rooms":       make([]map[string]interface{}, 0),
	}

	for code, room := range p.rooms {
		room.mutex.RLock()
		status := p.getRoomStatus(room)
		roomInfo := map[string]interface{}{
			"code":           code,
			"file_count":     len(room.Files),
			"sender_count":   status.SenderCount,
			"receiver_count": status.ReceiverCount,
			"total_clients":  len(room.Clients),
			"created_at":     room.CreatedAt,
		}
		room.mutex.RUnlock()
		stats["rooms"] = append(stats["rooms"].([]map[string]interface{}), roomInfo)
	}

	return stats
}

// UpdateRoomFiles 更新房间文件列表
func (p *P2PService) UpdateRoomFiles(code string, files []models.FileTransferInfo) bool {
	p.roomsMux.RLock()
	room, exists := p.rooms[code]
	p.roomsMux.RUnlock()

	if !exists {
		return false
	}

	room.mutex.Lock()
	room.Files = files
	room.mutex.Unlock()

	log.Printf("房间 %s 文件列表已更新，共 %d 个文件", code, len(files))

	// 通知所有连接的客户端文件列表已更新
	room.mutex.RLock()
	for _, client := range room.Clients {
		if client.Role == "receiver" {
			message := models.VideoMessage{
				Type: "file-list-updated",
				Payload: map[string]interface{}{
					"files": files,
				},
			}

			if err := client.Connection.WriteJSON(message); err != nil {
				log.Printf("发送文件列表更新消息失败: %v", err)
			}
		}
	}
	room.mutex.RUnlock()

	return true
}
