package services

import (
	"crypto/rand"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"chuan/internal/models"

	"github.com/google/uuid"
)

type FileService struct {
	uploadDir string
}

func NewFileService() *FileService {
	return &FileService{
		uploadDir: "./uploads",
	}
}

// SaveFile 保存上传的文件
func (fs *FileService) SaveFile(file multipart.File, header *multipart.FileHeader) (*models.FileInfo, error) {
	// 生成唯一文件ID
	fileID := uuid.New().String()

	// 生成取件码
	code := fs.generateCode()

	// 创建文件路径
	fileExt := filepath.Ext(header.Filename)
	fileName := fmt.Sprintf("%s%s", fileID, fileExt)
	filePath := filepath.Join(fs.uploadDir, fileName)

	// 确保上传目录存在
	if err := os.MkdirAll(fs.uploadDir, 0755); err != nil {
		return nil, fmt.Errorf("创建上传目录失败: %v", err)
	}

	// 创建目标文件
	dst, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("创建文件失败: %v", err)
	}
	defer dst.Close()

	// 复制文件内容
	size, err := io.Copy(dst, file)
	if err != nil {
		return nil, fmt.Errorf("保存文件失败: %v", err)
	}

	// 获取文件内容类型
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = fs.getContentType(header.Filename)
	}

	fileInfo := &models.FileInfo{
		ID:          fileID,
		FileName:    header.Filename,
		FileSize:    size,
		ContentType: contentType,
		Code:        code,
		UploadTime:  time.Now(),
		ExpiryTime:  time.Now().Add(24 * time.Hour), // 24小时过期
		FilePath:    filePath,
		DownloadURL: fmt.Sprintf("/download/%s", code),
	}

	// 存储文件信息到内存（生产环境应使用Redis）
	store := GetStore()
	if err := store.StoreFileInfo(fileInfo); err != nil {
		return nil, fmt.Errorf("存储文件信息失败: %v", err)
	}

	return fileInfo, nil
}

// generateCode 生成6位取件码
func (fs *FileService) generateCode() string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 6)
	rand.Read(b)
	for i := range b {
		b[i] = charset[b[i]%byte(len(charset))]
	}
	return string(b)
}

// getContentType 根据文件扩展名获取内容类型
func (fs *FileService) getContentType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".epub":
		return "application/epub+zip"
	case ".mobi":
		return "application/x-mobipocket-ebook"
	case ".txt":
		return "text/plain"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".mp4":
		return "video/mp4"
	case ".avi":
		return "video/avi"
	case ".mov":
		return "video/quicktime"
	case ".zip":
		return "application/zip"
	case ".rar":
		return "application/x-rar-compressed"
	case ".7z":
		return "application/x-7z-compressed"
	default:
		return "application/octet-stream"
	}
}

// GetFileByCode 根据取件码获取文件信息
func (fs *FileService) GetFileByCode(code string) (*models.FileInfo, error) {
	store := GetStore()
	return store.GetFileInfo(code)
}

// DeleteFile 删除文件
func (fs *FileService) DeleteFile(code string) error {
	fileInfo, err := fs.GetFileByCode(code)
	if err != nil {
		return err
	}

	// 删除物理文件
	if err := os.Remove(fileInfo.FilePath); err != nil {
		return fmt.Errorf("删除文件失败: %v", err)
	}

	// 从内存存储删除文件信息
	store := GetStore()
	store.DeleteFileInfo(code)

	return nil
}

// ConvertEpubToMobi 将EPUB转换为MOBI格式
func (fs *FileService) ConvertEpubToMobi(epubPath string) (string, error) {
	// TODO: 集成Calibre API进行格式转换
	// 这里暂时返回原文件路径
	return epubPath, fmt.Errorf("格式转换功能尚未实现")
}

// CleanExpiredFiles 清理过期文件
func (fs *FileService) CleanExpiredFiles() error {
	// TODO: 实现定期清理过期文件的逻辑
	return nil
}
