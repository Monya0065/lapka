const MODE_LABELS = {
  REAL: "БОЕВОЙ",
  DRY_RUN: "ТЕСТ API",
  PAPER: "БУМАЖНЫЙ",
};

const STATUS_LABELS = {
  RUNNING: "РАБОТАЕТ",
  STOPPED: "ОСТАНОВЛЕН",
  "CLOSE-ONLY": "ТОЛЬКО ЗАКРЫТИЕ",
  "KILL-SWITCH": "KILL-SWITCH",
};

const telemetryHistory = [];
const TELEMETRY_LIMIT = 180;

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    const txt = await res.text();
    let message = txt || `HTTP ${res.status}`;
    try {
      const parsed = txt ? JSON.parse(txt) : null;
      if (parsed && typeof parsed.detail === "string") {
        message = parsed.detail;
      } else if (parsed && typeof parsed === "object") {
        message = JSON.stringify(parsed);
      }
    } catch (_) {
      // keep text body as is
    }
    throw new Error(message);
  }
  return await res.json();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setTrendClass(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("positive", "negative");
  if (value > 0) el.classList.add("positive");
  if (value < 0) el.classList.add("negative");
}

function setStatusPill(status) {
  const el = document.getElementById("bot_status");
  if (!el) return;
  const cls = {
    RUNNING: "running",
    STOPPED: "stopped",
    "CLOSE-ONLY": "close-only",
    "KILL-SWITCH": "kill-switch",
  }[status] || "stopped";
  el.className = `status-pill ${cls}`;
  el.textContent = STATUS_LABELS[status] || status || "-";
}

function setFeed(id, arr) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!Array.isArray(arr) || arr.length === 0) {
    el.textContent = "-";
    return;
  }
  el.textContent = arr
    .map((x) => (typeof x === "string" ? x : JSON.stringify(x, null, 2)))
    .join("\n\n");
}

function setControlMessage(text, kind = "info") {
  const el = document.getElementById("control_msg");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("ok", "error");
  if (kind === "ok") el.classList.add("ok");
  if (kind === "error") el.classList.add("error");
}

function getCanvasCtx(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const rawWidth = Math.floor(rect.width);
  if (!Number.isFinite(rawWidth) || rawWidth <= 0) {
    return null;
  }

  let baseHeight = Number(canvas.dataset.baseHeight || 0);
  if (!Number.isFinite(baseHeight) || baseHeight <= 0) {
    const attrHeight = Number(canvas.getAttribute("height"));
    baseHeight = Number.isFinite(attrHeight) && attrHeight > 0 ? attrHeight : 220;
    canvas.dataset.baseHeight = String(baseHeight);
  }

  const width = Math.max(320, rawWidth);
  const height = baseHeight;
  const targetW = Math.floor(width * dpr);
  const targetH = Math.floor(height * dpr);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function drawEmptyChart(canvasId, title) {
  const prepared = getCanvasCtx(canvasId);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#081624";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#91a5b9";
  ctx.font = "12px Avenir Next, sans-serif";
  ctx.fillText(title, 16, 24);
  ctx.fillText("Нет данных", 16, 44);
}

function drawGrid(ctx, width, height, pad, rows = 4) {
  ctx.strokeStyle = "rgba(151, 184, 209, 0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= rows; i += 1) {
    const y = pad + (i / rows) * (height - pad * 2);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }
}

function normalizeLinePoints(points, yKey) {
  if (!Array.isArray(points)) return [];
  const out = points
    .map((p, idx) => {
      const ts = String(p?.ts ?? "");
      return {
        idx,
        ts,
        value: Number(p?.[yKey]),
      };
    })
    .filter((p) => Number.isFinite(p.value) && p.value > 0);

  out.sort((a, b) => {
    const ta = Date.parse(a.ts);
    const tb = Date.parse(b.ts);
    const aOk = Number.isFinite(ta);
    const bOk = Number.isFinite(tb);
    if (aOk && bOk && ta !== tb) return ta - tb;
    return a.idx - b.idx;
  });

  return out;
}

