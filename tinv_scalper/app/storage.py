from __future__ import annotations

import json
import math
import sqlite3
import threading
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class ClosedTrade:
    ts: str
    figi: str
    ticker: str
    side: str
    lots: int
    entry_price: float
    exit_price: float
    gross_pnl_rub: float
    fee_rub: float
    net_pnl_rub: float
    reason: str
    order_id: str
    spread_pct: float = 0.0
    slippage_pct: float = 0.0
    fill_ratio: float = 0.0
    notional_rub: float = 0.0


class SqliteStore:
    def __init__(self, db_path: str):
        self.path = Path(db_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._setup()

    def _setup(self) -> None:
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT NOT NULL,
                    figi TEXT NOT NULL,
                    ticker TEXT NOT NULL,
                    side TEXT NOT NULL,
                    lots INTEGER NOT NULL,
                    entry_price REAL NOT NULL,
                    exit_price REAL NOT NULL,
                    gross_pnl_rub REAL NOT NULL,
                    fee_rub REAL NOT NULL,
                    net_pnl_rub REAL NOT NULL,
                    reason TEXT NOT NULL,
                    order_id TEXT NOT NULL,
                    spread_pct REAL NOT NULL DEFAULT 0.0,
                    slippage_pct REAL NOT NULL DEFAULT 0.0,
                    fill_ratio REAL NOT NULL DEFAULT 0.0,
                    notional_rub REAL NOT NULL DEFAULT 0.0
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS equity (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT NOT NULL,
                    equity_rub REAL NOT NULL,
                    daily_pnl_rub REAL NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS state_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT NOT NULL,
                    snapshot_json TEXT NOT NULL
                )
                """
            )
            self._ensure_trade_columns()

    def _ensure_trade_columns(self) -> None:
        cols = {
            row["name"]
            for row in self._conn.execute("PRAGMA table_info(trades)").fetchall()
        }
        required = {
            "spread_pct": "REAL NOT NULL DEFAULT 0.0",
            "slippage_pct": "REAL NOT NULL DEFAULT 0.0",
            "fill_ratio": "REAL NOT NULL DEFAULT 0.0",
            "notional_rub": "REAL NOT NULL DEFAULT 0.0",
        }
        for name, definition in required.items():
            if name not in cols:
                self._conn.execute(f"ALTER TABLE trades ADD COLUMN {name} {definition}")

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def backup_to(self, file_path: str) -> None:
        dst = Path(file_path)
        dst.parent.mkdir(parents=True, exist_ok=True)
        with self._lock:
            out = sqlite3.connect(dst)
            try:
                self._conn.backup(out)
            finally:
                out.close()

    def log_event(self, kind: str, payload: dict[str, Any]) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO events(ts, kind, payload_json) VALUES (?, ?, ?)",
                (datetime.now(timezone.utc).isoformat(), kind, json.dumps(payload, ensure_ascii=True)),
            )

    def add_trade(self, trade: ClosedTrade) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT INTO trades(
                    ts, figi, ticker, side, lots, entry_price, exit_price,
                    gross_pnl_rub, fee_rub, net_pnl_rub, reason, order_id,
                    spread_pct, slippage_pct, fill_ratio, notional_rub
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    trade.ts,
                    trade.figi,
                    trade.ticker,
                    trade.side,
                    trade.lots,
                    trade.entry_price,
                    trade.exit_price,
                    trade.gross_pnl_rub,
                    trade.fee_rub,
                    trade.net_pnl_rub,
                    trade.reason,
                    trade.order_id,
                    trade.spread_pct,
                    trade.slippage_pct,
                    trade.fill_ratio,
                    trade.notional_rub,
                ),
            )

    def add_equity_point(self, equity_rub: float, daily_pnl_rub: float) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO equity(ts, equity_rub, daily_pnl_rub) VALUES(?,?,?)",
                (datetime.now(timezone.utc).isoformat(), equity_rub, daily_pnl_rub),
            )

    def save_state_snapshot(self, state_payload: dict[str, Any]) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO state_snapshots(ts, snapshot_json) VALUES(?,?)",
                (datetime.now(timezone.utc).isoformat(), json.dumps(state_payload, ensure_ascii=True)),
            )

    def recent_events(self, kind: str, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT ts, kind, payload_json FROM events WHERE kind=? ORDER BY id DESC LIMIT ?",
                (kind, limit),
            ).fetchall()
        out: list[dict[str, Any]] = []
        for row in rows:
            payload = json.loads(row["payload_json"])
            payload["ts"] = row["ts"]
            payload["kind"] = row["kind"]
            out.append(payload)
        out.reverse()
        return out

    def recent_trades(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT ts, figi, ticker, side, lots, entry_price, exit_price,
                       gross_pnl_rub, fee_rub, net_pnl_rub, reason, order_id,
                       spread_pct, slippage_pct, fill_ratio, notional_rub
                FROM trades ORDER BY id DESC LIMIT ?
                """,
                (limit,),
            ).fetchall()
        out = [dict(row) for row in rows]
        out.reverse()
        return out

    def execution_quality_summary(self, limit: int = 1000) -> dict[str, Any]:
        with self._lock:
            r = self._conn.execute(
                """
                SELECT
                    COUNT(*) AS trades_count,
                    COALESCE(AVG(fill_ratio), 0.0) AS avg_fill_ratio,
                    COALESCE(AVG(slippage_pct), 0.0) AS avg_slippage_pct,
                    COALESCE(AVG(spread_pct), 0.0) AS avg_spread_pct,
                    COALESCE(SUM(notional_rub), 0.0) AS total_notional_rub,
                    COALESCE(SUM(ABS(notional_rub) * slippage_pct / 100.0), 0.0) AS est_slippage_rub
                FROM (
                    SELECT fill_ratio, slippage_pct, spread_pct, notional_rub
                    FROM trades
                    ORDER BY id DESC
                    LIMIT ?
                )
                """,
                (limit,),
            ).fetchone()
            rows = self._conn.execute(
                """
                SELECT reason,
                       COUNT(*) AS trades_count,
                       COALESCE(AVG(fill_ratio), 0.0) AS avg_fill_ratio,
                       COALESCE(AVG(slippage_pct), 0.0) AS avg_slippage_pct,
                       COALESCE(SUM(notional_rub), 0.0) AS total_notional_rub
                FROM (
                    SELECT reason, fill_ratio, slippage_pct, notional_rub
                    FROM trades
                    ORDER BY id DESC
                    LIMIT ?
                )
                GROUP BY reason
                ORDER BY trades_count DESC
                LIMIT 20
                """,
                (limit,),
            ).fetchall()
        return {
            "trades_count": int(r["trades_count"]) if r else 0,
            "avg_fill_ratio": float(r["avg_fill_ratio"]) if r else 0.0,
            "avg_slippage_pct": float(r["avg_slippage_pct"]) if r else 0.0,
            "avg_spread_pct": float(r["avg_spread_pct"]) if r else 0.0,
            "total_notional_rub": float(r["total_notional_rub"]) if r else 0.0,
            "est_slippage_rub": float(r["est_slippage_rub"]) if r else 0.0,
            "by_reason": [dict(x) for x in rows],
        }

    def _stats_pearson(self, xs: list[float], ys: list[float]) -> float:
        n = min(len(xs), len(ys))
        if n < 2:
            return 0.0
        mx = sum(xs[:n]) / n
        my = sum(ys[:n]) / n
        cov = sum((xs[i] - mx) * (ys[i] - my) for i in range(n)) / n
        vx = sum((xs[i] - mx) ** 2 for i in range(n)) / n
        vy = sum((ys[i] - my) ** 2 for i in range(n)) / n
        if vx <= 1e-12 or vy <= 1e-12:
            return 0.0
        return cov / math.sqrt(vx * vy)

    def execution_stability(self, limit: int = 500) -> dict[str, Any]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT spread_pct, slippage_pct, fill_ratio
                FROM trades
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        spreads = [float(r["spread_pct"]) for r in rows]
        slips = [float(r["slippage_pct"]) for r in rows]
        fills = [float(r["fill_ratio"]) for r in rows]
        n = len(rows)
        if n == 0:
            return {
                "trades_count": 0,
                "slippage_std_pct": 0.0,
                "fill_std": 0.0,
                "spread_slippage_corr": 0.0,
            }
        mean_slip = sum(slips) / n
        mean_fill = sum(fills) / n
        slip_std = math.sqrt(sum((x - mean_slip) ** 2 for x in slips) / n)
        fill_std = math.sqrt(sum((x - mean_fill) ** 2 for x in fills) / n)
        corr = self._stats_pearson(spreads, slips)
        return {
            "trades_count": n,
            "slippage_std_pct": float(slip_std),
            "fill_std": float(fill_std),
            "spread_slippage_corr": float(corr),
        }

    def trade_performance_summary(self, limit: int = 5000) -> dict[str, Any]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT ts, net_pnl_rub
                FROM trades
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        if not rows:
            return {
                "trades_count": 0,
                "wins": 0,
                "losses": 0,
                "winrate_pct": 0.0,
                "gross_profit_rub": 0.0,
                "gross_loss_rub": 0.0,
                "net_pnl_rub": 0.0,
                "profit_factor": 0.0,
                "expectancy_rub": 0.0,
                "avg_win_rub": 0.0,
                "avg_loss_rub": 0.0,
                "payoff_ratio": 0.0,
                "max_drawdown_rub": 0.0,
                "recovery_factor": 0.0,
            }

        seq = [float(r["net_pnl_rub"]) for r in rows]
        seq.reverse()
        n = len(seq)
        wins = [x for x in seq if x > 0]
        losses = [x for x in seq if x < 0]
        gross_profit = sum(wins)
        gross_loss_abs = abs(sum(losses))
        net = sum(seq)
        expectancy = net / n if n > 0 else 0.0
        avg_win = (sum(wins) / len(wins)) if wins else 0.0
        avg_loss_abs = (abs(sum(losses)) / len(losses)) if losses else 0.0
        payoff = (avg_win / avg_loss_abs) if avg_loss_abs > 1e-9 else 0.0
        profit_factor = (gross_profit / gross_loss_abs) if gross_loss_abs > 1e-9 else 0.0

        cum = 0.0
        peak = 0.0
        min_dd = 0.0
        for x in seq:
            cum += x
            peak = max(peak, cum)
            dd = cum - peak
            min_dd = min(min_dd, dd)
        max_dd_abs = abs(min_dd)
        recovery = (net / max_dd_abs) if max_dd_abs > 1e-9 else 0.0

        return {
            "trades_count": n,
            "wins": len(wins),
            "losses": len(losses),
            "winrate_pct": (len(wins) / n) * 100.0 if n > 0 else 0.0,
            "gross_profit_rub": float(gross_profit),
            "gross_loss_rub": float(-gross_loss_abs),
            "net_pnl_rub": float(net),
            "profit_factor": float(profit_factor),
            "expectancy_rub": float(expectancy),
            "avg_win_rub": float(avg_win),
            "avg_loss_rub": float(-avg_loss_abs if losses else 0.0),
            "payoff_ratio": float(payoff),
            "max_drawdown_rub": float(-max_dd_abs),
            "recovery_factor": float(recovery),
        }

    def signal_health(self, limit: int = 4000) -> dict[str, Any]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT payload_json
                FROM events
                WHERE kind='signal'
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        total = 0
        passed = 0
        reject_reasons: dict[str, int] = {}
        for row in rows:
            try:
                payload = json.loads(row["payload_json"])
            except Exception:
                continue
            decision = str(payload.get("decision", ""))
            if not decision:
                continue
            total += 1
            if decision == "pass":
                passed += 1
            elif decision.startswith("reject_"):
                reject_reasons[decision] = reject_reasons.get(decision, 0) + 1

        rejected = max(0, total - passed)
        tops = [{"decision": k, "count": v} for k, v in reject_reasons.items()]
        tops.sort(key=lambda x: int(x["count"]), reverse=True)
        return {
            "signals_total": total,
            "signals_passed": passed,
            "signals_rejected": rejected,
            "pass_ratio": (passed / total) if total > 0 else 0.0,
            "reject_ratio": (rejected / total) if total > 0 else 0.0,
            "top_rejects": tops[:10],
        }

    def execution_trade_points(self, limit: int = 240) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT ts, slippage_pct, fill_ratio, spread_pct, net_pnl_rub, notional_rub
                FROM trades
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        out = [dict(row) for row in rows]
        out.reverse()
        return out

    def execution_quality_windows(self, hours: list[int] | None = None, limit: int = 5000) -> list[dict[str, Any]]:
        windows = hours or [1, 24, 24 * 7]
        if not windows:
            return []

        with self._lock:
            rows = self._conn.execute(
                """
                SELECT ts, net_pnl_rub, slippage_pct, fill_ratio, spread_pct, notional_rub
                FROM trades
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        parsed: list[dict[str, Any]] = []
        for row in rows:
            ts_raw = str(row["ts"])
            try:
                dt = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
            except Exception:
                continue
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            parsed.append(
                {
                    "dt": dt.astimezone(timezone.utc),
                    "net_pnl_rub": float(row["net_pnl_rub"]),
                    "slippage_pct": float(row["slippage_pct"]),
                    "fill_ratio": float(row["fill_ratio"]),
                    "spread_pct": float(row["spread_pct"]),
                    "notional_rub": float(row["notional_rub"]),
                }
            )

        now = datetime.now(timezone.utc)
        out: list[dict[str, Any]] = []
        for h in sorted({max(1, int(x)) for x in windows}):
            cutoff = now - timedelta(hours=h)
            chunk = [x for x in parsed if x["dt"] >= cutoff]
            n = len(chunk)
            if n == 0:
                out.append(
                    {
                        "window": f"{h}h",
                        "hours": h,
                        "trades_count": 0,
                        "avg_slippage_pct": 0.0,
                        "avg_fill_ratio": 0.0,
                        "avg_spread_pct": 0.0,
                        "winrate_pct": 0.0,
                        "net_pnl_rub": 0.0,
                        "est_slippage_rub": 0.0,
                    }
                )
                continue

            wins = sum(1 for x in chunk if x["net_pnl_rub"] > 0)
            slip_rub = sum(abs(x["notional_rub"]) * x["slippage_pct"] / 100.0 for x in chunk)
            out.append(
                {
                    "window": f"{h}h",
                    "hours": h,
                    "trades_count": n,
                    "avg_slippage_pct": sum(x["slippage_pct"] for x in chunk) / n,
                    "avg_fill_ratio": sum(x["fill_ratio"] for x in chunk) / n,
                    "avg_spread_pct": sum(x["spread_pct"] for x in chunk) / n,
                    "winrate_pct": (wins / n) * 100.0,
                    "net_pnl_rub": sum(x["net_pnl_rub"] for x in chunk),
                    "est_slippage_rub": slip_rub,
                }
            )
        return out

    def equity_curve(self, limit: int = 300) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT ts, equity_rub, daily_pnl_rub FROM equity ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        out = [dict(row) for row in rows]
        out.reverse()
        return out

    def signal_reject_stats(self, limit: int = 2000) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT payload_json
                FROM events
                WHERE kind='signal'
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        counts: dict[str, int] = {}
        for row in rows:
            try:
                payload = json.loads(row["payload_json"])
            except Exception:
                continue
            decision = str(payload.get("decision", ""))
            if not decision.startswith("reject_"):
                continue
            counts[decision] = counts.get(decision, 0) + 1

        out = [{"decision": k, "count": v} for k, v in counts.items()]
        out.sort(key=lambda x: int(x["count"]), reverse=True)
        return out[:20]

    def daily_summary(self, day_iso: str) -> dict[str, Any]:
        day_prefix = f"{day_iso}%"
        with self._lock:
            r = self._conn.execute(
                """
                SELECT
                    COUNT(*) AS trades_count,
                    COALESCE(SUM(net_pnl_rub), 0.0) AS net_pnl_rub,
                    COALESCE(SUM(CASE WHEN net_pnl_rub > 0 THEN 1 ELSE 0 END), 0) AS wins,
                    COALESCE(SUM(CASE WHEN net_pnl_rub < 0 THEN 1 ELSE 0 END), 0) AS losses,
                    COALESCE(AVG(net_pnl_rub), 0.0) AS avg_trade_rub
                FROM trades
                WHERE ts LIKE ?
                """,
                (day_prefix,),
            ).fetchone()
            eq = self._conn.execute(
                """
                SELECT equity_rub
                FROM equity
                WHERE ts LIKE ?
                ORDER BY id DESC LIMIT 1
                """,
                (day_prefix,),
            ).fetchone()
        trades = int(r["trades_count"]) if r else 0
        wins = int(r["wins"]) if r else 0
        losses = int(r["losses"]) if r else 0
        winrate = (wins / trades * 100.0) if trades > 0 else 0.0
        return {
            "day": day_iso,
            "trades_count": trades,
            "wins": wins,
            "losses": losses,
            "winrate_pct": winrate,
            "net_pnl_rub": float(r["net_pnl_rub"]) if r else 0.0,
            "avg_trade_rub": float(r["avg_trade_rub"]) if r else 0.0,
            "last_equity_rub": float(eq["equity_rub"]) if eq else 0.0,
        }
