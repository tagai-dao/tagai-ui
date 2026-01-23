#!/bin/bash
# 启动前端服务器脚本

cd /Users/yinguozi/TagAI_DApp/tagai-ui

echo "🚀 正在启动前端开发服务器..."

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 检测到未安装依赖，正在安装..."
    yarn install
    echo ""
fi

# 检查端口是否被占用（默认 5173）
PORT=5173
if lsof -ti:$PORT > /dev/null 2>&1; then
    echo "⚠️  警告: 端口 $PORT 已被占用"
    echo "   请先关闭占用该端口的进程"
    exit 1
fi

# 启动开发服务器
echo "✅ 启动开发服务器..."
echo "   访问地址: http://localhost:$PORT"
echo "   按 Ctrl+C 停止服务器"
echo ""

yarn dev
