#!/bin/bash

# TradeEarn 交易机器人环境变量配置示例
# 使用方法：source config.example.sh

# ==================== 运行模式 ====================
# 可选值：backtest（回测）, live（实时交易）
export TRADING_MODE=backtest

# ==================== 交易所配置 ====================
# 可选值：mock（模拟）, okx（OKX 交易所）
export EXCHANGE_PROVIDER=mock

# OKX 交易所 API 配置（仅在 EXCHANGE_PROVIDER=okx 时需要）
# export OKX_API_KEY="your_api_key_here"
# export OKX_API_SECRET="your_api_secret_here"
# export OKX_PASSPHRASE="your_passphrase_here"
# export OKX_BASE_URL="https://www.okx.com"

# ==================== 实时交易配置 ====================
# 交易决策间隔（分钟）
export LIVE_INTERVAL_MINUTES=5

# 最大执行次数（不设置则无限运行）
# export LIVE_MAX_ITERATIONS=1000

# 遇到错误时是否停止（true/false）
export LIVE_STOP_ON_ERROR=false

# API 失败重试次数
export LIVE_RECONNECT_ATTEMPTS=3

# 重试延迟（秒）
export LIVE_RECONNECT_DELAY=5

# ==================== 回测配置 ====================
# 回测迭代次数
export BACKTEST_ITERATIONS=120

echo "✅ Configuration loaded:"
echo "  Mode: $TRADING_MODE"
echo "  Exchange: $EXCHANGE_PROVIDER"
echo "  Live Interval: $LIVE_INTERVAL_MINUTES minutes"

