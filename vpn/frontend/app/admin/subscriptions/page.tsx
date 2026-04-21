"use client";

import { useEffect, useState } from "react";

interface Subscription {
  id: string;
  user_email: string;
  plan_id: string;
  provider: string;
  status: string;
  renew_at: string | null;
  created_at: string;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/admin/subscriptions", {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    })
      .then((res) => res.json())
      .then(setSubscriptions)
      .catch(() => setSubscriptions([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = subscriptions.filter((sub) =>
    filter === "all" ? true : sub.status === filter
  );

  const updateSubscription = async (subId: string, status: string) => {
    try {
      await fetch(`/api/admin/subscriptions/${subId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ status }),
      });
      setSubscriptions(subscriptions.map((s) =>
        s.id === subId ? { ...s, status } : s
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "status-active",
      trial: "status-trial",
      past_due: "status-past_due",
      canceled: "status-inactive",
    };
    return map[status] || "status-inactive";
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
        <h1 className="page-title">Подписки</h1>
        <p className="page-subtitle">Управление подписками пользователей</p>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {["all", "active", "trial", "past_due", "canceled"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`btn-sm ${filter === status ? "btn-primary" : "btn-secondary"}`}
            >
              {status === "all" ? "Все" : status}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Пользователь</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>План</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Статус</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Провайдер</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sub) => (
              <tr key={sub.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.75rem" }}>{sub.user_email}</td>
                <td style={{ padding: "0.75rem" }}>{sub.plan_id}</td>
                <td style={{ padding: "0.75rem" }}>
                  <span className={`status-badge ${getStatusBadge(sub.status)}`}>
                    {sub.status}
                  </span>
                </td>
                <td style={{ padding: "0.75rem", color: "var(--text-muted)" }}>
                  {sub.provider}
                </td>
                <td style={{ padding: "0.75rem" }}>
                  {sub.status === "active" ? (
                    <button
                      onClick={() => updateSubscription(sub.id, "canceled")}
                      className="btn-sm btn-danger"
                    >
                      Отменить
                    </button>
                  ) : sub.status === "canceled" ? (
                    <button
                      onClick={() => updateSubscription(sub.id, "active")}
                      className="btn-sm btn-primary"
                    >
                      Активировать
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
            Подписки не найдены
          </p>
        )}
      </div>
    </div>
  );
}