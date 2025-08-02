#!/bin/bash

# =============================================================================
# 全栈应用构建脚本
# 
# 功能：
# 1. 构建 Next.js SSG 静态文件
# 2. 将静态文件复制到 Go 嵌入目录
# 3. 构建 Go 二进制文件，包含嵌入的前端文件
# 4. 生成单一可部署的二进制文件
#
# 使用方法：
#   ./build-fullstack.sh [options]
#
# 选项：
#   --clean         清理所有构建文件
#   --frontend-only 只构建前端
#   --backend-only  只构建后端
#   --dev          开发模式构建
#   --verbose      显示详细输出
#   --help         显示帮助信息
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
FRONTEND_DIR="$PROJECT_ROOT/chuan-next"
FRONTEND_OUT_DIR="$FRONTEND_DIR/out"
GO_WEB_DIR="$PROJECT_ROOT/internal/web"
FRONTEND_EMBED_DIR="$GO_WEB_DIR/frontend"
BINARY_NAME="file-transfer-server"
BINARY_PATH="$PROJECT_ROOT/$BINARY_NAME"

# 标志变量
CLEAN=false
FRONTEND_ONLY=false
BACKEND_ONLY=false
DEV_MODE=false
VERBOSE=false

# 打印函数
print_header() {
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}🚀 $1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

print_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}[VERBOSE]${NC} $1"
    fi
}

# 显示帮助
show_help() {
    cat << EOF
全栈应用构建脚本

此脚本将构建 Next.js 前端和 Go 后端，并将前端静态文件嵌入到 Go 二进制中。

使用方法：
    $0 [选项]

选项：
    --clean         清理所有构建文件和缓存
    --frontend-only 只构建前端部分
    --backend-only  只构建后端部分（需要前端已构建）
    --dev          开发模式构建（包含调试信息）
    --verbose      显示详细构建过程
    --help         显示此帮助信息

示例：
    $0                    # 完整构建
    $0 --clean           # 清理后完整构建
    $0 --frontend-only   # 只构建前端
    $0 --backend-only    # 只构建后端
    $0 --dev --verbose   # 开发模式详细构建

输出：
    构建成功后会生成 '$BINARY_NAME' 可执行文件，包含完整的前后端功能。

EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --clean)
                CLEAN=true
                shift
                ;;
            --frontend-only)
                FRONTEND_ONLY=true
                shift
                ;;
            --backend-only)
                BACKEND_ONLY=true
                shift
                ;;
            --dev)
                DEV_MODE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 检查依赖
check_dependencies() {
    print_step "检查构建依赖..."
    
    local missing_deps=()
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js")
    fi
    
    # 检查 yarn
    if ! command -v yarn &> /dev/null; then
        missing_deps+=("Yarn")
    fi
    
    # 检查 Go
    if ! command -v go &> /dev/null; then
        missing_deps+=("Go")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "缺少必要的依赖: ${missing_deps[*]}"
        print_info "请安装缺少的依赖后重试"
        exit 1
    fi
    
    print_verbose "Node.js 版本: $(node --version)"
    print_verbose "Yarn 版本: $(yarn --version)"
    print_verbose "Go 版本: $(go version)"
    
    print_success "依赖检查完成"
}

# 清理函数
clean_all() {
    if [ "$CLEAN" = true ]; then
        print_step "清理构建文件..."
        
        # 清理前端构建
        if [ -d "$FRONTEND_DIR/.next" ]; then
            rm -rf "$FRONTEND_DIR/.next"
            print_verbose "已删除 $FRONTEND_DIR/.next"
        fi
        
        if [ -d "$FRONTEND_OUT_DIR" ]; then
            rm -rf "$FRONTEND_OUT_DIR"
            print_verbose "已删除 $FRONTEND_OUT_DIR"
        fi
        
        # 清理嵌入的前端文件
        if [ -d "$FRONTEND_EMBED_DIR" ]; then
            find "$FRONTEND_EMBED_DIR" -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.json" -o -name "*.png" -o -name "*.jpg" -o -name "*.svg" -o -name "*.ico" | xargs rm -f 2>/dev/null || true
            print_verbose "已清理嵌入的前端文件"
        fi
        
        # 清理 Go 构建
        if [ -f "$BINARY_PATH" ]; then
            rm -f "$BINARY_PATH"
            print_verbose "已删除 $BINARY_PATH"
        fi
        
        # 清理 Go 模块缓存（可选）
        if [ "$VERBOSE" = true ]; then
            go clean -modcache
        fi
        
        print_success "清理完成"
    fi
}

