"use client";

import { useEffect, useState } from "react";

interface VPNNode {
  id: string;
  region: string;
  endpoint: string;
  status: string;
  capacity: number;
  health_score: number;
  created_at: string;
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<VPNNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ 
    region: "ru-central", 
    endpoint: "vpn.example.com:51820", 
    public_key: "Сгенерируйте через: wg genkey" 
  });

  const regionOptions = [
    { value: "ru-central", label: "Россия (Центр) - Москва" },
    { value: "ru-east", label: "Россия (Восток) - Екатеринбург/Новосиб" },
    { value: "eu-west", label: "Европа (Запад) - Амстердам/Франкфурт" },
    { value: "eu-north", label: "Европа (Север) - Стокгольм" },
    { value: "us-east", label: "США (Восток) - NYC" },
    { value: "us-west", label: "США (Запад) - LA" },
    { value: "asia-east", label: "Азия (Восток) - Сингапур/Токио" },
  ];

  useEffect(() => {
    fetch("/api/admin/vpn/nodes", {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    })
      .then((res) => res.json())
      .then(setNodes)
      .catch(() => setNodes([]))
      .finally(() => setLoading(false));
  }, []);

  const createNode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/vpn/nodes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const newNode = await res.json();
        setNodes([...nodes, newNode]);
        setShowForm(false);
        setForm({ region: "ru-central", endpoint: "", public_key: "" });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateNodeStatus = async (nodeId: string, status: string) => {
    try {
      await fetch(`/api/admin/nodes/${nodeId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ status }),
      });
      setNodes(nodes.map((n) => (n.id === nodeId ? { ...n, status } : n)));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNode = async (nodeId: string) => {
    if (!confirm("Удалить ноду?")) return;
    try {
      await fetch(`/api/admin/vpn/nodes/${nodeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      setNodes(nodes.filter((n) => n.id !== nodeId));
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    return status === "active" ? "status-active" : "status-inactive";
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "var(--success)";
    if (score >= 50) return "var(--warning)";
    return "var(--error)";
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
        <h1 className="page-title">VPN Ноды</h1>
        <p className="page-subtitle">Управление серверами</p>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Серверы ({nodes.length})</h3>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary btn-sm">
            {showForm ? "Отмена" : "Добавить ноду"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h3>Новая нода</h3>
          <form onSubmit={createNode}>
            <div className="form-group">
              <label>Регион</label>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                style={{ width: "100%", padding: "0.875rem", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)" }}
              >
                <option value="ru-central">Россия (Центр)</option>
                <option value="ru-east">Россия (Восток)</option>
                <option value="eu-west">Европа (Запад)</option>
                <option value="eu-central">Европа (Центр)</option>
                <option value="asia-east">Азия (Восток)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Endpoint</label>
              <input
                type="text"
                placeholder="vpn1.example.com:51820"
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Public Key</label>
              <input
                type="text"
                placeholder="Base64 ключ..."
                value={form.public_key}
                onChange={(e) => setForm({ ...form, public_key: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn-primary">
              Создать
            </button>
          </form>
        </div>
      )}

      <div className="dashboard-grid">
        {nodes.map((node) => (
          <div key={node.id} className="card">
            <div className="card-header">
              <h3>{node.region}</h3>
              <span className={`status-badge ${getStatusBadge(node.status)}`}>
                {node.status}
              </span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              {node.endpoint}
            </p>
            <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Емкость</p>
                <p style={{ fontWeight: 600 }}>{node.capacity}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Health</p>
                <p style={{ fontWeight: 600, color: getHealthColor(node.health_score) }}>
                  {node.health_score}%
                </p>
              </div>
            </div>
            <div className="actions">
              {node.status === "active" ? (
                <button
                  onClick={() => updateNodeStatus(node.id, "maintenance")}
                  className="btn-sm btn-secondary"
                >
                  На обслуживание
                </button>
              ) : (
                <button
                  onClick={() => updateNodeStatus(node.id, "active")}
                  className="btn-sm btn-primary"
                >
                  Активировать
                </button>
              )}
              <button
                onClick={() => deleteNode(node.id)}
                className="btn-sm btn-danger"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      {nodes.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <p>Нет нод</p>
            <p style={{ fontSize: "0.875rem" }}>Добавьте первую ноду</p>
          </div>
        </div>
      )}
    </div>
  );
}