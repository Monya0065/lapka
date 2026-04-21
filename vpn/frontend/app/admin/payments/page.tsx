"use client";

import { useEffect, useState } from "react";

interface Payment {
  id: string;
  user_email: string;
  provider: string;
  order_id: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/admin/payments", {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    })
      .then((res) => res.json())
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = payments.filter((p) =>
    filter === "all" ? true : p.status === filter
  );

  const refundPayment = async (paymentId: string) => {
    if (!confirm("Вернуть платеж?")) return;
    try {
      await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      setPayments(payments.map((p) =>
        p.id === paymentId ? { ...p, status: "refunded" } : p
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      succeeded: "status-active",
      pending: "status-trial",
      canceled: "status-inactive",
      refunded: "status-past_due",
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
        <h1 className="page-title">Платежи</h1>
        <p className="page-subtitle">Управление платежами и возвратами</p>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {["all", "succeeded", "pending", "canceled", "refunded"].map((status) => (
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
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Провайдер</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Сумма</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Статус</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Дата</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((payment) => (
              <tr key={payment.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.75rem" }}>{payment.user_email}</td>
                <td style={{ padding: "0.75rem", color: "var(--text-muted)" }}>
                  {payment.provider}
                </td>
                <td style={{ padding: "0.75rem" }}>{payment.amount} ₽</td>
                <td style={{ padding: "0.75rem" }}>
                  <span className={`status-badge ${getStatusBadge(payment.status)}`}>
                    {payment.status}
                  </span>
                </td>
                <td style={{ padding: "0.75rem", color: "var(--text-muted)" }}>
                  {new Date(payment.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td style={{ padding: "0.75rem" }}>
                  {payment.status === "succeeded" && (
                    <button
                      onClick={() => refundPayment(payment.id)}
                      className="btn-sm btn-danger"
                    >
                      Вернуть
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
            Платежи не найдены
          </p>
        )}
      </div>
    </div>
  );
}