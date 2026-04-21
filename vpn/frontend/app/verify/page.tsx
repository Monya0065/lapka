"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        
        if (res.ok) {
          setStatus("success");
        } else {
          setStatus("error");
        }
      } catch (err) {
        setStatus("error");
      }
    };

    verify();
  }, [token]);

  if (status === "loading") {
    return (
      <main className="container">
        <div className="form">
          <div className="loading">
            <div className="spinner" />
            <p>Подтверждение...</p>
          </div>
        </div>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className="container">
        <div className="form">
          <h2>Email подтверждён!</h2>
          <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
            Ваш email успешно подтверждён. Теперь вы можете пользоваться VPN.
          </p>
          <Link href="/dashboard" className="btn-primary">
            Перейти в кабинет
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="form">
        <h2>Ошибка</h2>
        <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          Ссылка подтверждения недействительна или истекла.
        </p>
        <Link href="/register" className="btn-primary">
          Зарегистрироваться
        </Link>
      </div>
    </main>
  );
}