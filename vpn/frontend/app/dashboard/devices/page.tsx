"use client";

import { useEffect, useState } from "react";

interface Device {
  id: string;
  platform: string;
  name: string | null;
  status: string;
  created_at: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/devices", {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    })
      .then((res) => res.json())
      .then(setDevices)
      .finally(() => setLoading(false));
  }, []);

  const revokeDevice = async (deviceId: string) => {
    if (!confirm("Отозвать устройство? Это действие нельзя отменить.")) return;

    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      if (res.ok) {
        setDevices(devices.filter((d) => d.id !== deviceId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      ios: "",
      android: "🤖",
      macos: "🍎",
      windows: "🪟",
    };
    return icons[platform] || "📱";
  };

  const getStatusBadge = (status: string) => {
    return status === "active" ? "status-active" : "status-inactive";
  };

  const getStatusText = (status: string) => {
    return status === "active" ? "Активно" : status;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
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
        <h1 className="page-title">Устройства</h1>
        <p className="page-subtitle">Подключенные устройства (макс. 5)</p>
      </div>

      {devices.length > 0 ? (
        <div className="dashboard-grid">
          {devices.map((device) => (
            <div key={device.id} className="card">
              <div className="card-header">
                <span style={{ fontSize: "2rem" }}>
                  {getPlatformIcon(device.platform)}
                </span>
                <span className={`status-badge ${getStatusBadge(device.status)}`}>
                  {getStatusText(device.status)}
                </span>
              </div>
              <h3 style={{ marginTop: "0.5rem" }}>
                {device.name || device.platform}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                Добавлено {formatDate(device.created_at)}
              </p>
              {device.status === "active" && (
                <div className="actions">
                  <button
                    onClick={() => revokeDevice(device.id)}
                    className="btn-sm btn-danger"
                  >
                    Отозвать
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <p>Нет устройств</p>
            <p style={{ fontSize: "0.875rem" }}>
              Добавьте устройство через Telegram бот
            </p>
          </div>
        </div>
      )}
    </div>
  );
}