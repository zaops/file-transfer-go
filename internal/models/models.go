package models

import (
	"time"
)

// FileInfo 文件信息结构
type FileInfo struct {
	ID          string    `json:"id"`
	FileName    string    `json:"filename"`
	FileSize    int64     `json:"file_size"`
	ContentType string    `json:"content_type"`
	Code        string    `json:"code"`
	UploadTime  time.Time `json:"upload_time"`
	ExpiryTime  time.Time `json:"expiry_time"`
	DownloadURL string    `json:"download_url"`
	FilePath    string    `json:"file_path"`
}

// UploadResponse 上传响应结构
type UploadResponse struct {
	Success     bool     `json:"success"`
	Message     string   `json:"message"`
	Code        string   `json:"code,omitempty"`
	FileInfo    FileInfo `json:"file_info,omitempty"`
	DownloadURL string   `json:"download_url,omitempty"`
}

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

// FileTransferInfo P2P文件传输信息
type FileTransferInfo struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Size         int64  `json:"size"`
	Type         string `json:"type"`
	LastModified int64  `json:"lastModified"`
}

// ErrorResponse 错误响应结构
type ErrorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}
