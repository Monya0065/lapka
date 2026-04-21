"use client";

import { useEffect, useState } from "react";

interface LogEntry {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  actor_id: string | null;
  payload_hash: string | null;
  created_at: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => {
    fetch("/api/admin/logs", {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        return [];
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setLogs(data);
        } else {
          setLogs([]);
        }
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter((log) => {
    const matchesSearch = filter === "" ||
      log.action.toLowerCase().includes(filter.toLowerCase()) ||
      log.entity.toLowerCase().includes(filter.toLowerCase());
    const matchesEntity = entityFilter === "all" || log.entity === entityFilter;
    return matchesSearch && matchesEntity;
  });

  const getActionColor = (action: string) => {
    if (action.includes("create")) return "var(--success)";
    if (action.includes("update")) return "var(--primary)";
    if (action.includes("delete") || action.includes("revoke")) return "var(--error)";
    return "var(--text-muted)";
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const uniqueEntities = [...new Set(logs.map((l) => l.entity))];

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="section">
        <h1 className="page-title">Логи</h1>
        <p className="page-subtitle">Аудит действий пользователей</p>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Поиск..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ maxWidth: "250px" }}
          />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            style={{ padding: "0.75rem", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)" }}
          >
            <option value="all">Все сущности</option>
            {uniqueEntities.map((entity) => (
              <option key={entity} value={entity}>{entity}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Время</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Действие</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Сущность</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>ID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((log) => (
              <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {formatDate(log.created_at)}
                </td>
                <td style={{ padding: "0.75rem", fontWeight: 500, color: getActionColor(log.action) }}>
                  {log.action}
                </td>
                <td style={{ padding: "0.75rem" }}>{log.entity}</td>
                <td style={{ padding: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace", fontSize: "0.8rem" }}>
                  {log.entity_id?.slice(0, 8) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
            Логи не найдены
          </p>
        )}
      </div>
    </div>
  );
}