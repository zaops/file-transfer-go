#!/bin/bash

# =============================================================================
# Next.js SSG 静态导出构建脚本
# 
# 功能：
# 1. 自动备份和移除 API 路由
# 2. 临时修改配置文件以支持静态导出
# 3. 执行静态构建
# 4. 恢复所有文件到原始状态
# 
# 使用方法：
#   ./build-ssg.sh [options]
#   
# 选项：
#   --clean     清理之前的构建文件
#   --verbose   显示详细输出
#   --help      显示帮助信息
# =============================================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
BACKUP_DIR="/tmp/nextjs-ssg-backup-$(date +%s)"
API_DIR="$PROJECT_ROOT/src/app/api"
BUILD_DIR="$PROJECT_ROOT/.next"
OUT_DIR="$PROJECT_ROOT/out"

# 标志变量
VERBOSE=false
CLEAN=false
BACKUP_CREATED=false

# 函数：打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

# 函数：显示帮助信息
show_help() {
    cat << EOF
Next.js SSG 静态导出构建脚本

使用方法：
    $0 [选项]

选项：
    --clean     清理之前的构建文件 (.next, out)
    --verbose   显示详细输出信息
    --help      显示此帮助信息

示例：
    $0                    # 标准静态构建
    $0 --clean           # 清理后构建
    $0 --verbose         # 详细模式构建
    $0 --clean --verbose # 清理后详细模式构建

注意：
    - 此脚本会临时移除 API 路由以支持静态导出
    - 构建完成后会自动恢复所有文件
    - 如果脚本被中断，请手动运行恢复函数

EOF
}

# 函数：解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --clean)
                CLEAN=true
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

# 函数：检查必要的工具
check_requirements() {
    print_info "检查构建环境..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        exit 1
    fi
    
    # 检查 yarn
    if ! command -v yarn &> /dev/null; then
        print_error "Yarn 未安装"
        exit 1
    fi
    
    # 检查 package.json
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        print_error "package.json 不存在"
        exit 1
    fi
    
    # 检查 next.config.js
    if [ ! -f "$PROJECT_ROOT/next.config.js" ]; then
        print_error "next.config.js 不存在"
        exit 1
    fi
    
    print_verbose "Node.js 版本: $(node --version)"
    print_verbose "Yarn 版本: $(yarn --version)"
    print_success "环境检查通过"
}

# 函数：清理构建文件
clean_build() {
    if [ "$CLEAN" = true ]; then
        print_info "清理之前的构建文件..."
        
        if [ -d "$BUILD_DIR" ]; then
            rm -rf "$BUILD_DIR"
            print_verbose "已删除 .next 目录"
        fi
        
        if [ -d "$OUT_DIR" ]; then
            rm -rf "$OUT_DIR"
            print_verbose "已删除 out 目录"
        fi
        
        print_success "构建文件清理完成"
    fi
}

# 函数：创建备份目录
create_backup_dir() {
    print_info "创建备份目录: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    BACKUP_CREATED=true
    print_verbose "备份目录创建成功"
}

# 函数：备份 API 路由
backup_api_routes() {
    if [ -d "$API_DIR" ]; then
        print_info "备份 API 路由..."
        cp -r "$API_DIR" "$BACKUP_DIR/"
        print_verbose "API 路由已备份到: $BACKUP_DIR/api"
        
        # 移除原始 API 目录
        rm -rf "$API_DIR"
        print_verbose "已移除原始 API 目录"
        print_success "API 路由备份完成"
    else
        print_warning "API 目录不存在，跳过备份"
    fi
}

# 函数：备份并修改配置文件
backup_and_modify_config() {
    print_info "处理配置文件..."
    
    # 备份 next.config.js
    if [ -f "$PROJECT_ROOT/next.config.js" ]; then
        cp "$PROJECT_ROOT/next.config.js" "$BACKUP_DIR/next.config.js.backup"
        print_verbose "已备份 next.config.js"
    fi
    
    # 备份 package.json
    if [ -f "$PROJECT_ROOT/package.json" ]; then
        cp "$PROJECT_ROOT/package.json" "$BACKUP_DIR/package.json.backup"
        print_verbose "已备份 package.json"
    fi
    
    # 备份环境变量文件（如果存在）
    for env_file in ".env" ".env.local" ".env.production"; do
        if [ -f "$PROJECT_ROOT/$env_file" ]; then
            cp "$PROJECT_ROOT/$env_file" "$BACKUP_DIR/$env_file.backup"
            print_verbose "已备份 $env_file"
        fi
    done
    
    print_success "配置文件备份完成"
}

# 函数：设置构建环境变量
set_build_env() {
    print_info "设置静态导出环境变量..."
    
    # 创建临时的环境变量文件
    cat > "$PROJECT_ROOT/.env.ssg" << EOF
# SSG 构建临时环境变量
NEXT_EXPORT=true
NODE_ENV=production

# 后端连接配置（用于静态模式 - 使用相对路径）
NEXT_PUBLIC_GO_BACKEND_URL=
NEXT_PUBLIC_WS_URL=
NEXT_PUBLIC_API_BASE_URL=
EOF
    
    print_verbose "已创建 .env.ssg 文件"
    print_success "环境变量设置完成"
}

