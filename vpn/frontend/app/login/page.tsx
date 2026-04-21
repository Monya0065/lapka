"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Неверные учетные данные");
      }

      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      
      let userRole = "user";
      const meRes = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        userRole = meData.role || "user";
        localStorage.setItem("user_role", userRole);
      }
      
      router.push(userRole === "admin" ? "/admin" : "/dashboard");
    } catch (err: any) {
      setError(err.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramLogin = async () => {
    try {
      const res = await fetch("/api/telegram/login-url");
      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      console.error("Telegram login error:", err);
    }
  };

  return (
    <main className="container">
      <form className="form" onSubmit={handleSubmit}>
        <h2>С возвращением</h2>
        <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          Войдите в свой аккаунт
        </p>

        {error && <div className="error">{error}</div>}

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            placeholder="example@mail.ru"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Пароль</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <span className="spinner" style={{ width: 20, height: 20 }} />
          ) : (
            "Войти"
          )}
        </button>

        <div style={{ margin: '1.5rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          или
        </div>

        <button 
          type="button" 
          className="btn-secondary" 
          onClick={handleTelegramLogin}
          style={{ width: '100%' }}
        >
          Войти через Telegram
        </button>

        <p>
          Нет аккаунта? <Link href="/register">Создать</Link>
        </p>
      </form>
    </main>
  );
}