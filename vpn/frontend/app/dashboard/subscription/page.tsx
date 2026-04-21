"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Subscription {
  id: string;
  plan_id: string;
  provider: string;
  status: string;
  renew_at: string | null;
}

const PLANS = [
  { id: "monthly", name: "Месяц", price: 299, desc: "30 дней" },
  { id: "yearly", name: "Год", price: 2490, desc: "365 дней", popular: true },
];

export default function SubscriptionPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch("/api/billing/subscription", {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(setSubscription)
      .finally(() => setLoading(false));
  }, []);

  const createCheckout = async (planId: string) => {
    setProcessing(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ plan_id: planId, provider: "yookassa" }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(data.payment_url);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

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
      trial: "Пробный период",
      past_due: "Просрочена",
      canceled: "Отменена",
    };
    return map[status] || status;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
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
        <h1 className="page-title">Подписка</h1>
        <p className="page-subtitle">Управление тарифным планом</p>
      </div>

      {subscription && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <div className="card-header">
            <h3>Текущая подписка</h3>
            <span className={`status-badge ${getStatusBadge(subscription.status)}`}>
              {getStatusText(subscription.status)}
            </span>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              {subscription.plan_id === "monthly" ? "Месяц" :
               subscription.plan_id === "yearly" ? "Год" : subscription.plan_id}
            </p>
            {subscription.renew_at && (
              <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>
                Действует до {formatDate(subscription.renew_at)}
              </p>
            )}
          </div>
        </div>
      )}

      <h3 className="section-title">Доступные планы</h3>
      <div className="dashboard-grid">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="card"
            style={{
              border: plan.popular ? "2px solid var(--primary)" : undefined,
              position: "relative",
            }}
          >
            {plan.popular && (
              <span
                style={{
                  position: "absolute",
                  top: -1,
                  right: 1,
                  background: "var(--primary)",
                  color: "white",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "0 0 8px 8px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                ПОПУЛЯРНЫЙ
              </span>
            )}
            <h3>{plan.name}</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
              {plan.desc}
            </p>
            <p style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1.5rem" }}>
              {plan.price} ₽
            </p>
            <button
              onClick={() => createCheckout(plan.id)}
              disabled={processing || subscription?.status === "active"}
              className="btn-primary"
              style={{ width: "100%" }}
            >
              {processing ? (
                <span className="spinner" style={{ width: 20, height: 20 }} />
              ) : subscription?.status === "active" ? (
                "Текущий план"
              ) : (
                "Выбрать"
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}