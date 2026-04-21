"use client";

import { useEffect, useState } from "react";

interface RevenueData {
  date: string;
  amount: number;
}

interface UserData {
  date: string;
  count: number;
}

export default function StatsPage() {
  const [revenue, setRevenue] = useState<RevenueData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats", {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setRevenue([{ date: "total", amount: data.total_revenue || 0 }]);
        setUsers([{ date: "total", count: data.total_users || 0 }]);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = revenue.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
  const totalUsers = users.reduce((sum: number, u: any) => sum + (u.count || 0), 0);

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
        <h1 className="page-title">Статистика</h1>
        <p className="page-subtitle">Аналитика и метрики</p>
      </div>

      <div className="dashboard-grid">
        <div className="card stat-card">
          <span className="stat-label">Общий доход</span>
          <span className="stat-value">{totalRevenue.toLocaleString()} ₽</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Всего пользователей</span>
          <span className="stat-value">{totalUsers}</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Средний чек</span>
          <span className="stat-value">
            {totalUsers > 0 ? Math.round(totalRevenue / totalUsers) : 0} ₽
          </span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Конверсия</span>
          <span className="stat-value">
            {totalUsers > 0 ? Math.round((revenue.length / totalUsers) * 100) : 0}%
          </span>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: "2rem" }}>
        <div className="card">
          <h3>Доход по дням</h3>
          {revenue.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Дата</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {revenue.slice(-7).map((r) => (
                  <tr key={r.date} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem" }}>{r.date}</td>
                    <td style={{ textAlign: "right", padding: "0.5rem" }}>
                      {r.amount} ₽
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "var(--text-muted)", marginTop: "1rem" }}>Нет данных</p>
          )}
        </div>

        <div className="card">
          <h3>Пользователи по дням</h3>
          {users.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Дата</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>Новых</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(-7).map((u) => (
                  <tr key={u.date} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem" }}>{u.date}</td>
                    <td style={{ textAlign: "right", padding: "0.5rem" }}>
                      +{u.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "var(--text-muted)", marginTop: "1rem" }}>Нет данных</p>
          )}
        </div>
      </div>
    </div>
  );
}