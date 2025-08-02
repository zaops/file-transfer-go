#!/bin/bash

# =============================================================================
# 简化版 SSG 构建脚本
# 专注于 API 路由的处理和静态导出
# =============================================================================

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 配置
PROJECT_ROOT="$(pwd)"
API_DIR="$PROJECT_ROOT/src/app/api"
TEMP_API_DIR="/tmp/nextjs-api-$(date +%s)"

echo -e "${GREEN}🚀 开始 SSG 静态导出构建...${NC}"

# 错误处理函数
cleanup_on_error() {
    echo -e "${RED}❌ 构建失败，正在恢复文件...${NC}"
    if [ -d "$TEMP_API_DIR" ]; then
        if [ -d "$TEMP_API_DIR/api" ]; then
            mv "$TEMP_API_DIR/api" "$API_DIR" 2>/dev/null || true
            echo -e "${YELLOW}📂 已恢复 API 目录${NC}"
        fi
        rm -rf "$TEMP_API_DIR"
    fi
    exit 1
}

# 设置错误处理
trap cleanup_on_error ERR INT TERM

# 步骤 1: 备份 API 路由
if [ -d "$API_DIR" ]; then
    echo -e "${YELLOW}📦 备份 API 路由...${NC}"
    mkdir -p "$TEMP_API_DIR"
    mv "$API_DIR" "$TEMP_API_DIR/"
    echo "✅ API 路由已备份到临时目录"
else
    echo -e "${YELLOW}⚠️  API 目录不存在，跳过备份${NC}"
fi

# 步骤 2: 清理构建文件
echo -e "${YELLOW}🧹 清理之前的构建...${NC}"
rm -rf .next out

# 步骤 3: 执行静态构建
echo -e "${YELLOW}🔨 执行静态导出构建...${NC}"
NEXT_EXPORT=true yarn build

# 步骤 4: 验证构建结果
if [ -d "out" ] && [ -f "out/index.html" ]; then
    echo -e "${GREEN}✅ 静态导出构建成功！${NC}"
    
    # 显示构建统计
    file_count=$(find out -type f | wc -l)
    dir_size=$(du -sh out | cut -f1)
    echo "📊 构建统计:"
    echo "   - 文件数量: $file_count"
    echo "   - 总大小: $dir_size"
else
    echo -e "${RED}❌ 构建验证失败${NC}"
    cleanup_on_error
fi

# 步骤 5: 恢复 API 路由
if [ -d "$TEMP_API_DIR/api" ]; then
    echo -e "${YELLOW}🔄 恢复 API 路由...${NC}"
    mv "$TEMP_API_DIR/api" "$API_DIR"
    echo "✅ API 路由已恢复"
fi

# 步骤 6: 清理临时文件
rm -rf "$TEMP_API_DIR"

echo ""
echo -e "${GREEN}🎉 SSG 构建完成！${NC}"
echo -e "${GREEN}📁 静态文件位于: ./out/${NC}"
echo -e "${GREEN}🚀 部署命令: npx serve out${NC}"
echo ""
echo -e "${YELLOW}💡 提示: 静态版本会直接连接到 Go 后端 (localhost:8080)${NC}"
