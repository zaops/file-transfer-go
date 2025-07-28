# Makefile for Chuan File Transfer System

# 默认目标
.PHONY: help
help:
	@echo "可用的命令:"
	@echo "  run      - 运行应用程序"
	@echo "  build    - 构建应用程序"
	@echo "  clean    - 清理构建文件"
	@echo "  deps     - 安装依赖"
	@echo "  test     - 运行测试"
	@echo "  docker   - 构建Docker镜像"

# 应用程序名称
APP_NAME=chuan
BUILD_DIR=build
MAIN_FILE=cmd/main.go

# Go相关命令
GO=go
GOCMD=$(GO)
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod

# 构建标志
LDFLAGS=-ldflags "-X main.Version=1.0.0 -X main.BuildTime=$$(date +'%Y-%m-%d %H:%M:%S')"

# 运行应用程序
.PHONY: run
run:
	@echo "启动文件传输系统..."
	@mkdir -p uploads
	$(GOCMD) run $(MAIN_FILE)

# 构建应用程序
.PHONY: build
build:
	@echo "构建应用程序..."
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(APP_NAME) $(MAIN_FILE)

# 构建Linux版本
.PHONY: build-linux
build-linux:
	@echo "构建Linux版本..."
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(APP_NAME)-linux $(MAIN_FILE)

# 构建Windows版本
.PHONY: build-windows
build-windows:
	@echo "构建Windows版本..."
	@mkdir -p $(BUILD_DIR)
	GOOS=windows GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(APP_NAME)-windows.exe $(MAIN_FILE)

# 构建MacOS版本
.PHONY: build-macos
build-macos:
	@echo "构建MacOS版本..."
	@mkdir -p $(BUILD_DIR)
	GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(APP_NAME)-macos $(MAIN_FILE)

# 构建所有平台版本
.PHONY: build-all
build-all: build-linux build-windows build-macos
	@echo "所有平台构建完成"

# 安装依赖
.PHONY: deps
deps:
	@echo "安装Go模块依赖..."
	$(GOMOD) download
	$(GOMOD) tidy

# 运行测试
.PHONY: test
test:
	@echo "运行测试..."
	$(GOTEST) -v ./...

# 清理构建文件
.PHONY: clean
clean:
	@echo "清理构建文件..."
	$(GOCLEAN)
	rm -rf $(BUILD_DIR)
	rm -rf uploads/*

# 格式化代码
.PHONY: fmt
fmt:
	@echo "格式化Go代码..."
	$(GOCMD) fmt ./...

# 代码检查
.PHONY: vet
vet:
	@echo "运行go vet..."
	$(GOCMD) vet ./...

# 安全检查
.PHONY: security
security:
	@echo "运行安全检查..."
	@which gosec > /dev/null || $(GOGET) github.com/securecodewarrior/gosec/v2/cmd/gosec@latest
	gosec ./...

# 性能测试
.PHONY: bench
bench:
	@echo "运行性能测试..."
	$(GOTEST) -bench=. -benchmem ./...

# 代码覆盖率
.PHONY: coverage
coverage:
	@echo "生成代码覆盖率报告..."
	$(GOTEST) -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html
	@echo "覆盖率报告已生成: coverage.html"

# 创建Docker镜像
.PHONY: docker
docker:
	@echo "构建Docker镜像..."
	docker build -t $(APP_NAME):latest .

# 运行Docker容器
.PHONY: docker-run
docker-run:
	@echo "运行Docker容器..."
	docker run -p 8080:8080 -v $(PWD)/uploads:/app/uploads $(APP_NAME):latest

# 开发模式（热重载）
.PHONY: dev
dev:
	@echo "启动开发模式（需要安装air）..."
	@which air > /dev/null || $(GOGET) github.com/cosmtrek/air@latest
	air

# 安装开发工具
.PHONY: tools
tools:
	@echo "安装开发工具..."
	$(GOGET) github.com/cosmtrek/air@latest
	$(GOGET) github.com/securecodewarrior/gosec/v2/cmd/gosec@latest
	$(GOGET) golang.org/x/tools/cmd/goimports@latest

# 初始化项目
.PHONY: init
init: deps tools
	@echo "项目初始化完成"
	@mkdir -p uploads
	@mkdir -p logs
	@echo "创建必要的目录"

# 部署到生产环境
.PHONY: deploy
deploy: build-linux
	@echo "部署到生产环境..."
	@echo "请手动将 $(BUILD_DIR)/$(APP_NAME)-linux 上传到服务器"

# 查看项目状态
.PHONY: status
status:
	@echo "项目状态:"
	@echo "  Go版本: $$($(GOCMD) version)"
	@echo "  项目路径: $$(pwd)"
	@echo "  模块信息:"
	@$(GOMOD) list -m all | head -10

# 生成API文档
.PHONY: docs
docs:
	@echo "生成API文档..."
	@which swag > /dev/null || $(GOGET) github.com/swaggo/swag/cmd/swag@latest
	swag init -g $(MAIN_FILE)

# 运行所有检查
.PHONY: check
check: fmt vet test
	@echo "所有检查完成"
