"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  mfa_enabled: boolean;
  created_at: string;
  subscription_status: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    })
      .then((res) => res.json())
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  const updateUserStatus = async (userId: string, role: string) => {
    try {
      await fetch(`/api/admin/users/${userId}?role=${role}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ status }),
      });
      setUsers(users.map((u) =>
        u.id === userId ? { ...u, subscription_status: status } : u
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Удалить пользователя?")) return;
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      setUsers(users.filter((u) => u.id !== userId));
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string | null) => {
    const map: Record<string, string> = {
      active: "status-active",
      trial: "status-trial",
      past_due: "status-past_due",
      canceled: "status-inactive",
    };
    return map[status || ""] || "status-inactive";
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
        <h1 className="page-title">Пользователи</h1>
        <p className="page-subtitle">Управление пользователями</p>
      </div>

      <div className="card">
        <input
          type="text"
          placeholder="Поиск по email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: "300px", marginBottom: "1rem" }}
        />

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Email</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Статус</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Дата регистрации</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.75rem" }}>{user.email}</td>
                <td style={{ padding: "0.75rem" }}>
                  <span className={`status-badge ${getStatusBadge(user.subscription_status)}`}>
                    {user.subscription_status || "Нет подписки"}
                  </span>
                </td>
                <td style={{ padding: "0.75rem", color: "var(--text-muted)" }}>
                  {new Date(user.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td style={{ padding: "0.75rem" }}>
                  <div className="actions">
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="btn-sm btn-danger"
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
            Пользователи не найдены
          </p>
        )}
      </div>
    </div>
  );
}