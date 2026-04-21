"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  mfa_enabled: boolean;
  role?: string;
}

interface Subscription {
  status: string;
  plan_id: string;
  renew_at: string | null;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      }).then((r) => r.json()),
      fetch("/api/billing/subscription", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      }).then((r) => r.ok ? r.json() : Promise.resolve(null)),
    ])
      .then(([userData, subData]) => {
        setUser(userData);
        setSubscription(subData);
        if (userData.role === "admin") {
          localStorage.setItem("user_role", "admin");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "status-active",
      trial: "status-trial",
      past_due: "status-past_due",
    };
    return map[status] || "status-inactive";
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      active: "Активна",
      trial: "Пробный",
      past_due: "Просрочена",
    };
    return map[status] || status;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

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
        <h1 className="page-title">Дашборд</h1>
        <p className="page-subtitle">Управляйте VPN из одного места</p>
      </div>

      <div className="dashboard-grid">
        <div className="card stat-card">
          <span className="stat-label">Аккаунт</span>
          <span className="stat-value" style={{ fontSize: "1.25rem" }}>
            {user?.email}
          </span>
          <p style={{ color: "var(--text-muted)" }}>Email</p>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Подписка</span>
          {subscription ? (
            <>
              <span className={`status-badge ${getStatusBadge(subscription.status)}`}>
                {getStatusText(subscription.status)}
              </span>
              <p style={{ marginTop: "0.5rem" }}>
                {subscription.plan_id === "monthly" ? "Месяц" :
                 subscription.plan_id === "yearly" ? "Год" : subscription.plan_id}
              </p>
              {subscription.renew_at && (
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                  До {formatDate(subscription.renew_at)}
                </p>
              )}
            </>
          ) : (
            <Link href="/dashboard/subscription" className="btn-primary btn-sm">
              Выбрать план
            </Link>
          )}
        </div>

        <Link href="/dashboard/devices" className="card stat-card" style={{ textDecoration: 'none' }}>
          <span className="stat-label">Устройства</span>
          <span className="stat-value">+</span>
          <p style={{ color: "var(--text-muted)" }}>Добавить устройство</p>
        </Link>

        <Link href="/dashboard/profiles" className="card stat-card" style={{ textDecoration: 'none' }}>
          <span className="stat-label">VPN Профили</span>
          <span className="stat-value">+</span>
          <p style={{ color: "var(--text-muted)" }}>Создать профиль</p>
        </Link>
      </div>

      {!subscription && (
        <div className="card" style={{ marginTop: "2rem" }}>
          <div className="card-header">
            <h3>Начните использовать VPN</h3>
          </div>
          <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
            Выберите тарифный план для активации VPN.
          </p>
          <Link href="/dashboard/subscription" className="btn-primary">
            Выбрать план
          </Link>
        </div>
      )}

      {user?.role === "admin" && (
        <div className="card" style={{ marginTop: "2rem", border: "2px solid var(--primary)" }}>
          <div className="card-header">
            <h3>Админ-панель</h3>
            <span className="status-badge status-active">Admin</span>
          </div>
          <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
            Управление пользователями, нодами, платежами
          </p>
          <Link href="/admin" className="btn-primary">
            Открыть админ-панель
          </Link>
        </div>
      )}
    </div>
  );
}