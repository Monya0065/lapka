"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  activeNodes: number;
  totalTraffic: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      }).then((r) => r.json().catch(() => ({ total_users: 0, active_subscriptions: 0, total_revenue: 0, active_nodes: 0 }))),
    ])
      .then(([data]) => {
        setStats({
          totalUsers: data.total_users || 0,
          activeSubscriptions: data.active_subscriptions || 0,
          totalRevenue: data.total_revenue || 0,
          activeNodes: data.active_nodes || 0,
          totalTraffic: data.total_traffic || 0,
        });
      })
      .finally(() => setLoading(false));
  }, []);

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
        <h1 className="page-title">Админ-панель</h1>
        <p className="page-subtitle">Управление VPN сервисом</p>
      </div>

      <div className="dashboard-grid">
        <div className="card stat-card">
          <span className="stat-label">Всего пользователей</span>
          <span className="stat-value">{stats?.totalUsers || 0}</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Активных подписок</span>
          <span className="stat-value">{stats?.activeSubscriptions || 0}</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Доход (рубли)</span>
          <span className="stat-value">{stats?.totalRevenue?.toLocaleString() || 0} ₽</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Активных нод</span>
          <span className="stat-value">{stats?.activeNodes || 0}</span>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: "2rem" }}>
        <div className="card">
          <h3>Быстрые действия</h3>
          <div className="actions" style={{ flexDirection: "column" }}>
            <a href="/admin/users" className="btn-primary" style={{ textAlign: "center" }}>
              Управление пользователями
            </a>
            <a href="/admin/nodes" className="btn-primary btn-secondary" style={{ textAlign: "center" }}>
              Управление нодами
            </a>
            <a href="/admin/payments" className="btn-primary btn-secondary" style={{ textAlign: "center" }}>
              Платежи и возвраты
            </a>
          </div>
        </div>

        <div className="card">
          <h3>Система</h3>
          <div style={{ color: "var(--text-muted)" }}>
            <p>API: <span className="status-badge status-active">Онлайн</span></p>
            <p>База данных: <span className="status-badge status-active">Онлайн</span></p>
            <p>Redis: <span className="status-badge status-active">Онлайн</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}