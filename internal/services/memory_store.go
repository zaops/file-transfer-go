package services

import (
	"fmt"
	"sync"
	"time"

	"chuan/internal/models"
)

// 内存存储（生产环境应使用Redis）
type MemoryStore struct {
	files map[string]*models.FileInfo
	mutex sync.RWMutex
}

var globalStore = &MemoryStore{
	files: make(map[string]*models.FileInfo),
}

// StoreFileInfo 存储文件信息
func (ms *MemoryStore) StoreFileInfo(fileInfo *models.FileInfo) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()

	ms.files[fileInfo.Code] = fileInfo
	return nil
}

// GetFileInfo 获取文件信息
func (ms *MemoryStore) GetFileInfo(code string) (*models.FileInfo, error) {
	ms.mutex.RLock()
	defer ms.mutex.RUnlock()

	fileInfo, exists := ms.files[code]
	if !exists {
		return nil, fmt.Errorf("文件不存在或已过期")
	}

	// 检查是否过期
	if time.Now().After(fileInfo.ExpiryTime) {
		delete(ms.files, code)
		return nil, fmt.Errorf("文件已过期")
	}

	return fileInfo, nil
}

// DeleteFileInfo 删除文件信息
func (ms *MemoryStore) DeleteFileInfo(code string) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()

	delete(ms.files, code)
	return nil
}

// GetStore 获取全局存储实例
func GetStore() *MemoryStore {
	return globalStore
}
