#!/bin/bash

# API 凭证验证测试脚本

echo "🧪 Testing API Credential Validation"
echo "═════════════════════════════════════════════════════════════"
echo ""

# 获取脚本所在目录的父目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR" || exit 1

echo "📍 Project Directory: $PROJECT_DIR"
echo ""

# 测试 1: 模拟交易所（应该成功）
echo "─────────────────────────────────────────────────────────────"
echo "Test 1: Mock Exchange (应该直接通过)"
echo "─────────────────────────────────────────────────────────────"
echo ""

export TRADING_MODE=live
export EXCHANGE_PROVIDER=mock
export LIVE_INTERVAL_MINUTES=0.017  # 1 秒
export LIVE_MAX_ITERATIONS=2

echo "Running: EXCHANGE_PROVIDER=mock"
echo ""

timeout 10s deno run --allow-read --allow-write src/main.ts || true

echo ""
echo "✅ Test 1 completed"
echo ""
echo ""

# 测试 2: OKX 无凭证（应该警告）
echo "─────────────────────────────────────────────────────────────"
echo "Test 2: OKX without credentials (应该显示警告)"
echo "─────────────────────────────────────────────────────────────"
echo ""

export EXCHANGE_PROVIDER=okx
unset OKX_API_KEY
unset OKX_API_SECRET
unset OKX_PASSPHRASE

echo "Running: EXCHANGE_PROVIDER=okx (no credentials)"
echo "Expected: 应该看到 'Missing API credentials' 错误"
echo ""
echo "按 Ctrl+C 停止..."
echo ""

# 注意：这会提示用户输入，所以用 timeout 自动停止
timeout 5s deno run --allow-read --allow-write --allow-net src/main.ts 2>&1 | head -20 || true

echo ""
echo "✅ Test 2 completed"
echo ""
echo ""

# 测试 3: OKX 错误凭证（应该失败）
echo "─────────────────────────────────────────────────────────────"
echo "Test 3: OKX with invalid credentials (应该验证失败)"
echo "─────────────────────────────────────────────────────────────"
echo ""

export OKX_API_KEY="invalid_key_test"
export OKX_API_SECRET="invalid_secret_test"
export OKX_PASSPHRASE="invalid_pass_test"

echo "Running: EXCHANGE_PROVIDER=okx (invalid credentials)"
echo "Expected: 应该看到 'API Credential Validation Failed' 错误"
echo ""

timeout 10s deno run --allow-read --allow-write --allow-net src/main.ts 2>&1 | head -30 || true

echo ""
echo "✅ Test 3 completed"
echo ""
echo ""

echo "═════════════════════════════════════════════════════════════"
echo "🎉 All tests completed!"
echo ""
echo "Summary:"
echo "  Test 1: Mock exchange - 应该正常运行"
echo "  Test 2: OKX no credentials - 应该显示缺少凭证"
echo "  Test 3: OKX invalid credentials - 应该显示验证失败"
echo ""
echo "如需测试真实 OKX API，请手动设置正确的环境变量："
echo "  export OKX_API_KEY='your_key'"
echo "  export OKX_API_SECRET='your_secret'"
echo "  export OKX_PASSPHRASE='your_passphrase'"
echo "  deno run --allow-all src/main.ts"
echo "═════════════════════════════════════════════════════════════"