# 函数：执行静态构建
run_static_build() {
    print_info "开始静态导出构建..."
    
    cd "$PROJECT_ROOT"
    
    # 加载静态导出环境变量
    if [ -f ".env.static" ]; then
        print_info "加载静态导出环境变量..."
        export $(cat .env.static | grep -v '^#' | xargs)
    fi
    
    # 设置环境变量并执行构建
    if [ "$VERBOSE" = true ]; then
        NEXT_EXPORT=true NODE_ENV=production NEXT_PUBLIC_BACKEND_URL= yarn build
    else
        NEXT_EXPORT=true NODE_ENV=production NEXT_PUBLIC_BACKEND_URL= yarn build > build.log 2>&1
        if [ $? -ne 0 ]; then
            print_error "构建失败，查看 build.log 获取详细信息"
            cat build.log
            exit 1
        fi
    fi
    
    print_success "静态构建完成"
}

# 函数：验证构建结果
verify_build() {
    print_info "验证构建结果..."
    
    if [ ! -d "$OUT_DIR" ]; then
        print_error "输出目录 'out' 不存在"
        return 1
    fi
    
    if [ ! -f "$OUT_DIR/index.html" ]; then
        print_error "index.html 文件未生成"
        return 1
    fi
    
    # 计算文件数量
    file_count=$(find "$OUT_DIR" -type f | wc -l)
    dir_size=$(du -sh "$OUT_DIR" | cut -f1)
    
    print_success "构建验证通过"
    print_info "输出文件数量: $file_count"
    print_info "输出目录大小: $dir_size"
    
    if [ "$VERBOSE" = true ]; then
        print_verbose "输出目录结构:"
        ls -la "$OUT_DIR"
    fi
}

# 函数：恢复所有文件
restore_files() {
    if [ "$BACKUP_CREATED" = true ] && [ -d "$BACKUP_DIR" ]; then
        print_info "恢复备份文件..."
        
        # 恢复 API 路由
        if [ -d "$BACKUP_DIR/api" ]; then
            mkdir -p "$(dirname "$API_DIR")"
            cp -r "$BACKUP_DIR/api" "$API_DIR"
            print_verbose "已恢复 API 路由"
        fi
        
        # 恢复配置文件
        if [ -f "$BACKUP_DIR/next.config.js.backup" ]; then
            cp "$BACKUP_DIR/next.config.js.backup" "$PROJECT_ROOT/next.config.js"
            print_verbose "已恢复 next.config.js"
        fi
        
        if [ -f "$BACKUP_DIR/package.json.backup" ]; then
            cp "$BACKUP_DIR/package.json.backup" "$PROJECT_ROOT/package.json"
            print_verbose "已恢复 package.json"
        fi
        
        # 恢复环境变量文件
        for env_file in ".env" ".env.local" ".env.production"; do
            if [ -f "$BACKUP_DIR/$env_file.backup" ]; then
                cp "$BACKUP_DIR/$env_file.backup" "$PROJECT_ROOT/$env_file"
                print_verbose "已恢复 $env_file"
            fi
        done
        
        print_success "文件恢复完成"
    fi
}

# 函数：清理临时文件
cleanup() {
    print_info "清理临时文件..."
    
    # 删除临时环境变量文件
    if [ -f "$PROJECT_ROOT/.env.ssg" ]; then
        rm -f "$PROJECT_ROOT/.env.ssg"
        print_verbose "已删除 .env.ssg"
    fi
    
    # 删除构建日志
    if [ -f "$PROJECT_ROOT/build.log" ]; then
        rm -f "$PROJECT_ROOT/build.log"
        print_verbose "已删除 build.log"
    fi
    
    # 删除备份目录
    if [ -d "$BACKUP_DIR" ]; then
        rm -rf "$BACKUP_DIR"
        print_verbose "已删除备份目录: $BACKUP_DIR"
    fi
    
    print_success "临时文件清理完成"
}

# 函数：错误处理和清理
error_cleanup() {
    print_error "构建过程中发生错误，正在恢复..."
    restore_files
    cleanup
    exit 1
}

# 函数：显示构建摘要
show_summary() {
    print_success "🎉 SSG 静态导出构建完成！"
    echo ""
    print_info "📁 输出目录: $OUT_DIR"
    print_info "🚀 部署方法:"
    echo "   - 将 'out' 目录上传到静态托管服务"
    echo "   - 或者使用: npx serve out"
    echo ""
    print_info "📋 构建统计:"
    if [ -d "$OUT_DIR" ]; then
        file_count=$(find "$OUT_DIR" -type f | wc -l)
        dir_size=$(du -sh "$OUT_DIR" | cut -f1)
        echo "   - 文件数量: $file_count"
        echo "   - 总大小: $dir_size"
    fi
    echo ""
    print_warning "⚠️  注意: 静态版本不包含 API 路由，前端将直接连接到 Go 后端"
}

# 主函数
main() {
    print_info "启动 Next.js SSG 静态导出构建..."
    
    # 设置错误处理
    trap error_cleanup ERR INT TERM
    
    # 解析命令行参数
    parse_args "$@"
    
    # 执行构建步骤
    check_requirements
    clean_build
    create_backup_dir
    backup_api_routes
    backup_and_modify_config
    set_build_env
    run_static_build
    verify_build
    
    # 恢复和清理
    restore_files
    cleanup
    
    # 显示摘要
    show_summary
}

# 如果脚本被直接执行（而不是被 source）
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
