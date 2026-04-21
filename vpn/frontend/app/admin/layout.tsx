"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");
    if (!token) {
      router.push("/login");
    } else if (role !== "admin") {
      router.push("/dashboard");
    } else {
      setLoading(false);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <Link href="/admin" style={{ fontWeight: 700, fontSize: "1.25rem" }}>
          Lapka VPN Admin
        </Link>
        <nav>
          <Link href="/admin/users">Пользователи</Link>
          <Link href="/admin/subscriptions">Подписки</Link>
          <Link href="/admin/nodes">Ноды</Link>
          <Link href="/admin/stats">Статистика</Link>
          <Link href="/dashboard">Клиентский сайт</Link>
          <button
            onClick={() => {
              localStorage.removeItem("access_token");
              localStorage.removeItem("user_role");
              router.push("/");
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Выход
          </button>
        </nav>
      </header>

      <nav className="nav-tabs">
        <Link href="/admin" className={pathname === "/admin" ? "active" : ""}>
          Обзор
        </Link>
        <Link href="/admin/users" className={pathname === "/admin/users" ? "active" : ""}>
          Пользователи
        </Link>
        <Link href="/admin/subscriptions" className={pathname === "/admin/subscriptions" ? "active" : ""}>
          Подписки
        </Link>
        <Link href="/admin/nodes" className={pathname === "/admin/nodes" ? "active" : ""}>
          VPN Ноды
        </Link>
        <Link href="/admin/stats" className={pathname === "/admin/stats" ? "active" : ""}>
          Статистика
        </Link>
        <Link href="/admin/payments" className={pathname === "/admin/payments" ? "active" : ""}>
          Платежи
        </Link>
        <Link href="/admin/logs" className={pathname === "/admin/logs" ? "active" : ""}>
          Логи
        </Link>
        <Link href="/admin/settings" className={pathname === "/admin/settings" ? "active" : ""}>
          Настройки
        </Link>
      </nav>

      {children}
    </div>
  );
}