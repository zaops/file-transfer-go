#!/bin/bash

# 文件传输系统部署脚本
# 使用方法: ./deploy.sh [环境]
# 环境选项: dev, staging, production

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 环境变量
ENV=${1:-dev}
APP_NAME="chuan"
DOCKER_IMAGE="${APP_NAME}:${ENV}"
COMPOSE_FILE="docker-compose.yml"

# 检查Docker和Docker Compose
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    log_info "依赖检查完成"
}

# 构建应用
build_app() {
    log_info "构建应用..."
    
    # 清理旧的构建
    docker-compose down --remove-orphans
    docker system prune -f
    
    # 构建新镜像
    docker-compose build --no-cache
    
    log_info "应用构建完成"
}

# 生成SSL证书（开发环境）
generate_ssl_cert() {
    if [ "$ENV" = "dev" ]; then
        log_info "生成开发环境SSL证书..."
        
        mkdir -p ssl
        
        if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
            openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes \
                -subj "/C=CN/ST=Beijing/L=Beijing/O=Chuan/OU=Dev/CN=localhost"
            log_info "SSL证书生成完成"
        else
            log_info "SSL证书已存在，跳过生成"
        fi
    fi
}

# 部署应用
deploy_app() {
    log_info "部署应用到${ENV}环境..."
    
    # 根据环境选择不同的配置
    case $ENV in
        "dev")
            export COMPOSE_FILE="docker-compose.yml"
            ;;
        "staging")
            export COMPOSE_FILE="docker-compose.staging.yml"
            ;;
        "production")
            export COMPOSE_FILE="docker-compose.prod.yml"
            ;;
        *)
            log_error "未知环境: $ENV"
            exit 1
            ;;
    esac
    
    # 启动服务
    docker-compose up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 10
    
    # 健康检查
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        log_info "应用健康检查通过"
    else
        log_warn "应用健康检查失败，请检查日志"
    fi
    
    log_info "部署完成"
}

# 显示服务状态
show_status() {
    log_info "服务状态:"
    docker-compose ps
    
    log_info "服务日志（最近20行）:"
    docker-compose logs --tail=20
}

# 备份数据
backup_data() {
    log_info "备份数据..."
    
    BACKUP_DIR="backup/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # 备份上传文件
    if [ -d "uploads" ]; then
        cp -r uploads "$BACKUP_DIR/"
        log_info "上传文件已备份到 $BACKUP_DIR/uploads"
    fi
    
    # 备份Redis数据
    docker-compose exec -T redis redis-cli BGSAVE
    docker cp $(docker-compose ps -q redis):/data/dump.rdb "$BACKUP_DIR/"
    log_info "Redis数据已备份到 $BACKUP_DIR/dump.rdb"
    
    log_info "数据备份完成: $BACKUP_DIR"
}

# 恢复数据
restore_data() {
    BACKUP_DIR=$2
    
    if [ -z "$BACKUP_DIR" ]; then
        log_error "请指定备份目录"
        exit 1
    fi
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "备份目录不存在: $BACKUP_DIR"
        exit 1
    fi
    
    log_info "从 $BACKUP_DIR 恢复数据..."
    
    # 恢复上传文件
    if [ -d "$BACKUP_DIR/uploads" ]; then
        rm -rf uploads/*
        cp -r "$BACKUP_DIR/uploads/"* uploads/
        log_info "上传文件已恢复"
    fi
    
    # 恢复Redis数据
    if [ -f "$BACKUP_DIR/dump.rdb" ]; then
        docker-compose stop redis
        docker cp "$BACKUP_DIR/dump.rdb" $(docker-compose ps -q redis):/data/
        docker-compose start redis
        log_info "Redis数据已恢复"
    fi
    
    log_info "数据恢复完成"
}

# 清理资源
cleanup() {
    log_info "清理资源..."
    
    docker-compose down --volumes --remove-orphans
    docker system prune -af
    docker volume prune -f
    
    log_info "清理完成"
}

# 显示帮助信息
show_help() {
    echo "文件传输系统部署脚本"
    echo ""
    echo "使用方法:"
    echo "  $0 [命令] [环境/参数]"
    echo ""
    echo "命令:"
    echo "  deploy [env]    - 部署应用 (环境: dev, staging, production)"
    echo "  build          - 构建应用"
    echo "  status         - 显示服务状态"
    echo "  backup         - 备份数据"
    echo "  restore [dir]  - 恢复数据"
    echo "  cleanup        - 清理资源"
    echo "  help           - 显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 deploy dev           # 部署到开发环境"
    echo "  $0 deploy production    # 部署到生产环境"
    echo "  $0 backup              # 备份数据"
    echo "  $0 restore backup/20241128_120000  # 恢复数据"
}

# 主函数
main() {
    case ${1:-deploy} in
        "deploy")
            check_dependencies
            generate_ssl_cert
            build_app
            deploy_app
            show_status
            ;;
        "build")
            check_dependencies
            build_app
            ;;
        "status")
            show_status
            ;;
        "backup")
            backup_data
            ;;
        "restore")
            restore_data $@
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main $@
