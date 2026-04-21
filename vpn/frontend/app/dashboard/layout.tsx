"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
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
        <Link href="/dashboard" style={{ fontWeight: 700, fontSize: "1.25rem" }}>
          Lapka VPN
        </Link>
        <nav>
          <Link href="/dashboard/devices">Устройства</Link>
          <Link href="/dashboard/subscription">Подписка</Link>
          <Link href="/dashboard/profiles">Профили</Link>
          <button
            onClick={() => {
              localStorage.removeItem("access_token");
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
        <Link
          href="/dashboard"
          className={pathname === "/dashboard" ? "active" : ""}
        >
          Обзор
        </Link>
        <Link
          href="/dashboard/devices"
          className={pathname === "/dashboard/devices" ? "active" : ""}
        >
          Устройства
        </Link>
        <Link
          href="/dashboard/subscription"
          className={pathname === "/dashboard/subscription" ? "active" : ""}
        >
          Подписка
        </Link>
        <Link
          href="/dashboard/profiles"
          className={pathname === "/dashboard/profiles" ? "active" : ""}
        >
          Профили
        </Link>
      </nav>

      {children}
    </div>
  );
}