function drawLineChart({ canvasId, points, yKey, color, markers, title }) {
  const series = normalizeLinePoints(points, yKey);
  if (series.length < 2) {
    drawEmptyChart(canvasId, title);
    return;
  }

  const prepared = getCanvasCtx(canvasId);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  const pad = 14;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#081624";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, pad, 4);

  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-9, max - min);

  const xAt = (idx) => pad + (idx / (series.length - 1)) * (width - pad * 2);
  const yAt = (v) => height - pad - ((v - min) / span) * (height - pad * 2);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach((p, idx) => {
    const x = xAt(idx);
    const y = yAt(Number(p.value));
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  if (Array.isArray(markers) && markers.length > 0) {
    const tsToIndex = new Map(series.map((p, idx) => [p.ts, idx]));
    markers.forEach((m) => {
      const idx = tsToIndex.get(m.ts);
      if (idx == null) return;
      const markerPrice = Number(m.price);
      if (!Number.isFinite(markerPrice) || markerPrice <= 0) return;
      const x = xAt(idx);
      const y = yAt(markerPrice);
      ctx.fillStyle = m.type === "entry" ? "#36d399" : "#ff6b7a";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const latest = values[values.length - 1];
  ctx.fillStyle = "#c9d8e6";
  ctx.font = "12px Avenir Next, sans-serif";
  ctx.fillText(`${title}`, 12, 16);
  ctx.fillText(`min ${min.toFixed(2)}`, 12, height - 6);
  ctx.fillText(`max ${max.toFixed(2)}`, 12, 28);
  ctx.fillStyle = "#7fd1ff";
  ctx.fillText(`last ${latest.toFixed(2)}`, width - 120, 16);
}

function drawTelemetryChart(canvasId, points) {
  if (!Array.isArray(points) || points.length < 2) {
    drawEmptyChart(canvasId, "Телеметрия");
    return;
  }

  const prepared = getCanvasCtx(canvasId);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  const pad = 16;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#081624";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, pad, 4);

  const latencyValues = points.map((p) => Number(p.latency_ms));
  const apiValues = points.map((p) => Number(p.api_calls_minute));
  const lMin = Math.min(...latencyValues);
  const lMax = Math.max(...latencyValues);
  const aMin = Math.min(...apiValues);
  const aMax = Math.max(...apiValues);
  const lSpan = Math.max(1, lMax - lMin);
  const aSpan = Math.max(1, aMax - aMin);

  const xAt = (idx) => pad + (idx / (points.length - 1)) * innerW;
  const yLatency = (v) => height - pad - ((v - lMin) / lSpan) * innerH;
  const yApi = (v) => height - pad - ((v - aMin) / aSpan) * innerH;

  ctx.strokeStyle = "#4ac2ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, idx) => {
    const x = xAt(idx);
    const y = yLatency(Number(p.latency_ms));
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.strokeStyle = "#f8b84c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, idx) => {
    const x = xAt(idx);
    const y = yApi(Number(p.api_calls_minute));
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#4ac2ff";
  ctx.font = "12px Avenir Next, sans-serif";
  ctx.fillText(`Latency EWMA: ${latencyValues[latencyValues.length - 1].toFixed(1)} ms`, 12, 16);
  ctx.fillStyle = "#f8b84c";
  ctx.fillText(`API/min: ${apiValues[apiValues.length - 1].toFixed(0)}`, width - 160, 16);

  ctx.fillStyle = "#a8bed1";
  ctx.fillText(`L[min..max] ${lMin.toFixed(1)}..${lMax.toFixed(1)}`, 12, height - 6);
  ctx.fillText(`A[min..max] ${aMin.toFixed(0)}..${aMax.toFixed(0)}`, width - 170, height - 6);
}

function drawExecutionQualityChart(canvasId, points) {
  if (!Array.isArray(points) || points.length < 2) {
    drawEmptyChart(canvasId, "Качество исполнения");
    return;
  }
  const prepared = getCanvasCtx(canvasId);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  const pad = 16;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#081624";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, pad, 4);

  const slipValues = points.map((p) => Number(p.slippage_pct || 0));
  const fillValues = points.map((p) => Number(p.fill_ratio || 0) * 100.0);
  const pnlValues = points.map((p) => Number(p.net_pnl_rub || 0));

  const sMin = Math.min(...slipValues);
  const sMax = Math.max(...slipValues);
  const fMin = Math.min(...fillValues);
  const fMax = Math.max(...fillValues);
  const pAbs = Math.max(1.0, ...pnlValues.map((x) => Math.abs(x)));
  const sSpan = Math.max(0.01, sMax - sMin);
  const fSpan = Math.max(0.1, fMax - fMin);

  const xAt = (idx) => pad + (idx / (points.length - 1)) * innerW;
  const ySlip = (v) => height - pad - ((v - sMin) / sSpan) * innerH;
  const yFill = (v) => height - pad - ((v - fMin) / fSpan) * innerH;
  const yZero = height - pad - ((0 - -pAbs) / (pAbs * 2)) * innerH;

  ctx.strokeStyle = "rgba(190, 210, 228, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, yZero);
  ctx.lineTo(width - pad, yZero);
  ctx.stroke();

  points.forEach((p, idx) => {
    const x = xAt(idx);
    const pnl = Number(p.net_pnl_rub || 0);
    const y = yZero - (pnl / (pAbs * 2)) * innerH;
    const barW = Math.max(2, innerW / points.length * 0.65);
    ctx.fillStyle = pnl >= 0 ? "rgba(54, 211, 153, 0.22)" : "rgba(255, 107, 122, 0.22)";
    ctx.fillRect(x - barW / 2, Math.min(y, yZero), barW, Math.abs(yZero - y));
  });

  ctx.strokeStyle = "#ff8ca0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, idx) => {
    const x = xAt(idx);
    const y = ySlip(Number(p.slippage_pct || 0));
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.strokeStyle = "#4ac2ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, idx) => {
    const x = xAt(idx);
    const y = yFill(Number(p.fill_ratio || 0) * 100.0);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const lastSlip = slipValues[slipValues.length - 1];
  const lastFill = fillValues[fillValues.length - 1];
  ctx.font = "12px Avenir Next, sans-serif";
  ctx.fillStyle = "#ff8ca0";
  ctx.fillText(`Slippage ${lastSlip.toFixed(3)}%`, 12, 16);
  ctx.fillStyle = "#4ac2ff";
  ctx.fillText(`Fill ${lastFill.toFixed(1)}%`, 150, 16);
  ctx.fillStyle = "#a8bed1";
  ctx.fillText("Bars: net PnL (RUB)", width - 160, 16);
}

function pushTelemetryPoint(data) {
  telemetryHistory.push({
    ts: data.timestamp || "",
    api_calls_minute: Number(data.api_calls_minute || 0),
    latency_ms: Number(data.latency_ms_ewma || 0),
    unrealized_pnl_rub: Number(data.unrealized_pnl_rub || 0),
  });
  if (telemetryHistory.length > TELEMETRY_LIMIT) {
    telemetryHistory.splice(0, telemetryHistory.length - TELEMETRY_LIMIT);
  }
}

function formatMode(mode) {
  return MODE_LABELS[mode] || mode || "-";
}

async function refresh() {
  const res = await fetch("/api/status");
  const data = await res.json();

  setStatusPill(data.bot_status);
  setText("mode", formatMode(data.mode));
  setText("instrument", data.instrument || "-");
  setText("position_lots", Number(data.position_lots || 0));
  setText("entry_price", Number(data.entry_price || 0).toFixed(4));
  setText("current_price", Number(data.current_price || 0).toFixed(4));
  setText("unrealized_pnl_rub", Number(data.unrealized_pnl_rub || 0).toFixed(2));
  setText("unrealized_pnl_pct", Number(data.unrealized_pnl_pct || 0).toFixed(3));
  setText("daily_pnl_rub", Number(data.daily_pnl_rub || 0).toFixed(2));
  setText("risk_mode", data.risk_mode || "-");
  setText("leverage_used", Number(data.leverage_used || 0).toFixed(3));
  setText("strategy_mode", data.strategy_mode || "-");
  setText("peak_price", Number(data.peak_price || 0).toFixed(4));
  setText("breakeven_armed", data.breakeven_armed ? "ДА" : "НЕТ");
  setText("tp1_done", data.tp1_done ? "ДА" : "НЕТ");
  setText("latency_ms_ewma", Number(data.latency_ms_ewma || 0).toFixed(1));
  setText("scanned_instruments", Number(data.scanned_instruments || 0));
  setText("dynamic_scan_cap", Number(data.dynamic_scan_cap || 0));
  setText("api_calls_cycle", Number(data.api_calls_cycle || 0));
  setText("api_calls_minute", Number(data.api_calls_minute || 0));

  setTrendClass("unrealized_pnl_rub", Number(data.unrealized_pnl_rub || 0));
  setTrendClass("unrealized_pnl_pct", Number(data.unrealized_pnl_pct || 0));
  setTrendClass("daily_pnl_rub", Number(data.daily_pnl_rub || 0));

  const recCycles = Number(data.runtime_config?.values?.api_budget_recovery_cycles || 1);
  const recStreak = Number(data.api_budget_recovery_streak || 0);
  setText(
    "api_budget_recovery",
    `${data.api_budget_guard_active ? "ACTIVE" : "IDLE"} ${recStreak}/${Math.max(1, recCycles)}`
  );
  const pf = data.preflight || {};
  const pfAge = pf.age_sec == null ? "-" : `${Number(pf.age_sec).toFixed(0)}с`;
  setText("preflight_status", `${pf.status || "-"} age:${pfAge}`);
  setText(
    "execution_guard_state",
    data.execution_guard_active
      ? (data.execution_guard_forced_close_only ? "SEVERE / CLOSE-ONLY" : "ACTIVE")
      : "IDLE"
  );
  setText("execution_risk_factor", Number(data.execution_risk_factor || 1).toFixed(2));
  setText("execution_guard_reason", data.execution_guard_reason || "-");
  setText("notional_day_rub", Number(data.notional_traded_today_rub || 0).toFixed(0));
  setText("notional_hour_rub", Number(data.notional_traded_hour_rub || 0).toFixed(0));
  setText("consecutive_order_failures", Number(data.consecutive_order_failures || 0));
  setText("disk_free_mb", Number(data.disk_free_mb || 0).toFixed(0));
  const backupTs = Number(data.last_backup_ts || 0);
  setText("last_backup_ts", backupTs > 0 ? new Date(backupTs * 1000).toLocaleString("ru-RU") : "-");
  const gl = data.go_live_check || {};
  const glAge = gl.age_sec == null ? "-" : `${Number(gl.age_sec).toFixed(0)}с`;
  setText("go_live_status", `${gl.status || "-"} age:${glAge}`);

  const modeSelect = document.getElementById("mode_select");
  if (modeSelect && modeSelect.value !== data.mode) {
    modeSelect.value = data.mode;
  }
  const resetKillBtn = document.getElementById("reset_killswitch_btn");
  if (resetKillBtn) {
    resetKillBtn.disabled = data.bot_status !== "KILL-SWITCH";
  }
  const startBtn = document.getElementById("start_btn");
  if (startBtn) {
    startBtn.disabled = data.bot_status === "KILL-SWITCH";
  }
  const paperInput = document.getElementById("paper_cash_input");
  const paperBtn = document.getElementById("set_paper_cash_btn");
  if (paperInput && paperBtn) {
    const editable = data.mode === "PAPER" && Number(data.position_lots || 0) === 0;
    paperInput.disabled = !editable;
    paperBtn.disabled = !editable;
  }
  const presetSelect = document.getElementById("risk_preset_select");
  if (presetSelect && Array.isArray(data.risk_presets) && data.risk_presets.length > 0) {
    const current = presetSelect.value;
    presetSelect.innerHTML = data.risk_presets
      .map((x) => `<option value="${x}">${x}</option>`)
      .join("");
    if (data.risk_presets.includes(current)) {
      presetSelect.value = current;
    }
  }

  setFeed("top_candidates", data.top_candidates || []);
  setFeed("signals", data.last_signals || []);
  setFeed("orders", data.last_orders || []);
  setFeed("risk_events", data.risk_events || []);
  setFeed("errors", data.errors || []);
  setFeed("active_limits", data.active_limits || []);
  setFeed("closed_trades", data.closed_trades || []);
  setFeed("daily_summary", [data.daily_summary || {}]);
  setFeed("audit_events", data.audit_events || []);
  setFeed("runtime_config", [data.runtime_config || {}]);
  setFeed("low_latency_streak", [data.low_latency_streak ?? 0]);
  setFeed("signal_reject_stats", data.signal_reject_stats || []);
  setFeed("system_metrics", [data.metrics || {}]);
  setFeed("api_usage", [
    {
      api_calls_cycle: Number(data.api_calls_cycle || 0),
      api_calls_minute: Number(data.api_calls_minute || 0),
    },
  ]);
  setFeed("execution_quality", [data.execution_quality || {}]);
  setFeed("execution_windows", data.execution_kpi_windows || []);
  setFeed("execution_stability", [data.execution_stability || {}]);
  setFeed("trade_performance", [data.trade_performance || {}]);
  setFeed("signal_health", [data.signal_health || {}]);
  setFeed("preflight", [data.preflight || {}]);
  setFeed("api_guard", [
    {
      active: !!data.api_budget_guard_active,
      recovery_streak: Number(data.api_budget_recovery_streak || 0),
      recovery_cycles: Number(data.runtime_config?.values?.api_budget_recovery_cycles || 0),
      cycle_calls: Number(data.api_calls_cycle || 0),
      minute_calls: Number(data.api_calls_minute || 0),
      execution_guard_active: !!data.execution_guard_active,
      execution_guard_forced_close_only: !!data.execution_guard_forced_close_only,
      execution_guard_recovery_streak: Number(data.execution_guard_recovery_streak || 0),
      execution_risk_factor: Number(data.execution_risk_factor || 1),
      order_failure_cooldown_until_ts: Number(data.order_failure_cooldown_until_ts || 0),
      consecutive_order_failures: Number(data.consecutive_order_failures || 0),
      disk_guard_active: !!data.disk_guard_active,
    },
  ]);
  setFeed("go_live_check", [data.go_live_check || {}]);
  setFeed("real_readiness", [data.real_readiness || {}]);

  drawLineChart({
    canvasId: "price_chart",
    points: data.chart?.prices || [],
    yKey: "price",
    color: "#4ac2ff",
    markers: data.chart?.markers || [],
    title: "Цена",
  });

  drawLineChart({
    canvasId: "equity_chart",
    points: data.equity_curve || [],
    yKey: "equity_rub",
    color: "#36d399",
    markers: [],
    title: "Капитал",
  });

  pushTelemetryPoint(data);
  drawTelemetryChart("telemetry_chart", telemetryHistory);
  drawExecutionQualityChart("execution_quality_chart", data.execution_points || []);
}

async function wireControls() {
  const runAction = async (title, action) => {
    try {
      setControlMessage(`${title}...`);
      const payload = await action();
      setControlMessage(`${title}: OK`, "ok");
      await refresh();
      return payload;
    } catch (e) {
      setControlMessage(`${title}: ${e.message || e}`, "error");
      return null;
    }
  };

  document.getElementById("start_btn").addEventListener("click", async () => {
    await runAction("Старт торговли", async () => postJson("/api/control/start"));
  });
  document.getElementById("stop_btn").addEventListener("click", async () => {
    await runAction("Остановка входов", async () => postJson("/api/control/stop"));
  });
  document.getElementById("panic_btn").addEventListener("click", async () => {
    const approved = window.confirm("Подтвердите экстренное закрытие позиции.");
    if (!approved) return;
    await runAction("Экстренное закрытие", async () => postJson("/api/control/panic"));
  });
  document.getElementById("reset_killswitch_btn").addEventListener("click", async () => {
    const approved = window.confirm("Сбросить KILL-SWITCH и вернуть бота в STOPPED/CLOSE-ONLY?");
    if (!approved) return;
    await runAction("Сброс KILL-SWITCH", async () => postJson("/api/control/reset_killswitch"));
  });
  document.getElementById("reset_btn").addEventListener("click", async () => {
    await runAction("Сброс дневных лимитов", async () => postJson("/api/control/reset_daily"));
  });
  document.getElementById("set_mode_btn").addEventListener("click", async () => {
    const mode = document.getElementById("mode_select").value;
    const confirm_real =
      mode === "REAL" ? window.confirm("Подтвердите переход в REAL (реальные сделки).") : false;
    await runAction(`Смена режима на ${mode}`, async () =>
      postJson("/api/control/mode", { mode, confirm_real })
    );
  });
  document.getElementById("risk_preset_btn").addEventListener("click", async () => {
    const preset = document.getElementById("risk_preset_select").value;
    await runAction(`Применение риск-профиля ${preset}`, async () =>
      postJson(`/api/control/risk_preset/${preset}`)
    );
  });
  document.getElementById("run_preflight_btn").addEventListener("click", async () => {
    const payload = await runAction("Запуск preflight", async () => postJson("/api/control/run_preflight"));
    if (payload) {
      const status = payload.payload?.report?.status || payload.reason || "-";
      setControlMessage(`Preflight: ${status}`, payload.ok ? "ok" : "error");
    }
  });
  document.getElementById("run_golive_btn").addEventListener("click", async () => {
    const payload = await runAction("Запуск go-live check", async () =>
      postJson("/api/control/run_go_live_check")
    );
    if (payload) {
      const status = payload.payload?.report?.status || payload.reason || "-";
      setControlMessage(`Go-live check: ${status}`, payload.ok ? "ok" : "error");
    }
  });
  document.getElementById("set_paper_cash_btn").addEventListener("click", async () => {
    const input = document.getElementById("paper_cash_input");
    const amount = Number(input.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setControlMessage("Некорректная сумма PAPER капитала", "error");
      return;
    }
    await runAction(`Установка PAPER капитала ${amount.toFixed(0)} RUB`, async () =>
      postJson("/api/control/paper_cash", { amount_rub: amount })
    );
  });
  document.getElementById("config_apply_btn").addEventListener("click", async () => {
    const msg = document.getElementById("config_msg");
    try {
      const raw = document.getElementById("config_patch").value;
      const values = JSON.parse(raw);
      await postJson("/api/config/update", { values });
      msg.textContent = "Применено";
      await refresh();
    } catch (e) {
      msg.textContent = `Ошибка: ${e.message}`;
    }
  });
  document.getElementById("config_rollback_btn").addEventListener("click", async () => {
    const msg = document.getElementById("config_msg");
    try {
      await postJson("/api/config/rollback");
      msg.textContent = "Откат выполнен";
      await refresh();
    } catch (e) {
      msg.textContent = `Ошибка: ${e.message}`;
    }
  });
}

window.addEventListener("resize", () => {
  refresh().catch((err) => console.error(err));
});

(async () => {
  try {
    await wireControls();
    await refresh();
    setInterval(() => {
      refresh().catch((err) => console.error(err));
    }, 3000);
  } catch (e) {
    console.error(e);
  }
})();