# 构建前端
build_frontend() {
    if [ "$BACKEND_ONLY" = true ]; then
        print_info "跳过前端构建 (--backend-only)"
        return
    fi
    
    print_step "构建 Next.js 前端..."
    
    # 检查前端目录
    if [ ! -d "$FRONTEND_DIR" ]; then
        print_error "前端目录不存在: $FRONTEND_DIR"
        exit 1
    fi
    
    cd "$FRONTEND_DIR"
    
    # 安装依赖
    print_verbose "安装前端依赖..."
    if [ "$VERBOSE" = true ]; then
        yarn install
    else
        yarn install --silent
    fi
    
    # 执行 SSG 构建
    print_verbose "执行 SSG 构建..."
    
    # 临时移除 API 目录
    api_backup_name=""
    if [ -d "src/app/api" ]; then
        api_backup_name="next-api-backup-$(date +%s)-$$"
        mv src/app/api "/tmp/$api_backup_name" 2>/dev/null || true
        print_verbose "API 目录已备份到: /tmp/$api_backup_name"
    fi
    
    # 构建
    build_success=true
    if [ "$VERBOSE" = true ]; then
        NEXT_EXPORT=true yarn build || build_success=false
    else
        NEXT_EXPORT=true yarn build > build.log 2>&1 || build_success=false
        if [ "$build_success" = false ]; then
            print_error "前端构建失败，查看 $FRONTEND_DIR/build.log"
            cat build.log
            # 恢复 API 目录后再退出
            if [ -n "$api_backup_name" ] && [ -d "/tmp/$api_backup_name" ]; then
                mv "/tmp/$api_backup_name" src/app/api 2>/dev/null || true
                print_verbose "已恢复 API 目录"
            fi
            exit 1
        fi
        rm -f build.log
    fi
    
    # 恢复 API 目录
    if [ -n "$api_backup_name" ] && [ -d "/tmp/$api_backup_name" ]; then
        mv "/tmp/$api_backup_name" src/app/api 2>/dev/null || true
        print_verbose "已恢复 API 目录"
    elif [ -n "$api_backup_name" ]; then
        print_warning "API 目录备份丢失，无法恢复: /tmp/$api_backup_name"
    fi
    
    # 清理历史备份文件（保留最近1小时的）
    find /tmp -name "next-api-backup-*" -mmin +60 -exec rm -rf {} \; 2>/dev/null || true
    
    cd "$PROJECT_ROOT"
    
    # 验证构建结果
    if [ ! -d "$FRONTEND_OUT_DIR" ] || [ ! -f "$FRONTEND_OUT_DIR/index.html" ]; then
        print_error "前端构建失败：输出文件不存在"
        exit 1
    fi
    
    print_success "前端构建完成"
}

