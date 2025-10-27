#!/bin/bash

# 测试实时交易模式脚本
# 使用模拟交易所，运行 3 次迭代后自动停止

echo "🧪 Testing Live Trading Mode..."
echo "================================"
echo ""
echo "Configuration:"
echo "  - Mode: Live Trading"
echo "  - Exchange: Mock (Simulated)"
echo "  - Interval: 1 second (for testing)"
echo "  - Max Iterations: 3"
echo ""
echo "Starting test in 3 seconds..."
sleep 3

export TRADING_MODE=live
export EXCHANGE_PROVIDER=mock
export LIVE_INTERVAL_MINUTES=0.0167  # 1 second in minutes
export LIVE_MAX_ITERATIONS=3
export LIVE_RECONNECT_ATTEMPTS=2

cd "$(dirname "$0")/.." || exit 1

deno run \
  --allow-read \
  --allow-write \
  src/main.ts

echo ""
echo "✅ Test completed!"

