"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Ошибка регистрации");
      }

      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Не удалось создать аккаунт");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <form className="form" onSubmit={handleSubmit}>
        <h2>Создать аккаунт</h2>
        <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          Начните использовать VPN прямо сейчас
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
            placeholder="Минимум 8 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            disabled={loading}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <span className="spinner" style={{ width: 20, height: 20 }} />
          ) : (
            "Создать аккаунт"
          )}
        </button>

        <p>
          Уже есть аккаунт? <Link href="/login">Войти</Link>
        </p>
      </form>
    </main>
  );
}