# 复制前端文件到嵌入目录
copy_frontend_files() {
    if [ "$BACKEND_ONLY" = true ]; then
        print_info "跳过前端文件复制 (--backend-only)"
        return
    fi
    
    print_step "复制前端文件到嵌入目录..."
    
    # 确保嵌入目录存在
    mkdir -p "$FRONTEND_EMBED_DIR"
    
    # 清理现有文件（除了 .gitkeep）
    find "$FRONTEND_EMBED_DIR" -type f ! -name ".gitkeep" -delete 2>/dev/null || true
    
    # 复制所有文件
    if [ -d "$FRONTEND_OUT_DIR" ]; then
        cp -r "$FRONTEND_OUT_DIR"/* "$FRONTEND_EMBED_DIR/" 2>/dev/null || true
        
        # 统计复制的文件
        file_count=$(find "$FRONTEND_EMBED_DIR" -type f ! -name ".gitkeep" | wc -l)
        total_size=$(du -sh "$FRONTEND_EMBED_DIR" 2>/dev/null | cut -f1 || echo "未知")
        
        print_verbose "复制了 $file_count 个文件，总大小: $total_size"
        print_success "前端文件复制完成"
    else
        print_error "前端输出目录不存在: $FRONTEND_OUT_DIR"
        exit 1
    fi
}

# 构建后端
build_backend() {
    if [ "$FRONTEND_ONLY" = true ]; then
        print_info "跳过后端构建 (--frontend-only)"
        return
    fi
    
    print_step "构建 Go 后端..."
    
    cd "$PROJECT_ROOT"
    
    # 构建参数
    local build_args=()
    
    if [ "$DEV_MODE" = true ]; then
        build_args+=("-gcflags" "all=-N -l")  # 禁用优化，启用调试
        print_verbose "开发模式构建（包含调试信息）"
    else
        build_args+=("-ldflags" "-s -w")  # 移除调试信息和符号表
        print_verbose "生产模式构建（移除调试信息）"
    fi
    
    build_args+=("-o" "$BINARY_NAME" "./cmd")
    
    # 执行构建
    print_verbose "执行 Go 构建: go build ${build_args[*]}"
    
    if [ "$VERBOSE" = true ]; then
        go build "${build_args[@]}"
    else
        go build "${build_args[@]}" 2>&1
        if [ $? -ne 0 ]; then
            print_error "Go 构建失败"
            exit 1
        fi
    fi
    
    # 验证构建结果
    if [ ! -f "$BINARY_PATH" ]; then
        print_error "Go 构建失败：二进制文件不存在"
        exit 1
    fi
    
    # 显示二进制文件信息
    if command -v file &> /dev/null; then
        file_info=$(file "$BINARY_PATH")
        print_verbose "二进制文件信息: $file_info"
    fi
    
    binary_size=$(du -sh "$BINARY_PATH" | cut -f1)
    print_verbose "二进制文件大小: $binary_size"
    
    print_success "后端构建完成"
}

# 验证最终结果
verify_build() {
    print_step "验证构建结果..."
    
    if [ "$FRONTEND_ONLY" = true ]; then
        if [ -d "$FRONTEND_OUT_DIR" ] && [ -f "$FRONTEND_OUT_DIR/index.html" ]; then
            print_success "前端构建验证通过"
        else
            print_error "前端构建验证失败"
            exit 1
        fi
        return
    fi
    
    if [ "$BACKEND_ONLY" = true ]; then
        if [ -f "$BINARY_PATH" ]; then
            print_success "后端构建验证通过"
        else
            print_error "后端构建验证失败"
            exit 1
        fi
        return
    fi
    
    # 完整构建验证
    local errors=()
    
    if [ ! -f "$BINARY_PATH" ]; then
        errors+=("二进制文件不存在")
    fi
    
    if [ ! -d "$FRONTEND_EMBED_DIR" ]; then
        errors+=("前端嵌入目录不存在")
    fi
    
    embedded_files=$(find "$FRONTEND_EMBED_DIR" -type f ! -name ".gitkeep" | wc -l)
    if [ "$embedded_files" -eq 0 ]; then
        errors+=("没有嵌入的前端文件")
    fi
    
    if [ ${#errors[@]} -gt 0 ]; then
        print_error "构建验证失败:"
        for error in "${errors[@]}"; do
            echo "  - $error"
        done
        exit 1
    fi
    
    print_success "构建验证通过"
}

# 显示构建摘要
show_summary() {
    print_header "构建完成"
    
    echo -e "${GREEN}🎉 全栈应用构建成功！${NC}"
    echo ""
    
    if [ "$FRONTEND_ONLY" = true ]; then
        print_info "📁 前端文件输出目录: $FRONTEND_OUT_DIR"
        if [ -d "$FRONTEND_OUT_DIR" ]; then
            file_count=$(find "$FRONTEND_OUT_DIR" -type f | wc -l)
            dir_size=$(du -sh "$FRONTEND_OUT_DIR" | cut -f1)
            echo "   - 文件数量: $file_count"
            echo "   - 总大小: $dir_size"
        fi
        return
    fi
    
    if [ "$BACKEND_ONLY" = true ]; then
        print_info "📦 后端二进制文件: $BINARY_PATH"
        if [ -f "$BINARY_PATH" ]; then
            binary_size=$(du -sh "$BINARY_PATH" | cut -f1)
            echo "   - 文件大小: $binary_size"
        fi
        return
    fi
    
    # 完整构建摘要
    print_info "📦 单一二进制文件: $BINARY_PATH"
    
    if [ -f "$BINARY_PATH" ]; then
        binary_size=$(du -sh "$BINARY_PATH" | cut -f1)
        echo "   - 文件大小: $binary_size"
    fi
    
    if [ -d "$FRONTEND_EMBED_DIR" ]; then
        embedded_files=$(find "$FRONTEND_EMBED_DIR" -type f ! -name ".gitkeep" | wc -l)
        echo "   - 嵌入的前端文件: $embedded_files 个"
    fi
    
    echo ""
    print_info "🚀 部署说明:"
    echo "   1. 只需部署单个二进制文件: $BINARY_NAME"
    echo "   2. 运行命令: ./$BINARY_NAME"
    echo "   3. 访问地址: http://localhost:8080"
    echo ""
    print_info "💡 特性:"
    echo "   ✅ 前端界面完全嵌入"
    echo "   ✅ 无需额外的静态文件服务器"
    echo "   ✅ 支持 SPA 路由"
    echo "   ✅ 自动处理 API 代理"
    echo ""
    
    if [ "$DEV_MODE" = true ]; then
        print_warning "⚠️  这是开发模式构建，包含调试信息，不适合生产部署"
    fi
}

# 错误处理
error_cleanup() {
    print_error "构建过程中发生错误"
    
    # 尝试恢复 API 目录 - 查找所有可能的备份
    local current_process_backups=$(ls /tmp/next-api-backup-*-$$ 2>/dev/null || true)
    local other_backups=$(ls /tmp/next-api-backup-* 2>/dev/null | grep -v "\-$$" | head -1 || true)
    
    # 优先恢复当前进程的备份
    if [ -n "$current_process_backups" ]; then
        for backup in $current_process_backups; do
            if [ -d "$backup" ] && [ -d "$FRONTEND_DIR" ]; then
                mv "$backup" "$FRONTEND_DIR/src/app/api" 2>/dev/null || true
                print_verbose "已恢复 API 目录: $backup"
                break
            fi
        done
    elif [ -n "$other_backups" ] && [ -d "$FRONTEND_DIR" ]; then
        mv "$other_backups" "$FRONTEND_DIR/src/app/api" 2>/dev/null || true
        print_verbose "已恢复 API 目录: $other_backups"
    fi
    
    exit 1
}

# 主函数
main() {
    print_header "全栈应用构建脚本"
    
    # 设置错误处理
    trap error_cleanup ERR INT TERM
    
    # 解析参数
    parse_args "$@"
    
    # 显示构建配置
    if [ "$VERBOSE" = true ]; then
        print_info "构建配置:"
        echo "   - 清理模式: $CLEAN"
        echo "   - 仅前端: $FRONTEND_ONLY"
        echo "   - 仅后端: $BACKEND_ONLY"
        echo "   - 开发模式: $DEV_MODE"
        echo "   - 详细输出: $VERBOSE"
        echo ""
    fi
    
    # 执行构建步骤
    check_dependencies
    clean_all
    build_frontend
    copy_frontend_files
    build_backend
    verify_build
    show_summary
}

# 如果脚本被直接执行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
