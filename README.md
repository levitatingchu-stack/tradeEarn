# tradeEarn

Deno 智能虚拟货币交易机器人原型。按照 [`docs/trading_bot_plan.md`](docs/trading_bot_plan.md) 的规划实现了基础项目结构、三类策略、风险管理、回测模拟与日报输出。

## 使用方式

1. 安装 [Deno](https://deno.land/)。
2. 选择交易所：

   默认使用内建的模拟交易所。若要连接 Kraken 现货交易，请提前设置环境变量：

   ```bash
   export EXCHANGE_PROVIDER=kraken
   export KRAKEN_API_KEY="你的Kraken API Key"
   export KRAKEN_API_SECRET="你的Kraken API Secret"
   # 如需自定义API地址（例如沙盒环境）
   # export KRAKEN_BASE_URL="https://api.kraken.com"
   ```

   > ⚠️ 实盘交易前请确认 API 权限、资金安全策略，并确保仅使用现货无杠杆权限。

3. 执行回测模拟：

   ```bash
   deno run --allow-read --allow-write src/main.ts
   ```

   程序会在 `data/trades/trades.csv` 写入交易记录，并在 `data/reports/` 目录生成每日绩效 Markdown 报告。

4. 运行单元测试：

   ```bash
   deno test --allow-read --allow-write
   ```

5. 代码格式化与静态检查：

   ```bash
   deno fmt
   deno lint
   ```

## 目录结构

```
src/
  backtest/         # 回测框架与投资组合管理
  config/           # 应用与策略配置
  data/             # 行情与情绪数据服务
  exchanges/        # 交易所接口（含模拟实现）
  reports/          # 绩效报表生成器
  risk/             # 风险控制
  strategies/       # 激进/平衡/稳健策略
  main.ts           # 应用入口
```
