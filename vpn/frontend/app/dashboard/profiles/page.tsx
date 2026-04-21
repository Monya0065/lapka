"use client";

import { useEffect, useState } from "react";

interface Profile {
  id: string;
  config_ref: string;
  status: string;
  expires_at: string | null;
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/vpn/profiles", {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    })
      .then((res) => res.json())
      .then(setProfiles)
      .finally(() => setLoading(false));
  }, []);

  const createProfile = async (deviceId: string) => {
    setCreating(true);
    try {
      const res = await fetch(`/api/vpn/profiles/generate?device_id=${deviceId}&user_id=current`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([data.config], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "vpn.conf";
        a.click();
        setProfiles([...profiles, {
          id: data.profile_id,
          config_ref: data.config_ref,
          status: "active",
          expires_at: data.expires_at,
        }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const downloadConfig = async (profileId: string) => {
    try {
      const res = await fetch(`/api/vpn/profiles/${profileId}/config?user_id=current`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([data.config], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "vpn.conf";
        a.click();
      }
    } catch (err) {
      console.error(err);
    }
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
        <h1 className="page-title">VPN Профили</h1>
        <p className="page-subtitle">Управление WireGuard конфигурациями</p>
      </div>

      {profiles.length > 0 ? (
        <div className="dashboard-grid">
          {profiles.map((profile) => (
            <div key={profile.id} className="card">
              <div className="card-header">
                <h3>Профиль #{profile.id.slice(0, 8)}</h3>
                <span className={`status-badge ${profile.status === "active" ? "status-active" : "status-inactive"}`}>
                  {profile.status}
                </span>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                Создан: {new Date().toLocaleDateString("ru-RU")}
              </p>
              {profile.expires_at && (
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                  Истекает: {new Date(profile.expires_at).toLocaleDateString("ru-RU")}
                </p>
              )}
              <div className="actions">
                <button onClick={() => downloadConfig(profile.id)} className="btn-sm btn-primary">
                  Скачать
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <p>Нет профилей</p>
            <p style={{ fontSize: "0.875rem" }}>
              Сначала добавьте устройство, затем создайте профиль
            </p>
          </div>
        </div>
      )}
    </div>
  );
}