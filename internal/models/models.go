package models

import (
	"time"

	"github.com/gorilla/websocket"
)

// WebRTCOffer WebRTC offer 结构
type WebRTCOffer struct {
	SDP  string `json:"sdp"`
	Type string `json:"type"`
}

// WebRTCAnswer WebRTC answer 结构
type WebRTCAnswer struct {
	SDP  string `json:"sdp"`
	Type string `json:"type"`
}

// WebRTCICECandidate ICE candidate 结构
type WebRTCICECandidate struct {
	Candidate     string `json:"candidate"`
	SDPMLineIndex int    `json:"sdpMLineIndex"`
	SDPMid        string `json:"sdpMid"`
}

// VideoMessage 视频消息结构
type VideoMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// ClientInfo 客户端连接信息
type ClientInfo struct {
	ID         string          `json:"id"`         // 客户端唯一标识
	Role       string          `json:"role"`       // sender 或 receiver
	Connection *websocket.Conn `json:"-"`          // WebSocket连接（不序列化）
	JoinedAt   time.Time       `json:"joined_at"`  // 加入时间
	UserAgent  string          `json:"user_agent"` // 用户代理
}

// RoomStatus 房间状态信息
type RoomStatus struct {
	Code           string    `json:"code"`
	SenderOnline   bool      `json:"sender_online"`
	ReceiverOnline bool      `json:"receiver_online"`
	CreatedAt      time.Time `json:"created_at"`
}

// ErrorResponse 错误响应结构
type ErrorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}
