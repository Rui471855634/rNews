#!/bin/bash

# rNews 启动脚本
# 自动检测并使用 Node 20+

# 尝试加载 nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# 检查 Node 版本
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')

if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 20 ]; then
  # 尝试切换到 Node 20
  if command -v nvm &>/dev/null; then
    nvm use 20 &>/dev/null
  elif [ -x "$HOME/.nvm/versions/node/v20.20.0/bin/node" ]; then
    export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
  else
    echo "❌ 需要 Node.js >= 20，当前版本: $(node -v 2>/dev/null || echo '未安装')"
    echo ""
    echo "安装方法："
    echo "  nvm install 20"
    exit 1
  fi
fi

echo "Node $(node -v)"

# 运行 rNews
npx tsx src/index.ts "$@"
