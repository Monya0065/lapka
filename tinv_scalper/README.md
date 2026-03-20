# tinv_scalper

Production-grade Python 3.11+/3.12 MOEX long-only bot for T-Invest API.

## What is implemented

- Official SDK only (`t-tech-investments`)
- Services used:
  - `InstrumentsService`: `shares`
  - `MarketDataService`: `get_candles`, `get_order_book`
  - `OrdersService`: `post_order`, `get_order_state`, `get_orders`, `cancel_order`, `get_max_lots`
  - `OperationsService`: `get_positions`, `get_portfolio`

Core trading:
- Dynamic MOEX universe (RUB + API trade flags + normal trading)
- Long-only, one position at a time
- Rotating universe scanner with per-cycle cap (API-safe)
- Composite strategy engine (momentum + ORB breakout + Bollinger rebound)
- Online walk-forward forecast model (1m/5m/15m/30m features)
- Two-stage confirmation entry
- Exit precedence before entry each cycle
- TP1 partial + TP/SL/trailing/breakeven/time-stop/liquidity/slippage/emergency exits

Execution:
- Adaptive order slicing
- Aggressive LIMIT + MARKET fallback
- Partial-fill reconciliation
- Partial close support (for TP1)
- PAPER mode with commission-aware cash accounting

Risk/safety:
- Kill-switch
- Daily loss + daily drawdown limits
- Per-symbol loss limit
- Max trades/day + max trades/hour
- Max notional/day + max notional/hour
- Cooldowns + consecutive-loss cooldown
- Order-failure circuit breaker
- Volatility breaker
- API latency guard
- Latency auto-recovery (configurable cycles/threshold ratio)
- Orderbook depth guard (qty/notional/imbalance)
- Position sizing/slippage/liquidity accounting normalized by lot size
- Profile-adaptive spread/slippage limits (BLUECHIP/STANDARD/THIN)
- API budget guard (calls per cycle/per minute)
- API budget guard auto-recovery after stable load
- Execution-quality guard (auto risk-cut + severe close-only)
- Advanced analytics: profit factor / expectancy / max drawdown / stability / signal health
- Stale-candle guard (max candle age)
- Close-only mode
- Disk-space guard + recovery
- Emergency flatten
- Symbol auto-ban after repeated failed entries
- Re-entry cooldown + new impulse filter

State/observability:
- `state.json` persistence
- SQLite (`logs/bot.db`): events, trades, equity, snapshots
- JSON rotating logs
- Heartbeat file for watchdog
- `/health`, `/ready`, `/metrics`

Local UI:
- Dashboard, controls, price chart, equity curve
- Execution quality chart (slippage/fill + pnl bars)
- KPI panels for performance and signal health
- Strategy mode, peak/breakeven/latency status
- Risk preset controls (CONSERVATIVE/BALANCED/AGGRESSIVE)
- Signals/orders/risk/errors
- Top candidates ranking
- TP1 state visibility
- API usage (cycle/minute) and signal reject statistics
- Preflight status and API guard recovery tracker
- Execution guard state and risk factor
- Execution guard reason + stability warnings
- Active limits, closed trades, audit events
- Runtime config live update + rollback

Security/ops:
- `ALLOW_REAL=true` + explicit UI confirm for REAL mode
- Optional preflight report requirement before REAL mode
- Optional go-live report requirement before REAL mode
- Optional flatten on shutdown in REAL mode
- Optional UI Basic Auth on localhost
- Automatic state/DB backups with rotation
- Optional macOS Keychain token load
- launchd install script
- watchdog check script
- doctor diagnostics script

Research tools:
- walk-forward report from DB
- Monte Carlo from DB
- risk-multiplier optimizer from DB
- execution report by ticker/reason

## Project tree

```text
tinv_scalper/
  app/
    main.py
    config.py
    tbank_client.py
    universe.py
    signals.py
    execution.py
    forecast.py
    risk.py
    state.py
    time_rules.py
    slippage.py
    storage.py
    metrics.py
    watchdog.py
    runtime_config.py
    notifier.py
    ui/
      server.py
      templates/index.html
      static/app.js
      static/style.css
    logging_setup.py
  tools/
    backtest_from_logs.py
    print_status.py
    doctor.py
    macos_install_launchd.sh
    macos_watchdog_check.sh
    com.tinv.scalper.plist.template
    walkforward_from_db.py
    monte_carlo_from_db.py
    optimize_risk_multiplier.py
    execution_report.py
    execution_quality_report.py
    preflight_real.py
    go_live_check.py
    macos_install_watchdog.sh
  tests/
    test_risk.py
    test_signals.py
    test_forecast.py
    test_runtime_config.py
    test_slippage.py
    test_execution_paper.py
    test_storage.py
  .env.example
  pytest.ini
  requirements.txt
  README.md
```

## macOS setup

1. Create venv (recommended Python 3.12):
```bash
cd "/Users/vadimpetrov/Documents/New project/tinv_scalper"
/opt/homebrew/bin/python3.12 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:
```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

3. Configure env:
```bash
cp .env.example .env
```
Set at minimum:
- `TINV_TOKEN` (or Keychain settings)
- `TINV_ACCOUNT_ID`
- keep `BOT_MODE=DRY_RUN` first

4. Run tests:
```bash
pytest -q
```

5. Start bot:
```bash
python -m app.main
```

6. Open UI:
- [http://localhost:8000](http://localhost:8000)

## Runtime config API

- `GET /api/config`
- `POST /api/config/update` with JSON body:
```json
{"values": {"max_api_latency_ms": 3000, "max_trades_per_hour": 5}}
```
- `POST /api/config/rollback`

## Launchd

Install autostart service:
```bash
./tools/macos_install_launchd.sh
```

Check:
```bash
launchctl list | rg com.tinv.scalper
```

Watchdog check (manual run):
```bash
./tools/macos_watchdog_check.sh
```

Install watchdog as launchd job:
```bash
./tools/macos_install_watchdog.sh
```

## Research tools

Walk-forward:
```bash
PYTHONPATH=. python tools/walkforward_from_db.py logs/bot.db 30 10
```

Monte Carlo:
```bash
PYTHONPATH=. python tools/monte_carlo_from_db.py logs/bot.db 5000
```

Risk multiplier optimization:
```bash
PYTHONPATH=. python tools/optimize_risk_multiplier.py logs/bot.db
```

Execution report:
```bash
PYTHONPATH=. python tools/execution_report.py logs/bot.db 500
```

Execution quality report:
```bash
PYTHONPATH=. python tools/execution_quality_report.py logs/bot.db 1000
```

REAL preflight report:
```bash
PYTHONPATH=. python tools/preflight_real.py
```

Go-live consolidated check:
```bash
PYTHONPATH=. python tools/go_live_check.py
```

Execution quality report (with 1h/24h/7d windows):
```bash
PYTHONPATH=. python tools/execution_quality_report.py logs/bot.db 1000
```

## Diagnostics

```bash
PYTHONPATH=. python tools/doctor.py
```

## Note

This bot is an execution/risk framework. Profitability is not guaranteed.
